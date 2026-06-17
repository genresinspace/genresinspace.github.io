# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "matplotlib",
# ]
# ///
"""Render a single large, labeled view of the connected core for judging how
well similar genres group spatially. Usage: uv run eval_core.py [data.json] [out.png]"""

import json
import sys
import colorsys
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.collections as mc

data_path = sys.argv[1] if len(sys.argv) > 1 else "website/public/data.json"
out_path = sys.argv[2] if len(sys.argv) > 2 else "eval_core.png"

with open(data_path, encoding="utf-8") as f:
    data = json.load(f)
nodes, edges = data["nodes"], data["edges"]
xs = np.array([n["x"] for n in nodes])
ys = np.array([n["y"] for n in nodes])

degrees = np.zeros(len(nodes), dtype=int)
for src, tgt, ty in edges:
    degrees[src] += 1
    degrees[tgt] += 1

conn = degrees > 0
cx, cy = xs[conn].mean(), ys[conn].mean()
radius = 2.2 * max(xs[conn].std(), ys[conn].std())

hues = np.array([n.get("hue", 0.0) for n in nodes])
node_colors = np.array([colorsys.hsv_to_rgb((h % 360) / 360, 0.7, 1.0) + (0.9,) for h in hues])
max_deg = degrees.max()
sizes = 10 + (degrees / max_deg) * 120

fig, ax = plt.subplots(figsize=(16, 16))
ax.set_facecolor("#0a0a12")
ax.set_aspect("equal")
ax.set_xlim(cx - radius, cx + radius)
ax.set_ylim(cy - radius, cy + radius)

lines, colors = [], []
for src, tgt, ty in edges:
    if (abs(xs[src] - cx) < radius and abs(ys[src] - cy) < radius and
            abs(xs[tgt] - cx) < radius and abs(ys[tgt] - cy) < radius):
        lines.append([(xs[src], ys[src]), (xs[tgt], ys[tgt])])
        h = hues[src]
        colors.append(colorsys.hsv_to_rgb((h % 360) / 360, 0.6, 0.9) + (0.06,))
ax.add_collection(mc.LineCollection(lines, colors=colors, linewidths=0.4))

mask = (np.abs(xs - cx) < radius) & (np.abs(ys - cy) < radius)
ax.scatter(xs[mask], ys[mask], s=sizes[mask], c=node_colors[mask], edgecolors="none", zorder=2)

for i in np.argsort(degrees)[::-1][:70]:
    if mask[i]:
        ax.annotate(nodes[i]["label"], (xs[i], ys[i]), fontsize=7, color="white",
                    ha="center", va="bottom", textcoords="offset points", xytext=(0, 3),
                    zorder=3)

ax.set_xticks([]); ax.set_yticks([])
plt.tight_layout()
plt.savefig(out_path, dpi=120, facecolor="#0a0a12")
print(f"Saved {out_path}")
