# Google Earth Engine Scripts

The Earth Engine Code Editor does not run separate files as independent
programs — variables from earlier code need to exist in the same script
session. **Paste these four files into a single script in the
[GEE Code Editor](https://code.earthengine.google.com), in this exact
order, then click Run:**

1. `01_historical_dataset.js` — defines `tashkent`, `events`, builds the
   raw historical MODIS-based training set (NDVI, EVI, Rainfall,
   Elevation) and exports it.
2. `03_current_features.js` — builds `currentFeatures` /
   `floodFeatureImage` (NDVI, NDBI, NDWI, Rainfall, Elevation) from
   Sentinel-2 + CHIRPS + SRTM. **Must run before script 2** because
   script 2 samples this image at exact flood-pixel locations.
3. `02_exact_pixel_extraction_and_balancing.js` — extracts exact
   native-resolution (250 m) GFD flood pixels for events 2629 and 4242,
   matches them with non-flood pixels, and builds
   `finalBalancedDataset` (56 samples, 50/50 flood split).
4. `04_random_forest_and_risk_map.js` — trains the Random Forest,
   validates with a temporal holdout (train on event 2629, test on
   event 4242), and produces + exports the current flood probability
   and risk classification maps.

## Why the extraction is this complicated (Stage 2)

Simple random sampling over Global Flood Database (GFD) event masks
turned out to be unreliable: of 5 historical events intersecting
Tashkent, 3 returned **zero** flood pixels inside the study area at
random sampling, while the other 2 returned very different counts.
Stage 2 instead reads the exact number of native 250 m flood pixels
GFD actually reports for each usable event (61 for event 2629, 14 for
event 4242), and samples an equal number of non-flood pixels from the
same event — so the final training set is not an artifact of sampling
luck.

## Outputs (Google Drive, folder `GEE_Flood_Results`)

| File | Description |
|---|---|
| `Tashkent_Historical_Flood_MODIS_Dataset.csv` | Raw historical samples |
| `Tashkent_Final_5Feature_Training_Dataset.csv` | Final balanced 56-sample training table |
| `Tashkent_Current_Flood_Features.tif` | 5-band current feature stack |
| `Tashkent_Current_Flood_Probability.tif` | Per-pixel flood probability (0–1) |
| `Tashkent_Current_Flood_Risk_Class.tif` | 5-class risk map (0=Low … 4=Very High) |

Move these files into `data/processed/` (CSVs) and `data/outputs/`
(GeoTIFFs) at the repo root once downloaded from Drive.
