// ============================================================
// TASHKENT FLOOD RISK PROJECT
// STAGE 1 — STUDY AREA + HISTORICAL GFD DATASET
//
// Historical period: 2004–2015
// Vegetation: MODIS (MOD13Q1)
// Rainfall: CHIRPS
// Elevation: SRTM
// Flood labels: Global Flood Database (GFD)
// ============================================================

// ------------------------------------------------------------
// 1. STUDY AREA — Tashkent (25 km buffer around city center)
// ------------------------------------------------------------

var tashkent = ee.Geometry.Point([69.2401, 41.2995]).buffer(25000);
Map.centerObject(tashkent, 10);

// ------------------------------------------------------------
// 2. HISTORICAL FLOOD EVENTS (Global Flood Database)
// ------------------------------------------------------------

var gfd = ee.ImageCollection('GLOBAL_FLOOD_DB/MODIS_EVENTS/V1');
var events = gfd.filterBounds(tashkent);
print('Historical events intersecting Tashkent:', events.size());

// ------------------------------------------------------------
// 3. STATIC LAYERS
// ------------------------------------------------------------

var modis = ee.ImageCollection('MODIS/061/MOD13Q1'); // NDVI + EVI
var elevation = ee.Image('USGS/SRTMGL1_003').clip(tashkent).rename('Elevation');

// ------------------------------------------------------------
// 4. PER-EVENT FEATURE + LABEL EXTRACTION
// ------------------------------------------------------------

var processEvent = function (event) {
  var start = ee.Date(event.get('system:time_start'));
  var end = ee.Date(event.get('system:time_end'));

  var featureStart = start.advance(-30, 'day');
  var featureEnd = end.advance(1, 'day');

  var modisComposite = modis
    .filterBounds(tashkent)
    .filterDate(featureStart, featureEnd)
    .select(['NDVI', 'EVI'])
    .median()
    .clip(tashkent);

  var ndvi = modisComposite.select('NDVI').multiply(0.0001).rename('NDVI');
  var evi = modisComposite.select('EVI').multiply(0.0001).rename('EVI');

  var rainfall = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterBounds(tashkent)
    .filterDate(start, end.advance(1, 'day'))
    .select('precipitation')
    .sum()
    .rename('Rainfall')
    .clip(tashkent);

  var flood = event.select('flooded').gt(0).unmask(0).rename('Flooded').clip(tashkent);

  var featureImage = ee.Image.cat([ndvi, evi, rainfall, elevation, flood]);

  var floodSamples = featureImage.stratifiedSample({
    numPoints: 100, classBand: 'Flooded', classValues: [1], classPoints: [100],
    region: tashkent, scale: 250, seed: 100, geometries: true, tileScale: 4
  });

  var nonFloodSamples = featureImage.stratifiedSample({
    numPoints: 100, classBand: 'Flooded', classValues: [0], classPoints: [100],
    region: tashkent, scale: 250, seed: 200, geometries: true, tileScale: 4
  });

  var samples = floodSamples.merge(nonFloodSamples);

  return samples.map(function (feature) {
    return feature.set({
      Event_ID: event.get('id'),
      Start_Date: start.format('YYYY-MM-dd'),
      End_Date: end.format('YYYY-MM-dd')
    });
  });
};

// ------------------------------------------------------------
// 5. MERGE ALL EVENTS INTO ONE DATASET
// ------------------------------------------------------------

var processedEvents = events.map(processEvent);

var dataset = ee.FeatureCollection(
  processedEvents.iterate(function (current, previous) {
    return ee.FeatureCollection(previous).merge(ee.FeatureCollection(current));
  }, ee.FeatureCollection([]))
);

dataset = dataset.filter(ee.Filter.notNull(['NDVI', 'EVI', 'Rainfall', 'Elevation', 'Flooded']));

print('TOTAL SAMPLES:', dataset.size());
print('FLOOD SAMPLES:', dataset.filter(ee.Filter.eq('Flooded', 1)).size());
print('NON-FLOOD SAMPLES:', dataset.filter(ee.Filter.eq('Flooded', 0)).size());

// Per-event breakdown
var eventIDs = ee.List([2426, 2629, 2632, 3132, 4242]);
eventIDs.evaluate(function (ids) {
  ids.forEach(function (id) {
    var eventData = dataset.filter(ee.Filter.eq('Event_ID', id));
    print('EVENT ' + id + ' | Flood:', eventData.filter(ee.Filter.eq('Flooded', 1)).size(),
          '| Non-flood:', eventData.filter(ee.Filter.eq('Flooded', 0)).size());
  });
});

// ------------------------------------------------------------
// 6. MAP + EXPORT
// ------------------------------------------------------------

var flooded = dataset.filter(ee.Filter.eq('Flooded', 1));
var nonFlooded = dataset.filter(ee.Filter.eq('Flooded', 0));

Map.addLayer(flooded.style({ color: 'red', pointSize: 5 }), {}, 'Historical Flood Samples');
Map.addLayer(nonFlooded.style({ color: 'blue', pointSize: 2 }), {}, 'Historical Non-Flood Samples');

Export.table.toDrive({
  collection: dataset,
  description: 'Tashkent_Historical_Flood_MODIS_Dataset',
  fileFormat: 'CSV'
});
