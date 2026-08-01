"""
Generates the two summary charts used in docs/ from the final GEE
model results (data/processed/final_results_summary.json):

  1. confusion_matrix.png  — temporal holdout validation result
  2. risk_area_summary.png — current high+very-high risk area vs. Tashkent total

Run:  python notebooks/generate_result_charts.py
"""

import json
import os
import matplotlib.pyplot as plt
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

with open(os.path.join(ROOT, "data", "processed", "final_results_summary.json")) as f:
    results = json.load(f)

os.makedirs(os.path.join(ROOT, "docs", "images"), exist_ok=True)

# ---------------------------------------------------------------
# 1. Confusion matrix
# ---------------------------------------------------------------

cm = results["validation"]["confusion_matrix"]
matrix = np.array([
    [cm["true_negative"], cm["false_positive"]],
    [cm["false_negative"], cm["true_positive"]],
])

fig, ax = plt.subplots(figsize=(5, 4.5))
im = ax.imshow(matrix, cmap="Blues")

labels = ["Non-flood", "Flood"]
ax.set_xticks([0, 1]); ax.set_xticklabels(labels)
ax.set_yticks([0, 1]); ax.set_yticklabels(labels)
ax.set_xlabel("Predicted")
ax.set_ylabel("Actual")
ax.set_title(
    f"Temporal Holdout Validation\nTrain: event {results['train_event_id']}  "
    f"|  Test: event {results['test_event_id']}\n"
    f"Accuracy: {results['validation']['overall_accuracy']*100:.2f}%  "
    f"|  Kappa: {results['validation']['kappa']:.3f}"
)

for i in range(2):
    for j in range(2):
        ax.text(j, i, str(matrix[i, j]), ha="center", va="center",
                fontsize=16, color="white" if matrix[i, j] > matrix.max() / 2 else "black")

fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
plt.tight_layout()
plt.savefig(os.path.join(ROOT, "docs", "images", "confusion_matrix.png"), dpi=150)
plt.close()

# ---------------------------------------------------------------
# 2. Risk area summary (approximate — total Tashkent AOI area from
#    a 25 km buffer is used only as an illustrative reference bar)
# ---------------------------------------------------------------

high_risk_km2 = results["current_prediction"]["high_plus_very_high_risk_area_km2"]
aoi_radius_km = 25
approx_aoi_km2 = np.pi * aoi_radius_km ** 2  # ~1963 km^2, illustrative only

fig, ax = plt.subplots(figsize=(5, 4))
bars = ax.bar(
    ["Study area\n(~25 km radius)", "High + Very High\nflood risk"],
    [approx_aoi_km2, high_risk_km2],
    color=["#c9d6e3", "#d1495b"]
)
for bar in bars:
    h = bar.get_height()
    ax.text(bar.get_x() + bar.get_width() / 2, h + 20, f"{h:,.0f} km²",
            ha="center", va="bottom", fontsize=10)

ax.set_ylabel("Area (km²)")
ax.set_title("Current High + Very High Flood Risk Area\n(2025 conditions)")
plt.tight_layout()
plt.savefig(os.path.join(ROOT, "docs", "images", "risk_area_summary.png"), dpi=150)
plt.close()

print("Charts written to docs/images/")
