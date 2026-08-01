// ============================================================
// TASHKENT FLOOD RISK PROJECT
// STAGE 4 — RANDOM FOREST TRAINING, TEMPORAL HOLDOUT VALIDATION,
//           AND CURRENT FLOOD RISK MAP
//
// Methodological note:
// Instead of a random 80/20 split, this project uses a TEMPORAL
// HOLDOUT design — training on one historical flood event and
// testing on an entirely separate one. This is a stronger test
// of generalization than random splitting, because it checks
// whether the model transfers across distinct flood episodes
// rather than just across random points within the same episode.
// ============================================================

var featureBands = ['NDVI', 'NDBI', 'NDWI', 'Rainfall', 'Elevation'];

// ------------------------------------------------------------
// 1. TRAIN / TEST SPLIT BY EVENT
// finalBalancedDataset comes from 02_exact_pixel_extraction_and_balancing.js
// ------------------------------------------------------------

var trainData = finalBalancedDataset.filter(ee.Filter.eq('Event_ID', 2629)); // TRAIN
var testData = finalBalancedDataset.filter(ee.Filter.eq('Event_ID', 4242));  // TEST

print('Training samples:', trainData.size()); // 28
print('Testing samples:', testData.size());   // 28

// ------------------------------------------------------------
// 2. TRAIN RANDOM FOREST (200 trees)
// ------------------------------------------------------------

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 200, variablesPerSplit: 2, minLeafPopulation: 2, bagFraction: 0.7, seed: 42
}).train({ features: trainData, classProperty: 'Flooded', inputProperties: featureBands });

// ------------------------------------------------------------
// 3. VALIDATE ON HELD-OUT EVENT
// ------------------------------------------------------------

var testPrediction = testData.classify(classifier);
var confusionMatrix = testPrediction.errorMatrix('Flooded', 'classification');

print('CONFUSION MATRIX:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());   // 0.8571 (85.71%)
print('Kappa:', confusionMatrix.kappa());                 // 0.7143

var cm = confusionMatrix.array();
var TP = ee.Number(cm.get([1, 1]));
var FP = ee.Number(cm.get([0, 1]));
var FN = ee.Number(cm.get([1, 0]));

var floodPrecision = TP.divide(TP.add(FP));
var floodRecall = TP.divide(TP.add(FN));
var floodF1 = floodPrecision.multiply(floodRecall).multiply(2).divide(floodPrecision.add(floodRecall));

print('Flood Precision:', floodPrecision); // 0.8571
print('Flood Recall:', floodRecall);       // 0.8571
print('Flood F1:', floodF1);               // 0.8571

var explanation = classifier.explain();
print('Feature importance:', ee.Dictionary(explanation.get('importance')));

var trainMatrix = trainData.classify(classifier).errorMatrix('Flooded', 'classification');
print('Training accuracy:', trainMatrix.accuracy()); // 0.9643

// ------------------------------------------------------------
// 4. APPLY MODEL TO CURRENT TASHKENT CONDITIONS
// ------------------------------------------------------------

var currentPrediction = currentFeatures.select(featureBands).classify(classifier).rename('Flooded');

var probabilityClassifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 200, variablesPerSplit: 2, minLeafPopulation: 2, bagFraction: 0.7, seed: 42
}).setOutputMode('MULTIPROBABILITY')
  .train({ features: trainData, classProperty: 'Flooded', inputProperties: featureBands });

var probabilityArray = currentFeatures.select(featureBands).classify(probabilityClassifier);
var floodProbability = probabilityArray.arrayGet([1]).rename('Flood_Probability');

// ------------------------------------------------------------
// 5. RISK CLASSIFICATION
// 0.00-0.20 Low | 0.20-0.40 Moderate | 0.40-0.60 High-ish | 0.60-0.80 High | 0.80-1.00 Very High
// ------------------------------------------------------------

var riskClass = floodProbability.expression(
  "(p < 0.20) ? 0 : (p < 0.40) ? 1 : (p < 0.60) ? 2 : (p < 0.80) ? 3 : 4",
  { p: floodProbability }
).rename('Flood_Risk_Class');

Map.addLayer(floodProbability, { min: 0, max: 1 }, 'Flood Probability');
Map.addLayer(riskClass, { min: 0, max: 4 }, 'Flood Risk Classes');

// ------------------------------------------------------------
// 6. RISK AREA STATISTICS
// ------------------------------------------------------------

var pixelArea = ee.Image.pixelArea();
var riskArea = pixelArea.addBands(riskClass).reduceRegion({
  reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'Risk_Class' }),
  geometry: tashkent, scale: 250, maxPixels: 1e13, bestEffort: true
});
print('Risk class area (m²):', riskArea);

var highRiskMask = riskClass.gte(2);
var highRiskArea = pixelArea.updateMask(highRiskMask).reduceRegion({
  reducer: ee.Reducer.sum(), geometry: tashkent, scale: 250, maxPixels: 1e13, bestEffort: true
});
print('High + Very High risk area (km²):', ee.Number(highRiskArea.get('area')).divide(1e6));
// -> 1,372.91 km²

// ------------------------------------------------------------
// 7. FINAL EXPORTS
// ------------------------------------------------------------

Export.image.toDrive({
  image: floodProbability.rename('Flood_Probability'),
  description: 'Tashkent_Current_Flood_Probability',
  folder: 'GEE_Flood_Results',
  region: tashkent, scale: 250, maxPixels: 1e13, fileFormat: 'GeoTIFF'
});

Export.image.toDrive({
  image: riskClass.rename('Flood_Risk_Class'),
  description: 'Tashkent_Current_Flood_Risk_Class',
  folder: 'GEE_Flood_Results',
  region: tashkent, scale: 250, maxPixels: 1e13, fileFormat: 'GeoTIFF'
});
