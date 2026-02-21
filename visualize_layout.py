# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "matplotlib",
# ]
# ///
"""Visualize the force-directed graph layout from data.json."""

import json
import matplotlib.pyplot as plt
import matplotlib.collections as mc
import numpy as np

with open("website/public/data.json", encoding="utf-8") as f:
    data = json.load(f)

nodes = data["nodes"]
edges = data["edges"]

xs = np.array([n["x"] for n in nodes])
ys = np.array([n["y"] for n in nodes])

print(f"Nodes: {len(nodes)}")
print(f"Edges: {len(edges)}")
print(f"X range: [{xs.min():.1f}, {xs.max():.1f}]")
print(f"Y range: [{ys.min():.1f}, {ys.max():.1f}]")
print(f"X std: {xs.std():.1f}, Y std: {ys.std():.1f}")
print(f"Any NaN: {np.any(np.isnan(xs)) or np.any(np.isnan(ys))}")
print(f"Any Inf: {np.any(np.isinf(xs)) or np.any(np.isinf(ys))}")

# Compute degrees
degrees = np.zeros(len(nodes), dtype=int)
for src, tgt, ty in edges:
    degrees[src] += 1
    degrees[tgt] += 1
max_degree = degrees.max()
print(f"Max degree: {max_degree}")

# Check isolated nodes
isolated = np.sum(degrees == 0)
deg1 = np.sum(degrees == 1)
print(f"Isolated (degree 0): {isolated}, Degree 1: {deg1}")

# Check overlapping nodes
from collections import Counter
rounded = Counter((round(float(x), 1), round(float(y), 1)) for x, y in zip(xs, ys))
overlaps = sum(1 for c in rounded.values() if c > 1)
print(f"Positions with >1 node at same rounded coord: {overlaps}")

# Nearest-neighbor distance stats
from itertools import combinations
# Quick pairwise: just sample for speed
dists = []
for i in range(min(500, len(nodes))):
    for j in range(i+1, min(500, len(nodes))):
        d = np.sqrt((xs[i]-xs[j])**2 + (ys[i]-ys[j])**2)
        dists.append(d)
dists = np.array(dists)
print(f"Pairwise distance (sample): min={dists.min():.2f}, median={np.median(dists):.1f}, mean={dists.mean():.1f}")

# Edge length stats
edge_lens = []
for src, tgt, ty in edges:
    d = np.sqrt((xs[src]-xs[tgt])**2 + (ys[src]-ys[tgt])**2)
    edge_lens.append(d)
edge_lens = np.array(edge_lens)
print(f"Edge lengths: min={edge_lens.min():.1f}, median={np.median(edge_lens):.1f}, mean={edge_lens.mean():.1f}, max={edge_lens.max():.1f}")

# Edge colors
edge_colors_map = {0: (0.8, 0.2, 0.2, 0.12), 1: (0.2, 0.8, 0.2, 0.12), 2: (0.3, 0.3, 0.9, 0.12)}

fig, axes = plt.subplots(1, 3, figsize=(30, 10))

# Left: full graph with edges
ax = axes[0]
ax.set_title(f"Full Layout ({len(nodes)} nodes, {len(edges)} edges)")
ax.set_facecolor("#111111")
ax.set_aspect("equal")

lines = []
colors = []
for src, tgt, ty in edges:
    lines.append([(xs[src], ys[src]), (xs[tgt], ys[tgt])])
    colors.append(edge_colors_map.get(ty, (0.5, 0.5, 0.5, 0.1)))
lc = mc.LineCollection(lines, colors=colors, linewidths=0.3)
ax.add_collection(lc)

sizes = 2 + (degrees / max_degree) * 30
hues = np.array([hash(str(i)) % 360 for i in range(len(nodes))])
node_colors = plt.cm.hsv(hues / 360)
node_colors[:, 3] = 0.8
ax.scatter(xs, ys, s=sizes, c=node_colors, edgecolors="none", zorder=2)
ax.autoscale_view()

# Middle: zoomed to core (within 2 std devs)
ax2 = axes[1]
cx, cy = xs.mean(), ys.mean()
radius = 2.0 * max(xs.std(), ys.std())
ax2.set_title(f"Core (2σ zoom)")
ax2.set_facecolor("#111111")
ax2.set_aspect("equal")
ax2.set_xlim(cx - radius, cx + radius)
ax2.set_ylim(cy - radius, cy + radius)

# Only draw edges within view
lines2 = []
colors2 = []
for src, tgt, ty in edges:
    if (abs(xs[src] - cx) < radius and abs(ys[src] - cy) < radius and
        abs(xs[tgt] - cx) < radius and abs(ys[tgt] - cy) < radius):
        lines2.append([(xs[src], ys[src]), (xs[tgt], ys[tgt])])
        colors2.append(edge_colors_map.get(ty, (0.5, 0.5, 0.5, 0.1)))
lc2 = mc.LineCollection(lines2, colors=colors2, linewidths=0.4)
ax2.add_collection(lc2)

mask = (np.abs(xs - cx) < radius) & (np.abs(ys - cy) < radius)
ax2.scatter(xs[mask], ys[mask], s=sizes[mask], c=node_colors[mask], edgecolors="none", zorder=2)

# Label top 30 degree nodes in core
sorted_by_degree = np.argsort(degrees)[::-1]
labeled = 0
for i in sorted_by_degree:
    if mask[i] and labeled < 30:
        ax2.annotate(nodes[i]["label"], (xs[i], ys[i]),
                     fontsize=5, color="white", ha="center", va="bottom",
                     textcoords="offset points", xytext=(0, 3))
        labeled += 1

# Right: degree-colored
ax3 = axes[2]
ax3.set_title("Degree heatmap")
ax3.set_facecolor("#111111")
ax3.set_aspect("equal")
scatter = ax3.scatter(xs, ys, s=sizes, c=degrees, cmap="plasma", edgecolors="none", zorder=2)
plt.colorbar(scatter, ax=ax3, label="Degree")

# Label top 15
for i in sorted_by_degree[:15]:
    ax3.annotate(nodes[i]["label"], (xs[i], ys[i]),
                 fontsize=6, color="white", ha="center", va="bottom",
                 textcoords="offset points", xytext=(0, 4))
ax3.autoscale_view()

plt.tight_layout()
plt.savefig("layout_visualization.png", dpi=150, facecolor="#222222")
print("\nSaved layout_visualization.png")
plt.close()
