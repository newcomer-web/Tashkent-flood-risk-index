// ============================================================
// TASHKENT FLOOD RISK PROJECT
// STAGE 2 — EXACT NATIVE-SCALE FLOOD PIXEL EXTRACTION
//           + FINAL BALANCED 5-FEATURE DATASET
//
// Why this stage exists:
// Random sampling over the GFD 'flooded' band initially produced
// wildly uneven flood-pixel availability across events (e.g. event
// 4242 returned only 28 flood samples out of 100 requested, and
// events 2426/2632/3132 returned 0 inside the Tashkent boundary).
// Naive random sampling would therefore misrepresent true flood
// extent. We instead extract the EXACT native-resolution (250 m)
// flood pixels reported by GFD for each usable event and match
// them 1:1 with non-flood pixels from the same event.
// ============================================================

// ------------------------------------------------------------
// 1. NATIVE GFD PROJECTION CHECK
// ------------------------------------------------------------

var event4242 = events.filter(ee.Filter.eq('id', 4242)).first();
var floodBand4242 = event4242.select('flooded');
var gfdProjection = floodBand4242.projection();

print('GFD native scale (m):', gfdProjection.nominalScale()); // 250 m

// ------------------------------------------------------------
// 2. EVENT 4242 — EXACT FLOOD / NON-FLOOD PIXELS
// ------------------------------------------------------------

var eventTashkentIntersection = event4242.geometry().intersection(tashkent, ee.ErrorMargin(1));

var exactFloodMask4242 = floodBand4242.eq(1).selfMask().clip(eventTashkentIntersection);

var exactFloodSamples4242 = exactFloodMask4242.sample({
  region: eventTashkentIntersection, scale: 250, projection: gfdProjection,
  geometries: true, dropNulls: true, tileScale: 4
});
// -> 14 exact flood pixels found for event 4242

var nonFloodMask4242 = floodBand4242.eq(0).selfMask().clip(eventTashkentIntersection);

var nonFloodPoints4242 = nonFloodMask4242.sample({
  region: eventTashkentIntersection, scale: 250, projection: gfdProjection,
  geometries: true, dropNulls: true, numPixels: 14, seed: 4242, tileScale: 4
});

// Attach the 5 current-period features (NDVI, NDBI, NDWI, Rainfall, Elevation)
// 'floodFeatureImage' is built in 03_current_features.js and must be run first
// in the same GEE session for these sampleRegions() calls to work.

var floodTrainingSamples4242 = floodFeatureImage.sampleRegions({
  collection: exactFloodSamples4242, properties: [], scale: 250,
  projection: gfdProjection, geometries: true, tileScale: 4
}).map(function (f) { return f.set({ Flooded: 1, Event_ID: 4242 }); });

var nonFloodTrainingSamples4242 = floodFeatureImage.sampleRegions({
  collection: nonFloodPoints4242, properties: [], scale: 250,
  projection: gfdProjection, geometries: true, tileScale: 4
}).map(function (f) { return f.set({ Flooded: 0, Event_ID: 4242 }); });

var requiredProps = ['NDVI', 'NDBI', 'NDWI', 'Rainfall', 'Elevation', 'Flooded'];

var event4242Balanced = floodTrainingSamples4242.filter(ee.Filter.notNull(requiredProps))
  .merge(nonFloodTrainingSamples4242.filter(ee.Filter.notNull(requiredProps)));

print('EVENT 4242 BALANCED:', event4242Balanced.size(), '(14 flood + 14 non-flood)');

// ------------------------------------------------------------
// 3. EVENT 2629 — EXACT FLOOD / NON-FLOOD PIXELS
// ------------------------------------------------------------

var event2629Image = ee.Image('GLOBAL_FLOOD_DB/MODIS_EVENTS/V1/DFO_2629_From_20050224_to_20050323');
var floodBand2629 = event2629Image.select('flooded');

var floodMask2629Exact = floodBand2629.eq(1).selfMask();
var floodPixelPoints2629 = floodMask2629Exact.reduceToVectors({
  geometry: tashkent, scale: 250, geometryType: 'centroid', eightConnected: false,
  labelProperty: 'Flooded', reducer: ee.Reducer.countEvery(), maxPixels: 1e9,
  bestEffort: false, tileScale: 4
});
// -> 61 exact flood pixels found for event 2629

var selectedFlood2629 = floodPixelPoints2629.randomColumn('random', 2629).sort('random').limit(14);

var nonFloodMask2629 = floodBand2629.eq(0).selfMask();
var nonFloodSamples2629 = nonFloodMask2629.sample({
  region: tashkent, scale: 250, numPixels: 200, seed: 2629,
  geometries: true, dropNulls: true, tileScale: 8
});
var selectedNonFlood2629 = nonFloodSamples2629.randomColumn('random', 2629).sort('random').limit(14);

var validFlood2629 = floodFeatureImage.sampleRegions({
  collection: selectedFlood2629, properties: [], scale: 250, geometries: true, tileScale: 4
}).map(function (f) { return f.set({ Flooded: 1, Event_ID: 2629 }); })
  .filter(ee.Filter.notNull(['NDVI', 'NDBI', 'NDWI', 'Rainfall', 'Elevation']));

var validNonFlood2629 = floodFeatureImage.sampleRegions({
  collection: selectedNonFlood2629, properties: [], scale: 250, geometries: true, tileScale: 4
}).map(function (f) { return f.set({ Flooded: 0, Event_ID: 2629 }); })
  .filter(ee.Filter.notNull(['NDVI', 'NDBI', 'NDWI', 'Rainfall', 'Elevation']));

var event2629Balanced = validFlood2629.limit(14).merge(validNonFlood2629.limit(14));

print('EVENT 2629 BALANCED:', event2629Balanced.size(), '(14 flood + 14 non-flood)');

// ------------------------------------------------------------
// 4. FINAL BALANCED DATASET (56 samples, 2 events, 50/50 flood split)
// ------------------------------------------------------------

var finalBalancedDataset = event2629Balanced.merge(event4242Balanced)
  .randomColumn('random', 42).sort('random');

print('==========================================');
print('FINAL BALANCED DATASET');
print('Total:', finalBalancedDataset.size());                                   // 56
print('Flood:', finalBalancedDataset.filter(ee.Filter.eq('Flooded', 1)).size()); // 28
print('Non-flood:', finalBalancedDataset.filter(ee.Filter.eq('Flooded', 0)).size()); // 28
print('Event 2629:', finalBalancedDataset.filter(ee.Filter.eq('Event_ID', 2629)).size()); // 28
print('Event 4242:', finalBalancedDataset.filter(ee.Filter.eq('Event_ID', 4242)).size()); // 28

Export.table.toDrive({
  collection: finalBalancedDataset,
  description: 'Tashkent_Final_5Feature_Training_Dataset',
  folder: 'GEE_Flood_Project',
  fileFormat: 'CSV'
});
