# Tashkent Flood Risk & Climate Vulnerability Index

A machine learning pipeline that combines satellite imagery, historical
flood records, and climate data to predict flood-prone areas in
Tashkent, Uzbekistan.

**Problem:** Seasonal storms have repeatedly flooded lower-income
districts while leaving other areas untouched, straining emergency
response that currently has no data-driven way to prioritize where to
act. **Approach:** train a Random Forest model on satellite-derived
environmental features and historical flood events, validate it with
a temporal holdout (train on one flood event, test on a completely
different one), then apply it to current conditions to map flood risk
across the city.

## Results at a glance

| Metric | Value |
|---|---|
| Model | Random Forest, 200 trees |
| Features | NDVI, NDBI, NDWI, Rainfall (CHIRPS), Elevation (SRTM) |
| Validation | Temporal holdout — train on flood event 2629, test on event 4242 |
| Accuracy | **85.71%** |
| Kappa | 0.714 |
| Current high + very high risk area | **1,372.91 km²** |

Full methodology and results: [`docs/methodology.md`](docs/methodology.md),
[`docs/results.md`](docs/results.md).

![Confusion Matrix](docs/images/confusion_matrix.png)

## Repository structure

```
.
├── gee_scripts/            Google Earth Engine JavaScript pipeline (4 stages)
│   ├── 01_historical_dataset.js
│   ├── 02_exact_pixel_extraction_and_balancing.js
│   ├── 03_current_features.js
│   ├── 04_random_forest_and_risk_map.js
│   └── README.md            <- run order + explanation
├── data/
│   ├── raw/                 Flood event log template (for manual additions)
│   ├── processed/           Training CSVs + final_results_summary.json
│   └── outputs/              GeoTIFF exports (probability, risk class, features)
├── notebooks/
│   └── generate_result_charts.py   Builds the charts in docs/images/
├── docs/
│   ├── methodology.md
│   ├── results.md
│   └── images/
├── app/
│   └── streamlit_app.py     Interactive risk map dashboard
└── requirements.txt
```

## How to reproduce

1. **Run the GEE pipeline** — open the [Earth Engine Code
   Editor](https://code.earthengine.google.com), paste the four
   scripts in `gee_scripts/` in the order described in
   `gee_scripts/README.md`, and run. This produces training CSVs and
   GeoTIFF exports in your Google Drive (`GEE_Flood_Project` /
   `GEE_Flood_Results` folders).
2. **Download the outputs** into `data/processed/` (CSVs) and
   `data/outputs/` (GeoTIFFs).
3. **Generate the charts:**
   ```bash
   pip install -r requirements.txt
   python notebooks/generate_result_charts.py
   ```
4. **Run the dashboard:**
   ```bash
   streamlit run app/streamlit_app.py
   ```

## Limitations

- Small final training set (56 samples, 2 usable historical events).
- No official drainage-infrastructure dataset — risk reflects
  environmental susceptibility (topography, moisture, rainfall,
  built-up surface), not infrastructure condition.
- Fixed probability thresholds define risk classes; not independently
  calibrated. See `docs/methodology.md` for the full discussion.

## Author's note

This project grew out of watching seasonal storms flood
lower-income districts in Tashkent while more affluent areas stayed
dry — a visible, unequal consequence of the same storm. The goal here
is a first, honest step toward a tool disaster-response agencies could
eventually use to prioritize drainage maintenance and emergency
resources before extreme weather hits, not a finished product.
