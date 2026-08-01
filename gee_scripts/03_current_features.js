// ============================================================
// TASHKENT FLOOD RISK PROJECT
// STAGE 3 — CURRENT ENVIRONMENTAL FEATURE IMAGE
// Sentinel-2 (NDVI, NDBI, NDWI) + CHIRPS (Rainfall) + SRTM (Elevation)
// ============================================================

var currentStart = '2025-01-01';
var currentEnd = '2025-12-31';

// ------------------------------------------------------------
// 1. SENTINEL-2 SURFACE REFLECTANCE + CLOUD MASK
// ------------------------------------------------------------

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(tashkent)
  .filterDate(currentStart, currentEnd)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

function maskS2(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return image.updateMask(mask).divide(10000);
}

var s2Composite = s2.map(maskS2).median().clip(tashkent);

// ------------------------------------------------------------
// 2. SPECTRAL INDICES
// ------------------------------------------------------------

var currentNDVI = s2Composite.normalizedDifference(['B8', 'B4']).rename('NDVI');
var currentNDBI = s2Composite.normalizedDifference(['B11', 'B8']).rename('NDBI');
var currentNDWI = s2Composite.normalizedDifference(['B3', 'B8']).rename('NDWI');

// ------------------------------------------------------------
// 3. RAINFALL + ELEVATION
// ------------------------------------------------------------

var currentRainfall = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
  .filterBounds(tashkent)
  .filterDate(currentStart, currentEnd)
  .select('precipitation')
  .sum()
  .rename('Rainfall')
  .clip(tashkent);

var currentElevation = ee.Image('USGS/SRTMGL1_003').clip(tashkent).rename('Elevation');

// ------------------------------------------------------------
// 4. COMBINE — this is 'floodFeatureImage' / 'currentFeatures'
//    referenced by 02_exact_pixel_extraction_and_balancing.js
//    and 04_random_forest_and_risk_map.js
// ------------------------------------------------------------

var currentFeatures = ee.Image.cat([
  currentNDVI, currentNDBI, currentNDWI, currentRainfall, currentElevation
]);

var floodFeatureImage = currentFeatures; // alias used in stage 2

print('Current feature bands:', currentFeatures.bandNames());

Map.addLayer(currentNDVI, { min: -1, max: 1, palette: ['brown', 'yellow', 'green'] }, 'Current NDVI');
Map.addLayer(currentNDBI, { min: -0.5, max: 0.5, palette: ['green', 'yellow', 'red'] }, 'Current NDBI');
Map.addLayer(currentNDWI, { min: -1, max: 1, palette: ['brown', 'white', 'blue'] }, 'Current NDWI');
Map.addLayer(currentRainfall, { min: 0, max: 800, palette: ['white', 'lightblue', 'blue', 'darkblue'] }, 'Current Rainfall');
Map.addLayer(currentElevation, { min: 300, max: 800 }, 'Current Elevation');

Export.image.toDrive({
  image: currentFeatures.toFloat(),
  description: 'Tashkent_Current_Flood_Features',
  folder: 'GEE_Flood_Results',
  fileNamePrefix: 'Tashkent_Current_Flood_Features',
  region: tashkent,
  scale: 250,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});
