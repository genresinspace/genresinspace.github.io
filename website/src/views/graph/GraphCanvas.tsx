/** React component wrapping the WebGL graph renderer. */

import { useEffect, useRef, useCallback, useMemo } from "react";

import { EdgeType, nodeColour, nodeIdToInt, useDataContext } from "../../data";
import {
  derivativeColour,
  fusionGenreColour,
  SettingsData,
  subgenreColour,
} from "../../settings";
import { useTheme } from "../../theme";

import type { Camera } from "./Camera";
import { WebGLRenderer } from "./WebGLRenderer";
import { hitTestNode, HOVER_HIT_BUFFER } from "./HitTest";
import { InteractionHandler } from "./Interaction";
import { PathInfo } from "./pathInfo";
import {
  EDGE_CURVATURE,
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
  NODE_LIGHTNESS_LIGHT,
  NODE_LIGHTNESS_DARK,
  ARROW_SIZE_MULTIPLIER,
  ARROW_SPEED_FALLOFF,
  TRANSITION_TAU,
  HOVER_DEBOUNCE_MS,
  BG_LIGHT,
  BG_DARK,
  FIT_STDDEV_MULT,
  FIT_RADIUS_MIN,
  FIT_PADDING_FRAC,
  FIT_ANIM_DURATION,
  CURSOR_PROXIMITY_RADIUS,
} from "./graphConstants";

/** Parse a CSS color string to RGBA floats [0..1]. */
function parseColor(css: string): [number, number, number, number] {
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

/** React component wrapping the WebGL graph renderer. */
export function GraphCanvas({
  settings,
  selectedId,
  setSelectedId,
  focusedId,
  hoveredId,
  setHoveredId,
  pathInfo,
  path,
  viewportOffsetX,
  viewportOffsetY,
  camera,
  onCameraChange,
  cursorWorldRef,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  pathInfo: PathInfo;
  path: string[] | null;
  viewportOffsetX: number;
  viewportOffsetY: number;
  camera: Camera;
  onCameraChange: () => void;
  cursorWorldRef: React.RefObject<{ x: number; y: number }>;
}) {
  const data = useDataContext();
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const interactionRef = useRef<InteractionHandler | null>(null);
  const animFrameRef = useRef<number>(0);

  // Stable refs for current state (avoid re-creating interaction handler)
  const stateRef = useRef({
    selectedId,
    hoveredId,
    path: path as string[] | null,
    positions: null as Float32Array | null,
    sizes: null as Float32Array | null,
    theme: theme as string,
    arrowSizeScale: settings.general.arrowSizeScale,
    curvedEdges: settings.general.curvedEdges,
    // Target arrays for smooth transitions
    targetNodeColors: null as Float32Array | null,
    targetEdgeColors: null as Float32Array | null,
    targetNodeSizes: null as Float32Array | null,
    arrowGeom: null as {
      targets: Float32Array;
      directions: Float32Array;
      phases: Float32Array;
      speeds: Float32Array;
      targetNodeIndices: number[];
      edgeIndices: number[];
      netArrowCount: number;
      hoverColors: Float32Array;
    } | null,
    edgeNodeIndices: null as {
      src: Int32Array;
      tgt: Int32Array;
    } | null,
    edgeCount: 0,
    cursorWorldX: 0,
    cursorWorldY: 0,
  });
  stateRef.current.selectedId = selectedId;
  stateRef.current.hoveredId = hoveredId;
  stateRef.current.path = path;
  stateRef.current.theme = theme;
  stateRef.current.arrowSizeScale = settings.general.arrowSizeScale;
  stateRef.current.curvedEdges = settings.general.curvedEdges;

  // Interpolated state for smooth transitions
  const interpRef = useRef({
    nodeColors: null as Float32Array | null,
    edgeColors: null as Float32Array | null,
    nodeSizes: null as Float32Array | null,
    arrowColors: null as Float32Array | null,
    arrowTargetSizes: null as Float32Array | null,
    edgeSrcNodeColors: null as Float32Array | null,
    edgeTgtNodeColors: null as Float32Array | null,
    nodeSelected: null as Float32Array | null,
    prevSelectedId: null as string | null,
    lastTime: 0,
  });

  const maxDegree = data.max_degree;
  // Graph-specific node lightness: brighter on light mode's darker charcoal bg
  const graphNodeLightness =
    theme === "light" ? NODE_LIGHTNESS_LIGHT : NODE_LIGHTNESS_DARK;

  // Precompute node positions (flat Float32Array)
  const nodePositions = useMemo(() => {
    const arr = new Float32Array(data.nodes.length * 2);
    for (let i = 0; i < data.nodes.length; i++) {
      arr[i * 2] = data.nodes[i].x;
      arr[i * 2 + 1] = data.nodes[i].y;
    }
    return arr;
  }, [data.nodes]);

  // Precompute edge positions
  const edgePositions = useMemo(() => {
    const arr = new Float32Array(data.edges.length * 4);
    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i];
      const si = nodeIdToInt(edge.source);
      const ti = nodeIdToInt(edge.target);
      arr[i * 4] = nodePositions[si * 2];
      arr[i * 4 + 1] = nodePositions[si * 2 + 1];
      arr[i * 4 + 2] = nodePositions[ti * 2];
      arr[i * 4 + 3] = nodePositions[ti * 2 + 1];
    }
    return arr;
  }, [data.edges, nodePositions]);

  // Precompute per-edge source/target node indices for endpoint tinting
  const edgeNodeIndices = useMemo(() => {
    const src = new Int32Array(data.edges.length);
    const tgt = new Int32Array(data.edges.length);
    for (let i = 0; i < data.edges.length; i++) {
      src[i] = nodeIdToInt(data.edges[i].source);
      tgt[i] = nodeIdToInt(data.edges[i].target);
    }
    return { src, tgt };
  }, [data.edges]);

  const maxDistance = settings.general.maxInfluenceDistance + 1;

  // Determine if a node is highlighted due to selection
  const isHighlightedDueToSelection = useCallback(
    (nodeId: string, includePath: boolean) => {
      if (!selectedId) return false;
      const isSelected = nodeId === selectedId;
      const isImmediateNeighbour = pathInfo.immediateNeighbours.has(nodeId);
      const isInPath =
        includePath &&
        (pathInfo.nodeDistances.get(nodeId) || Number.POSITIVE_INFINITY) <
          maxDistance;
      const isInDirectionalPath = path?.includes(nodeId);
      return path !== null
        ? !!isInDirectionalPath
        : isSelected || isImmediateNeighbour || isInPath;
    },
    [selectedId, pathInfo, maxDistance, path]
  );

  // Compute node colors — distance-based opacity when a node is selected.
  // Distance 0 (selected) and 1 (immediate neighbours) are fully visible;
  // further distances fade aggressively via opacity.
  const nodeColors = useMemo(() => {
    const arr = new Float32Array(data.nodes.length * 4);
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      const isHovered = hoveredId === node.id;

      const [r, g, b] = parseColor(
        nodeColour(node, maxDegree, graphNodeLightness)
      );

      if (selectedId && !isHovered) {
        if (isHighlightedDueToSelection(node.id, true)) {
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
  }, [
    data.nodes,
    selectedId,
    hoveredId,
    maxDegree,
    graphNodeLightness,
    isHighlightedDueToSelection,
    pathInfo,
    maxDistance,
    theme,
  ]);

  // Compute node sizes (in world units — shader multiplies by zoom)
  const nodeSizes = useMemo(() => {
    const arr = new Float32Array(data.nodes.length);
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      let size =
        NODE_SIZE_BASE *
        (NODE_SIZE_MIN_FRAC +
          (node.edges.length / maxDegree) * NODE_SIZE_DEGREE_FRAC);

      // Shrink if not highlighted when something is selected
      if (selectedId && !isHighlightedDueToSelection(node.id, true)) {
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
  }, [
    data.nodes,
    maxDegree,
    selectedId,
    focusedId,
    hoveredId,
    isHighlightedDueToSelection,
  ]);
  stateRef.current.sizes = nodeSizes;

  // Compute edge colors
  const edgeColors = useMemo(() => {
    const arr = new Float32Array(data.edges.length * 8); // 4 components * 2 vertices
    const dimmedColor = parseColor(
      theme === "light" ? "hsla(0, 0%, 80%, 0.1)" : "hsla(0, 0%, 20%, 0.1)"
    );

    const selectedAlpha = EDGE_SELECTED_ALPHA;
    // Reduce unselected edge visibility on light backgrounds where they're more prominent
    const unselectedAlpha =
      theme === "light" ? EDGE_UNSELECTED_ALPHA * 0.6 : EDGE_UNSELECTED_ALPHA;

    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i];
      let color: [number, number, number, number];

      if (!settings.visibleTypes[edge.ty]) {
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
                  : selectedAlpha *
                    Math.pow(EDGE_OPACITY_FALLOFF, distance - 1);
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
  }, [
    data.edges,
    selectedId,
    hoveredId,
    settings.visibleTypes,
    pathInfo,
    maxDistance,
    path,
    theme,
  ]);

  // Precompute arrow geometry — expands animated edges into multiple instances
  // Stable arrow geometry for selected net (doesn't change on hover)
  const netArrowGeometry = useMemo(() => {
    const netEdges = new Map<number, number>();
    if (selectedId) {
      for (let i = 0; i < data.edges.length; i++) {
        if (!settings.visibleTypes[data.edges[i].ty]) continue;
        const edge = data.edges[i];
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
  }, [data.edges, settings.visibleTypes, selectedId, pathInfo, path]);

  // Combined arrow geometry: stable net arrows first, then hover arrows appended
  const arrowGeometry = useMemo(() => {
    // Build hover edges (not already in selected net)
    const hoverEdges: number[] = [];
    if (hoveredId) {
      for (let i = 0; i < data.edges.length; i++) {
        if (!settings.visibleTypes[data.edges[i].ty]) continue;
        if (netArrowGeometry.has(i)) continue;
        const edge = data.edges[i];
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
      const edge = data.edges[i];
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
      const edge = data.edges[i];
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
  }, [
    data.edges,
    nodePositions,
    settings.visibleTypes,
    hoveredId,
    netArrowGeometry,
  ]);

  // Store target arrays for the render loop's interpolation
  stateRef.current.targetNodeColors = nodeColors;
  stateRef.current.targetEdgeColors = edgeColors;
  stateRef.current.targetNodeSizes = nodeSizes;
  stateRef.current.arrowGeom = arrowGeometry;
  stateRef.current.edgeNodeIndices = edgeNodeIndices;
  stateRef.current.edgeCount = data.edges.length;

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.error("WebGL2 not supported");
      return;
    }

    const renderer = new WebGLRenderer(gl);
    rendererRef.current = renderer;

    // Size canvas
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, canvas.width, canvas.height);
      camera.setCanvasSize(canvas.width, canvas.height);
      onCameraChange();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // Upload static positions
    renderer.setNodePositions(nodePositions);
    renderer.setEdgePositions(edgePositions);
    renderer.initNodeSelected(data.nodes.length);

    // Fit to content
    camera.setViewportOffset(viewportOffsetX, viewportOffsetY);
    camera.fitToContent(nodePositions);

    // Debounced hover
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    // Set up interaction
    const interaction = new InteractionHandler(camera, canvas, {
      onNodeClick: (idx) => {
        // Cancel pending hover on click
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        if (idx !== null) {
          const nodeId = data.nodes[idx].id;
          const sid = stateRef.current.selectedId;
          const currentPath = stateRef.current.path;

          if (currentPath) {
            // Path mode: only on-path nodes are clickable
            if (currentPath.includes(nodeId)) {
              if (sid === nodeId) {
                // Clicking the selected node: revert to source or clear
                const sourceId = currentPath[0];
                if (sourceId && sourceId !== nodeId) {
                  setSelectedId(sourceId);
                } else {
                  setSelectedId(null);
                }
              } else {
                setSelectedId(nodeId);
              }
            }
            // Off-path: no-op (use long-press/hover for buttons)
          } else {
            setSelectedId(sid !== nodeId ? nodeId : null);
          }
        } else {
          setSelectedId(null);
        }
      },
      onNodeHover: (idx) => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        const nodeId = idx !== null ? data.nodes[idx].id : null;
        if (nodeId === stateRef.current.hoveredId) return;
        hoverTimer = setTimeout(() => {
          setHoveredId(nodeId);
          hoverTimer = null;
        }, HOVER_DEBOUNCE_MS);
      },
      onCursorMove: (wx, wy) => {
        stateRef.current.cursorWorldX = wx;
        stateRef.current.cursorWorldY = wy;
        cursorWorldRef.current.x = wx;
        cursorWorldRef.current.y = wy;
      },
      onViewChange: () => {
        onCameraChange();
      },
      hitTest: (wx, wy) => {
        return hitTestNode(
          wx,
          wy,
          nodePositions,
          stateRef.current.sizes || new Float32Array(0),
          HOVER_HIT_BUFFER
        );
      },
    });
    interactionRef.current = interaction;

    // Render loop — always renders (fast for ~1335 nodes)
    // Handles smooth interpolation of colors/sizes toward targets.
    const renderLoop = () => {
      const renderer = rendererRef.current;
      if (renderer) {
        const interp = interpRef.current;
        const targets = stateRef.current;
        const now = performance.now();
        const dt = interp.lastTime > 0 ? now - interp.lastTime : 0;
        interp.lastTime = now;

        // Update camera (animation, inertia, smooth zoom)
        if (camera.update(dt)) {
          onCameraChange();
        }
        const factor = dt > 0 ? 1 - Math.exp(-dt / TRANSITION_TAU) : 1;

        // Lerp node colors
        if (targets.targetNodeColors) {
          if (
            !interp.nodeColors ||
            interp.nodeColors.length !== targets.targetNodeColors.length
          ) {
            interp.nodeColors = new Float32Array(targets.targetNodeColors);
          } else {
            const src = targets.targetNodeColors;
            const dst = interp.nodeColors;
            for (let i = 0; i < dst.length; i++) {
              dst[i] += (src[i] - dst[i]) * factor;
            }
          }
          renderer.setNodeColors(interp.nodeColors);
        }

        // Lerp edge colors
        if (targets.targetEdgeColors) {
          if (
            !interp.edgeColors ||
            interp.edgeColors.length !== targets.targetEdgeColors.length
          ) {
            interp.edgeColors = new Float32Array(targets.targetEdgeColors);
          } else {
            const src = targets.targetEdgeColors;
            const dst = interp.edgeColors;
            for (let i = 0; i < dst.length; i++) {
              dst[i] += (src[i] - dst[i]) * factor;
            }
          }
          renderer.setEdgeColors(interp.edgeColors);
        }

        // Lerp node sizes
        if (targets.targetNodeSizes) {
          if (
            !interp.nodeSizes ||
            interp.nodeSizes.length !== targets.targetNodeSizes.length
          ) {
            interp.nodeSizes = new Float32Array(targets.targetNodeSizes);
          } else {
            const src = targets.targetNodeSizes;
            const dst = interp.nodeSizes;
            for (let i = 0; i < dst.length; i++) {
              dst[i] += (src[i] - dst[i]) * factor;
            }
          }
          renderer.setNodeSizes(interp.nodeSizes);
        }

        // Compute per-edge node colors for endpoint tinting
        const eni = targets.edgeNodeIndices;
        if (eni && interp.nodeColors) {
          const n = targets.edgeCount;
          if (
            !interp.edgeSrcNodeColors ||
            interp.edgeSrcNodeColors.length !== n * 4
          ) {
            interp.edgeSrcNodeColors = new Float32Array(n * 4);
            interp.edgeTgtNodeColors = new Float32Array(n * 4);
          }
          for (let i = 0; i < n; i++) {
            const si = eni.src[i];
            const ti = eni.tgt[i];
            interp.edgeSrcNodeColors[i * 4] = interp.nodeColors[si * 4];
            interp.edgeSrcNodeColors[i * 4 + 1] = interp.nodeColors[si * 4 + 1];
            interp.edgeSrcNodeColors[i * 4 + 2] = interp.nodeColors[si * 4 + 2];
            interp.edgeSrcNodeColors[i * 4 + 3] = interp.nodeColors[si * 4 + 3];
            interp.edgeTgtNodeColors![i * 4] = interp.nodeColors[ti * 4];
            interp.edgeTgtNodeColors![i * 4 + 1] =
              interp.nodeColors[ti * 4 + 1];
            interp.edgeTgtNodeColors![i * 4 + 2] =
              interp.nodeColors[ti * 4 + 2];
            interp.edgeTgtNodeColors![i * 4 + 3] =
              interp.nodeColors[ti * 4 + 3];
          }
          renderer.setEdgeNodeColors(
            interp.edgeSrcNodeColors,
            interp.edgeTgtNodeColors!
          );
        }

        // Compute arrow colors/sizes from interpolated edge/node data
        const geom = targets.arrowGeom;
        if (geom && interp.edgeColors && interp.nodeSizes) {
          const n = geom.edgeIndices.length;
          if (!interp.arrowColors || interp.arrowColors.length !== n * 4) {
            interp.arrowColors = new Float32Array(n * 4);
            interp.arrowTargetSizes = new Float32Array(n);
          }
          for (let j = 0; j < n; j++) {
            const ei = geom.edgeIndices[j];
            if (j >= geom.netArrowCount) {
              // Hover arrows use precomputed type-based colors
              const hi = j - geom.netArrowCount;
              interp.arrowColors[j * 4] = geom.hoverColors[hi * 4];
              interp.arrowColors[j * 4 + 1] = geom.hoverColors[hi * 4 + 1];
              interp.arrowColors[j * 4 + 2] = geom.hoverColors[hi * 4 + 2];
              interp.arrowColors[j * 4 + 3] = geom.hoverColors[hi * 4 + 3];
            } else {
              interp.arrowColors[j * 4] = interp.edgeColors[ei * 8];
              interp.arrowColors[j * 4 + 1] = interp.edgeColors[ei * 8 + 1];
              interp.arrowColors[j * 4 + 2] = interp.edgeColors[ei * 8 + 2];
              interp.arrowColors[j * 4 + 3] = interp.edgeColors[ei * 8 + 3];
            }
            interp.arrowTargetSizes![j] =
              interp.nodeSizes[geom.targetNodeIndices[j]];
          }
          renderer.setArrows(
            geom.targets,
            geom.directions,
            interp.arrowColors,
            interp.arrowTargetSizes!,
            geom.phases,
            geom.speeds
          );
        }

        // Update selection indicator
        if (targets.selectedId !== interp.prevSelectedId) {
          interp.prevSelectedId = targets.selectedId;
          const count = data.nodes.length;
          if (!interp.nodeSelected || interp.nodeSelected.length !== count) {
            interp.nodeSelected = new Float32Array(count);
          } else {
            interp.nodeSelected.fill(0);
          }
          if (targets.selectedId) {
            const idx = nodeIdToInt(targets.selectedId);
            if (idx >= 0 && idx < count) {
              interp.nodeSelected[idx] = 1.0;
            }
          }
          renderer.setNodeSelected(interp.nodeSelected);
        }

        // Dark graph background for both modes; slightly lighter for light mode
        const bg: [number, number, number, number] =
          stateRef.current.theme === "light" ? BG_LIGHT : BG_DARK;
        const isLight = stateRef.current.theme === "light";
        renderer.render(
          camera.getViewMatrix(),
          bg,
          stateRef.current.arrowSizeScale * ARROW_SIZE_MULTIPLIER,
          camera.zoom,
          now / 1000,
          stateRef.current.curvedEdges ? EDGE_CURVATURE : 0.0,
          stateRef.current.cursorWorldX,
          stateRef.current.cursorWorldY,
          CURSOR_PROXIMITY_RADIUS,
          isLight ? -1.0 : 1.0,
          isLight ? [0, 0, 0] : [1, 1, 1]
        );
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };
    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      interaction.destroy();
      renderer.destroy();
      rendererRef.current = null;
    };
    // Only re-init on data change, not on every state change
  }, [data, nodePositions, edgePositions, camera, onCameraChange]);

  // Update viewport offset
  useEffect(() => {
    camera.setViewportOffset(viewportOffsetX, viewportOffsetY);
    onCameraChange();
  }, [viewportOffsetX, viewportOffsetY, camera, onCameraChange]);

  // Buffer uploads are now handled in the render loop via interpolation.

  // Helper: animate camera to fit a set of positions
  const animateToFitPositions = useCallback(
    (positions: [number, number][]) => {
      if (positions.length === 0) return;

      let mx = 0,
        my = 0;
      for (const [px, py] of positions) {
        mx += px;
        my += py;
      }
      mx /= positions.length;
      my /= positions.length;

      let variance = 0;
      for (const [px, py] of positions) {
        const dx = px - mx,
          dy = py - my;
        variance += dx * dx + dy * dy;
      }
      const stddev = Math.sqrt(variance / positions.length);

      const fitRadius = Math.max(stddev * FIT_STDDEV_MULT, FIT_RADIUS_MIN);
      const rawW = camera.canvasW - Math.abs(camera.viewportOffsetX);
      const rawH = camera.canvasH - Math.abs(camera.viewportOffsetY);
      const padding = Math.min(rawW, rawH) * FIT_PADDING_FRAC;
      const availableSize = Math.min(rawW - padding, rawH - padding);
      const fitZoom = availableSize / (fitRadius * 2);

      camera.animateTo(
        mx,
        my,
        Math.max(fitZoom, camera.minZoomLevel),
        FIT_ANIM_DURATION
      );
    },
    [camera]
  );

  // Animate to fit the selected node's neighbourhood
  useEffect(() => {
    if (!selectedId || !settings.general.zoomOnSelect) return;
    // When a path is active, path zoom is handled separately
    if (path && path.length > 0) return;

    const idx = nodeIdToInt(selectedId);
    if (idx < 0 || idx >= data.nodes.length) return;

    const positions: [number, number][] = [
      [nodePositions[idx * 2], nodePositions[idx * 2 + 1]],
    ];
    for (const id of pathInfo.immediateNeighbours) {
      const ni = nodeIdToInt(id);
      if (ni >= 0 && ni < data.nodes.length) {
        positions.push([nodePositions[ni * 2], nodePositions[ni * 2 + 1]]);
      }
    }

    animateToFitPositions(positions);
  }, [
    selectedId,
    settings.general.zoomOnSelect,
    data.nodes.length,
    nodePositions,
    pathInfo,
    path,
    animateToFitPositions,
  ]);

  // Animate to fit the entire path when it changes
  useEffect(() => {
    if (!path || path.length === 0 || !settings.general.zoomOnSelect) return;

    const positions: [number, number][] = [];
    for (const id of path) {
      const ni = nodeIdToInt(id);
      if (ni >= 0 && ni < data.nodes.length) {
        positions.push([nodePositions[ni * 2], nodePositions[ni * 2 + 1]]);
      }
    }

    animateToFitPositions(positions);
  }, [
    path,
    settings.general.zoomOnSelect,
    data.nodes.length,
    nodePositions,
    animateToFitPositions,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
}
