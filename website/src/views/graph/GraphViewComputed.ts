/**
 * Pure computation functions extracted from GraphCanvas useMemo hooks.
 * These are standalone, testable functions with explicit parameters.
 */

import {
  EdgeType,
  nodeColour,
  nodeIdToInt,
  type NodeData,
  type EdgeData,
} from "../../data";
import {
  derivativeColour,
  fusionGenreColour,
  subgenreColour,
  type VisibleTypes,
} from "../../settings";
import type { PathInfo } from "./pathInfo";
import {
  EDGE_SELECTED_SATURATION,
  EDGE_UNSELECTED_SATURATION,
  EDGE_SELECTED_ALPHA,
  EDGE_UNSELECTED_ALPHA,
  EDGE_OPACITY_FALLOFF,
  NODE_SIZE_BASE,
  NODE_SIZE_MIN_FRAC,
  NODE_SIZE_DEGREE_FRAC,
  NODE_SHRINK_UNSELECTED,
  NODE_GROW_FOCUSED,
  NODE_GROW_HOVERED,
  NODE_DIM_RGB,
  NODE_DIM_ALPHA,
  NODE_OPACITY_FALLOFF,
  ARROW_SPEED_FALLOFF,
} from "./graphConstants";

/** Parse a CSS color string to RGBA floats [0..1]. */
export function parseColor(css: string): [number, number, number, number] {
  // Handle hsla/hsl
  const hslaMatch = css.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (hslaMatch) {
    const h = parseFloat(hslaMatch[1]);
    const s = parseFloat(hslaMatch[2]) / 100;
    const l = parseFloat(hslaMatch[3]) / 100;
    const a = hslaMatch[4] !== undefined ? parseFloat(hslaMatch[4]) : 1;
    return [...hslToRgb(h, s, l), a];
  }

  // Handle rgba/rgb
  const rgbaMatch = css.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    return [
      parseFloat(rgbaMatch[1]) / 255,
      parseFloat(rgbaMatch[2]) / 255,
      parseFloat(rgbaMatch[3]) / 255,
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    ];
  }

  // Handle hex
  if (css.startsWith("#")) {
    const hex = css.slice(1);
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16) / 255,
        parseInt(hex.slice(2, 4), 16) / 255,
        parseInt(hex.slice(4, 6), 16) / 255,
        1,
      ];
    }
  }

  return [1, 1, 1, 1];
}

/** Convert HSL to RGB [0..1]. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [r + m, g + m, b + m];
}

/** Precompute flat node positions (x, y pairs). */
export function computeNodePositions(nodes: NodeData[]): Float32Array {
  const arr = new Float32Array(nodes.length * 2);
  for (let i = 0; i < nodes.length; i++) {
    arr[i * 2] = nodes[i].x;
    arr[i * 2 + 1] = nodes[i].y;
  }
  return arr;
}

/** Precompute flat edge positions (srcX, srcY, tgtX, tgtY per edge). */
export function computeEdgePositions(
  edges: EdgeData[],
  nodePositions: Float32Array
): Float32Array {
  const arr = new Float32Array(edges.length * 4);
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const si = nodeIdToInt(edge.source);
    const ti = nodeIdToInt(edge.target);
    arr[i * 4] = nodePositions[si * 2];
    arr[i * 4 + 1] = nodePositions[si * 2 + 1];
    arr[i * 4 + 2] = nodePositions[ti * 2];
    arr[i * 4 + 3] = nodePositions[ti * 2 + 1];
  }
  return arr;
}

/** Precompute per-edge source/target node indices. */
export function computeEdgeNodeIndices(edges: EdgeData[]): {
  src: Int32Array;
  tgt: Int32Array;
} {
  const src = new Int32Array(edges.length);
  const tgt = new Int32Array(edges.length);
  for (let i = 0; i < edges.length; i++) {
    src[i] = nodeIdToInt(edges[i].source);
    tgt[i] = nodeIdToInt(edges[i].target);
  }
  return { src, tgt };
}

/** Determine if a node is highlighted due to the current selection. */
export function isHighlightedDueToSelection(
  nodeId: string,
  selectedId: string | null,
  pathInfo: PathInfo,
  maxDistance: number,
  path: string[] | null,
  directional: boolean
): boolean {
  if (!selectedId) return false;
  const isSelected = nodeId === selectedId;
  const isImmediateNeighbour = pathInfo.immediateNeighbours.has(nodeId);
  const isInPath =
    directional &&
    (pathInfo.nodeDistances.get(nodeId) || Number.POSITIVE_INFINITY) <
      maxDistance;
  const isInDirectionalPath = path?.includes(nodeId);
  return path !== null
    ? !!isInDirectionalPath
    : isSelected || isImmediateNeighbour || isInPath;
}

/**
 * Compute node colors -- distance-based opacity when a node is selected.
 * Distance 0 (selected) and 1 (immediate neighbours) are fully visible;
 * further distances fade aggressively via opacity.
 */
export function computeNodeColors(
  nodes: NodeData[],
  selectedId: string | null,
  hoveredId: string | null,
  maxDegree: number,
  graphNodeLightness: number,
  pathInfo: PathInfo,
  maxDistance: number,
  path: string[] | null,
  theme: string
): Float32Array {
  const arr = new Float32Array(nodes.length * 4);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isHovered = hoveredId === node.id;

    const [r, g, b] = parseColor(
      nodeColour(node, maxDegree, graphNodeLightness)
    );

    if (selectedId && !isHovered) {
      if (
        isHighlightedDueToSelection(
          node.id,
          selectedId,
          pathInfo,
          maxDistance,
          path,
          true
        )
      ) {
        const dist = path?.includes(node.id)
          ? 0
          : node.id === selectedId
            ? 0
            : pathInfo.immediateNeighbours.has(node.id) &&
                !pathInfo.nodeDistances.has(node.id)
              ? 1
              : (pathInfo.nodeDistances.get(node.id) ?? maxDistance);
        // dist 0-1: full opacity; beyond that: exponential falloff
        const alpha =
          dist <= 1 ? 1.0 : Math.pow(NODE_OPACITY_FALLOFF, dist - 1);
        arr[i * 4] = r;
        arr[i * 4 + 1] = g;
        arr[i * 4 + 2] = b;
        arr[i * 4 + 3] = alpha;
      } else {
        if (theme === "light") {
          // Fade toward white on light background
          arr[i * 4] = r * NODE_DIM_RGB + (1 - NODE_DIM_RGB);
          arr[i * 4 + 1] = g * NODE_DIM_RGB + (1 - NODE_DIM_RGB);
          arr[i * 4 + 2] = b * NODE_DIM_RGB + (1 - NODE_DIM_RGB);
        } else {
          // Fade toward black on dark background
          arr[i * 4] = r * NODE_DIM_RGB;
          arr[i * 4 + 1] = g * NODE_DIM_RGB;
          arr[i * 4 + 2] = b * NODE_DIM_RGB;
        }
        arr[i * 4 + 3] = NODE_DIM_ALPHA;
      }
    } else {
      arr[i * 4] = r;
      arr[i * 4 + 1] = g;
      arr[i * 4 + 2] = b;
      arr[i * 4 + 3] = 1.0;
    }
  }
  return arr;
}

/** Compute node sizes (in world units). */
export function computeNodeSizes(
  nodes: NodeData[],
  maxDegree: number,
  selectedId: string | null,
  focusedId: string | null,
  hoveredId: string | null,
  pathInfo: PathInfo,
  maxDistance: number,
  path: string[] | null
): Float32Array {
  const arr = new Float32Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let size =
      NODE_SIZE_BASE *
      (NODE_SIZE_MIN_FRAC +
        (node.edges.length / maxDegree) * NODE_SIZE_DEGREE_FRAC);

    // Shrink if not highlighted when something is selected
    if (
      selectedId &&
      !isHighlightedDueToSelection(
        node.id,
        selectedId,
        pathInfo,
        maxDistance,
        path,
        true
      )
    ) {
      size -= NODE_SHRINK_UNSELECTED;
    }

    // Grow if focused
    if (focusedId === node.id) {
      size += NODE_GROW_FOCUSED;
    }

    // Grow if hovered
    if (hoveredId === node.id) {
      size += NODE_GROW_HOVERED;
    }

    arr[i] = Math.max(size, 1.0);
  }
  return arr;
}

/** Compute edge colors (4 RGBA components * 2 vertices per edge). */
export function computeEdgeColors(
  edges: EdgeData[],
  selectedId: string | null,
  hoveredId: string | null,
  visibleTypes: VisibleTypes,
  pathInfo: PathInfo,
  maxDistance: number,
  path: string[] | null,
  theme: string
): Float32Array {
  const arr = new Float32Array(edges.length * 8); // 4 components * 2 vertices
  const dimmedColor = parseColor(
    theme === "light" ? "hsla(0, 0%, 80%, 0.1)" : "hsla(0, 0%, 20%, 0.1)"
  );

  const selectedAlpha = EDGE_SELECTED_ALPHA;
  // Reduce unselected edge visibility on light backgrounds where they're more prominent
  const unselectedAlpha =
    theme === "light" ? EDGE_UNSELECTED_ALPHA * 0.6 : EDGE_UNSELECTED_ALPHA;

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    let color: [number, number, number, number];

    if (!visibleTypes[edge.ty]) {
      color = [0, 0, 0, 0];
    } else {
      const edgeColour = (saturation: number, alpha: number) =>
        parseColor(
          edge.ty === EdgeType.Derivative
            ? derivativeColour(saturation, alpha)
            : edge.ty === EdgeType.Subgenre
              ? subgenreColour(saturation, alpha)
              : fusionGenreColour(saturation, alpha)
        );

      const isHoveredEdge =
        hoveredId && (edge.source === hoveredId || edge.target === hoveredId);

      if (selectedId) {
        if (path) {
          const sourceIndex = path.indexOf(edge.source);
          const targetIndex = path.indexOf(edge.target);
          if (
            sourceIndex !== -1 &&
            targetIndex !== -1 &&
            Math.abs(sourceIndex - targetIndex) === 1
          ) {
            color = edgeColour(EDGE_SELECTED_SATURATION, selectedAlpha);
          } else if (isHoveredEdge) {
            color = edgeColour(EDGE_SELECTED_SATURATION, selectedAlpha * 0.8);
          } else {
            color = dimmedColor;
          }
        } else if (edge.source === selectedId || edge.target === selectedId) {
          // Direct edges from/to selected node: full visibility
          color = edgeColour(EDGE_SELECTED_SATURATION, selectedAlpha);
        } else {
          const distance = pathInfo.edgeDistances.get(edge);
          if (distance !== undefined && distance < maxDistance) {
            // distance 1 = immediate neighbour edges (full), beyond = falloff
            const alpha =
              distance <= 1
                ? selectedAlpha
                : selectedAlpha * Math.pow(EDGE_OPACITY_FALLOFF, distance - 1);
            color = edgeColour(EDGE_SELECTED_SATURATION, alpha);
          } else if (isHoveredEdge) {
            color = edgeColour(EDGE_SELECTED_SATURATION, selectedAlpha * 0.8);
          } else {
            color = dimmedColor;
          }
        }
      } else if (isHoveredEdge) {
        color = edgeColour(EDGE_SELECTED_SATURATION, selectedAlpha * 0.8);
      } else {
        color = edgeColour(EDGE_UNSELECTED_SATURATION, unselectedAlpha);
      }
    }

    // Same color for both vertices of the line segment
    arr[i * 8] = color[0];
    arr[i * 8 + 1] = color[1];
    arr[i * 8 + 2] = color[2];
    arr[i * 8 + 3] = color[3];
    arr[i * 8 + 4] = color[0];
    arr[i * 8 + 5] = color[1];
    arr[i * 8 + 6] = color[2];
    arr[i * 8 + 7] = color[3];
  }
  return arr;
}

/** Compute per-edge width scales (2x for path edges). */
export function computeEdgeWidthScales(
  edges: EdgeData[],
  path: string[] | null
): Float32Array {
  const arr = new Float32Array(edges.length);
  arr.fill(1.0);
  if (path) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const sourceIndex = path.indexOf(edge.source);
      const targetIndex = path.indexOf(edge.target);
      if (
        sourceIndex !== -1 &&
        targetIndex !== -1 &&
        Math.abs(sourceIndex - targetIndex) === 1
      ) {
        arr[i] = 2.0;
      }
    }
  }
  return arr;
}

/**
 * Compute the stable arrow geometry for the selected net
 * (does not change on hover).
 */
export function computeNetArrowGeometry(
  edges: EdgeData[],
  visibleTypes: VisibleTypes,
  selectedId: string | null,
  pathInfo: PathInfo,
  maxDistance: number,
  path: string[] | null
): Map<number, number> {
  const netEdges = new Map<number, number>();
  if (selectedId) {
    for (let i = 0; i < edges.length; i++) {
      if (!visibleTypes[edges[i].ty]) continue;
      const edge = edges[i];
      if (path) {
        const sourceIndex = path.indexOf(edge.source);
        const targetIndex = path.indexOf(edge.target);
        if (
          sourceIndex !== -1 &&
          targetIndex !== -1 &&
          Math.abs(sourceIndex - targetIndex) === 1
        ) {
          netEdges.set(i, 0);
        }
      } else if (edge.source === selectedId || edge.target === selectedId) {
        netEdges.set(i, 0);
      } else {
        const distance = pathInfo.edgeDistances.get(edge);
        if (distance !== undefined && distance < maxDistance) {
          netEdges.set(i, distance);
        }
      }
    }
  }
  return netEdges;
}

/** Return type for {@link computeArrowGeometry}. */
export type ArrowGeometry = {
  targets: Float32Array;
  directions: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  targetNodeIndices: number[];
  edgeIndices: number[];
  netArrowCount: number;
  hoverColors: Float32Array;
};

/**
 * Combined arrow geometry: stable net arrows first, then hover arrows appended.
 */
export function computeArrowGeometry(
  edges: EdgeData[],
  nodePositions: Float32Array,
  visibleTypes: VisibleTypes,
  hoveredId: string | null,
  netArrowGeometry: Map<number, number>
): ArrowGeometry {
  // Build hover edges (not already in selected net)
  const hoverEdges: number[] = [];
  if (hoveredId) {
    for (let i = 0; i < edges.length; i++) {
      if (!visibleTypes[edges[i].ty]) continue;
      if (netArrowGeometry.has(i)) continue;
      const edge = edges[i];
      if (edge.source === hoveredId || edge.target === hoveredId) {
        hoverEdges.push(i);
      }
    }
  }

  const netCount = netArrowGeometry.size;
  const totalInstances = netCount + hoverEdges.length;

  const targets = new Float32Array(totalInstances * 2);
  const directions = new Float32Array(totalInstances * 2);
  const phases = new Float32Array(totalInstances);
  const speeds = new Float32Array(totalInstances);
  const targetNodeIndices: number[] = [];
  const edgeIndices: number[] = [];

  // Fill net arrows first (stable portion)
  let j = 0;
  for (const [i, dist] of netArrowGeometry) {
    const edge = edges[i];
    const ti = nodeIdToInt(edge.target);
    const si = nodeIdToInt(edge.source);
    const tx = nodePositions[ti * 2];
    const ty = nodePositions[ti * 2 + 1];
    targets[j * 2] = tx;
    targets[j * 2 + 1] = ty;
    directions[j * 2] = tx - nodePositions[si * 2];
    directions[j * 2 + 1] = ty - nodePositions[si * 2 + 1];
    phases[j] = (j * 0.6180339887) % 1.0;
    speeds[j] = dist <= 1 ? 1.0 : Math.pow(ARROW_SPEED_FALLOFF, dist - 1);
    targetNodeIndices.push(ti);
    edgeIndices.push(i);
    j++;
  }

  // Append hover arrows and precompute their type-based colors
  const hoverColors = new Float32Array(hoverEdges.length * 4);
  for (let hi = 0; hi < hoverEdges.length; hi++) {
    const i = hoverEdges[hi];
    const edge = edges[i];
    const ti = nodeIdToInt(edge.target);
    const si = nodeIdToInt(edge.source);
    const tx = nodePositions[ti * 2];
    const ty = nodePositions[ti * 2 + 1];
    targets[j * 2] = tx;
    targets[j * 2 + 1] = ty;
    directions[j * 2] = tx - nodePositions[si * 2];
    directions[j * 2 + 1] = ty - nodePositions[si * 2 + 1];
    phases[j] = (hi * 0.6180339887) % 1.0;
    speeds[j] = 1.0;
    targetNodeIndices.push(ti);
    edgeIndices.push(i);

    const hoverAlpha = EDGE_SELECTED_ALPHA * 0.8;
    const color = parseColor(
      edge.ty === EdgeType.Derivative
        ? derivativeColour(EDGE_SELECTED_SATURATION, hoverAlpha)
        : edge.ty === EdgeType.Subgenre
          ? subgenreColour(EDGE_SELECTED_SATURATION, hoverAlpha)
          : fusionGenreColour(EDGE_SELECTED_SATURATION, hoverAlpha)
    );
    hoverColors[hi * 4] = color[0];
    hoverColors[hi * 4 + 1] = color[1];
    hoverColors[hi * 4 + 2] = color[2];
    hoverColors[hi * 4 + 3] = color[3];
    j++;
  }

  return {
    targets,
    directions,
    phases,
    speeds,
    targetNodeIndices,
    edgeIndices,
    netArrowCount: netCount,
    hoverColors,
  };
}
