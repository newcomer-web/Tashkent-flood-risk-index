# Methodology

## 1. Research question

Can satellite-derived environmental indicators and historical flood
records be used to predict which parts of Tashkent are most
vulnerable to flooding?

## 2. Study area

A 25 km radius buffer centered on Tashkent, Uzbekistan
(69.2401°E, 41.2995°N). All analysis was carried out at **250 m**
spatial resolution, matching the native scale of the historical flood
label source.

## 3. Data sources

| Variable | Source | Role |
|---|---|---|
| NDVI, NDBI, NDWI | Sentinel-2 (current), MODIS MOD13Q1/MOD09A1 (historical) | Vegetation, built-up surface, and water/moisture indicators |
| Rainfall | CHIRPS daily precipitation | Event and annual precipitation |
| Elevation | SRTM 30 m DEM | Topography (resampled to 250 m for matching) |
| Historical flood labels | Global Flood Database (GFD), MODIS Events V1 | Ground-truth flood/non-flood labels |

## 4. Historical flood events

Five GFD events intersect the Tashkent study area (2004–2015). Initial
random sampling over each event's flood mask showed that **flood-pixel
availability inside the study boundary was extremely uneven** — three
events (2426, 2632, 3132) returned zero flood pixels at the Tashkent
scale, while only events **2629** (61 native flood pixels) and **4242**
(14 native flood pixels) had usable flood signal.

## 5. Exact pixel extraction

Rather than relying on random sampling (which can silently miss sparse
flood pixels), the pipeline extracts the **exact native-resolution
(250 m) flood pixel locations** GFD reports for events 2629 and 4242,
and matches each with an equal number of randomly sampled non-flood
pixels from the same event. This produces a dataset that reflects
actual flood occurrence rather than an artifact of sampling.

## 6. Final training dataset

| | Event 2629 | Event 4242 | Total |
|---|---|---|---|
| Flood | 14 | 14 | 28 |
| Non-flood | 14 | 14 | 28 |
| **Total** | **28** | **28** | **56** |

50% flood / 50% non-flood, evenly split across two independent
historical events.

## 7. Model

**Random Forest** (200 trees, `variablesPerSplit=2`,
`minLeafPopulation=2`, `bagFraction=0.7`, `seed=42`), trained on
5 features: NDVI, NDBI, NDWI, Rainfall, Elevation.

## 8. Validation design: temporal holdout

Instead of a random train/test split, the model is validated with a
**temporal holdout**:

- **Train** on event 2629 (28 samples)
- **Test** on event 4242 (28 samples, held out entirely)

This tests whether the model generalizes to a *different historical
flood episode* rather than to random points within the same episode —
a stronger and more realistic test for a model meant to predict future
flood risk.

## 9. Current risk prediction

The trained model is applied to a 2025 environmental feature stack
(same 5 variables, current Sentinel-2/CHIRPS/SRTM composite) to produce:

1. A per-pixel **flood probability** map (0–1)
2. A 5-class **risk classification** map (Low → Very High), from
   fixed probability thresholds (0.20, 0.40, 0.60, 0.80)

## 10. Limitations

- Final training set is small (56 samples across only 2 usable
  historical events out of 5 available).
- Training accuracy (96.4%) exceeds test accuracy (85.7%), indicating
  some overfitting to the training event.
- Risk-class thresholds (0.20/0.40/0.60/0.80) are fixed cutoffs rather
  than calibrated against independent validation data — they should be
  treated as indicative, not precise probability bands.
- No official municipal drainage-infrastructure dataset was available;
  results describe *environmental* flood susceptibility only, not
  infrastructure-adjusted risk.

See `docs/results.md` for full validation numbers.
