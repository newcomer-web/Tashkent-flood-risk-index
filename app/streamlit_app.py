"""
Tashkent Flood Risk & Climate Vulnerability Index — interactive dashboard.

Run:
    streamlit run app/streamlit_app.py

Expects (place these here after downloading from Google Drive):
    data/outputs/Tashkent_Current_Flood_Risk_Class.tif
    data/outputs/Tashkent_Current_Flood_Probability.tif   (optional)
    data/processed/final_results_summary.json

If the GeoTIFFs are not present yet, the app still runs and shows the
model metrics plus setup instructions instead of the map.
"""

import json
import os

import numpy as np
import streamlit as st

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RISK_TIF = os.path.join(ROOT, "data", "outputs", "Tashkent_Current_Flood_Risk_Class.tif")
PROB_TIF = os.path.join(ROOT, "data", "outputs", "Tashkent_Current_Flood_Probability.tif")
RESULTS_JSON = os.path.join(ROOT, "data", "processed", "final_results_summary.json")

RISK_LABELS = ["Low", "Moderate", "Elevated", "High", "Very High"]
RISK_COLORS = ["#2ecc71", "#f1c40f", "#e67e22", "#e74c3c", "#8e0000"]

st.set_page_config(page_title="Tashkent Flood Risk Index", layout="wide")

st.title("🌊 Tashkent Flood Risk & Climate Vulnerability Index")
st.caption(
    "Random Forest flood-risk model trained on Sentinel-2, CHIRPS, SRTM, and the "
    "Global Flood Database — validated with a temporal holdout across two "
    "independent historical flood events."
)

# ---------------------------------------------------------------------------
# Load results summary
# ---------------------------------------------------------------------------

if os.path.exists(RESULTS_JSON):
    with open(RESULTS_JSON) as f:
        results = json.load(f)
else:
    results = None
    st.warning(f"Could not find {RESULTS_JSON} — showing map/UI only, no metrics.")

col1, col2, col3, col4 = st.columns(4)
if results:
    v = results["validation"]
    col1.metric("Test accuracy", f"{v['overall_accuracy']*100:.1f}%")
    col2.metric("Kappa", f"{v['kappa']:.3f}")
    col3.metric("Flood F1", f"{v['flood_f1']*100:.1f}%")
    col4.metric(
        "High + Very High risk area",
        f"{results['current_prediction']['high_plus_very_high_risk_area_km2']:,.0f} km²",
    )

st.divider()

# ---------------------------------------------------------------------------
# Map
# ---------------------------------------------------------------------------

left, right = st.columns([2, 1])

with left:
    st.subheader("Current flood risk map")

    if not os.path.exists(RISK_TIF):
        st.info(
            "Risk map GeoTIFF not found yet.\n\n"
            "1. Run the Earth Engine pipeline in `gee_scripts/` (see its README).\n"
            "2. Download `Tashkent_Current_Flood_Risk_Class.tif` from Google Drive.\n"
            f"3. Place it at `{os.path.relpath(RISK_TIF, ROOT)}`.\n"
            "4. Rerun this app."
        )
    else:
        try:
            import folium
            import rasterio
            from rasterio.warp import calculate_default_transform, reproject, Resampling
            from streamlit_folium import st_folium
            from matplotlib.colors import ListedColormap

            with rasterio.open(RISK_TIF) as src:
                # Reproject to EPSG:4326 if needed so we can place it on a folium map
                if src.crs and src.crs.to_epsg() != 4326:
                    transform, width, height = calculate_default_transform(
                        src.crs, "EPSG:4326", src.width, src.height, *src.bounds
                    )
                    data = np.empty((height, width), dtype=src.dtypes[0])
                    reproject(
                        source=rasterio.band(src, 1),
                        destination=data,
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=transform,
                        dst_crs="EPSG:4326",
                        resampling=Resampling.nearest,
                    )
                    bounds = rasterio.transform.array_bounds(height, width, transform)
                else:
                    data = src.read(1)
                    bounds = src.bounds

                        cmap = ListedColormap(RISK_COLORS)
            normed = np.clip(data, 0, 4) / 4.0
            rgba = (cmap(normed) * 255).astype(np.uint8)
            rgba[..., 3] = np.where(np.isnan(data), 0, 200)

            carto_api_key = st.secrets["CARTO_API_KEY"]

            m = folium.Map(
                location=[41.2995, 69.2401],
                zoom_start=10,
                tiles=None
            )

            folium.TileLayer(
                tiles=f"https://basemaps.cartocdn.com/light_all/{{z}}/{{x}}/{{y}}{{r}}.png?key={carto_api_key}",
                attr="© OpenStreetMap contributors © CARTO",
                subdomains="abcd",
                max_zoom=20,
                name="CARTO Positron"
            ).add_to(m)

            folium.raster_layers.ImageOverlay(
                image=rgba,
                bounds=[[bounds[1], bounds[0]], [bounds[3], bounds[2]]],
                opacity=0.75,
                name="Flood Risk",
            ).add_to(m)

            folium.LayerControl().add_to(m)

            map_state = st_folium(m, height=520, width=None)
            if map_state and map_state.get("last_clicked"):
                lat = map_state["last_clicked"]["lat"]
                lon = map_state["last_clicked"]["lng"]
                with rasterio.open(RISK_TIF) as src:
                    row, col = src.index(lon, lat)
                    try:
                        value = src.read(1)[row, col]
                        risk_idx = int(np.clip(value, 0, 4))
                        st.success(
                            f"📍 ({lat:.4f}, {lon:.4f}) — Risk class: "
                            f"**{RISK_LABELS[risk_idx]}**"
                        )
                    except IndexError:
                        st.warning("Clicked outside the raster extent.")

        except ImportError as e:
            st.error(
                f"Missing package: {e}. Install with "
                "`pip install rasterio folium streamlit-folium`."
            )

with right:
    st.subheader("Risk legend")
    for label, color in zip(RISK_LABELS, RISK_COLORS):
        st.markdown(
            f"<div style='display:flex;align-items:center;margin-bottom:4px;'>"
            f"<div style='width:16px;height:16px;background:{color};margin-right:8px;"
            f"border-radius:3px;'></div>{label}</div>",
            unsafe_allow_html=True,
        )

    if results:
        st.subheader("Model summary")
        st.markdown(
            f"""
- **Model:** {results['model']}, {results['n_trees']} trees
- **Features:** {', '.join(results['features'])}
- **Train event:** {results['train_event_id']}
- **Test event (held out):** {results['test_event_id']}
- **Resolution:** {results['spatial_resolution_m']} m
"""
        )
        with st.expander("Known limitations"):
            for item in results["known_limitations"]:
                st.markdown(f"- {item}")

st.divider()
st.caption(
    "Data sources: Sentinel-2 (NDVI/NDBI/NDWI), CHIRPS (rainfall), SRTM (elevation), "
    "Global Flood Database (historical flood labels). See docs/methodology.md for details."
)
