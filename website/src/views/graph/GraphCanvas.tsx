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

/** Exponential decay time constant for hover transitions (ms).
 *  ~98.5% converged at 500ms. */
const TRANSITION_TAU = 120;

/** Number of arrow instances per animated (selected) edge. */
const ARROWS_PER_SELECTED_EDGE = 4;

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
    positions: null as Float32Array | null,
    sizes: null as Float32Array | null,
    theme: theme as string,
    arrowSizeScale: settings.general.arrowSizeScale,
    // Target arrays for smooth transitions
    targetNodeColors: null as Float32Array | null,
    targetEdgeColors: null as Float32Array | null,
    targetNodeSizes: null as Float32Array | null,
    arrowGeom: null as {
      targets: Float32Array;
      directions: Float32Array;
      phases: Float32Array;
      targetNodeIndices: number[];
      edgeIndices: number[];
    } | null,
    edgeNodeIndices: null as {
      src: Int32Array;
      tgt: Int32Array;
    } | null,
    edgeCount: 0,
  });
  stateRef.current.selectedId = selectedId;
  stateRef.current.hoveredId = hoveredId;
  stateRef.current.theme = theme;
  stateRef.current.arrowSizeScale = settings.general.arrowSizeScale;

  // Interpolated state for smooth transitions
  const interpRef = useRef({
    nodeColors: null as Float32Array | null,
    edgeColors: null as Float32Array | null,
    nodeSizes: null as Float32Array | null,
    arrowColors: null as Float32Array | null,
    arrowTargetSizes: null as Float32Array | null,
    edgeSrcNodeColors: null as Float32Array | null,
    edgeTgtNodeColors: null as Float32Array | null,
    lastTime: 0,
  });

  const maxDegree = data.max_degree;
  // Graph-specific node lightness: brighter on light mode's darker charcoal bg
  const graphNodeLightness = theme === "light" ? 72 : 60;

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
          const dist = node.id === selectedId
            ? 0
            : pathInfo.immediateNeighbours.has(node.id) && !pathInfo.nodeDistances.has(node.id)
              ? 1
              : pathInfo.nodeDistances.get(node.id) ?? maxDistance;
          // dist 0-1: full opacity; beyond that: exponential falloff
          const alpha = dist <= 1 ? 1.0 : Math.pow(0.25, dist - 1);
          arr[i * 4] = r;
          arr[i * 4 + 1] = g;
          arr[i * 4 + 2] = b;
          arr[i * 4 + 3] = alpha;
        } else {
          arr[i * 4] = r * 0.3;
          arr[i * 4 + 1] = g * 0.3;
          arr[i * 4 + 2] = b * 0.3;
          arr[i * 4 + 3] = 0.06;
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
  ]);

  // Compute node sizes (in world units — shader multiplies by zoom)
  const nodeSizes = useMemo(() => {
    const arr = new Float32Array(data.nodes.length);
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      let size = 60.0 * (0.2 + (node.edges.length / maxDegree) * 0.8);

      // Shrink if not highlighted when something is selected
      if (selectedId && !isHighlightedDueToSelection(node.id, true)) {
        size -= 1.5;
      }

      // Grow if focused
      if (focusedId === node.id) {
        size += 1.5;
      }

      // Grow if hovered
      if (hoveredId === node.id) {
        size += 2.5;
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
    const dimmedColor = parseColor("hsla(0, 0%, 20%, 0.1)");

    const selectedAlpha = 0.8;
    const unselectedAlpha = 0.1;

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

        if (selectedId) {
          if (path) {
            const sourceIndex = path.indexOf(edge.source);
            const targetIndex = path.indexOf(edge.target);
            if (
              sourceIndex !== -1 &&
              targetIndex !== -1 &&
              Math.abs(sourceIndex - targetIndex) === 1
            ) {
              color = edgeColour(90, selectedAlpha);
            } else {
              color = dimmedColor;
            }
          } else if (edge.source === selectedId || edge.target === selectedId) {
            // Direct edges from/to selected node: full visibility
            color = edgeColour(90, selectedAlpha);
          } else {
            const distance = pathInfo.edgeDistances.get(edge);
            if (distance !== undefined && distance < maxDistance) {
              // distance 1 = immediate neighbour edges (full), beyond = falloff
              const alpha = distance <= 1
                ? selectedAlpha
                : selectedAlpha * Math.pow(0.25, distance - 1);
              color = edgeColour(90, alpha);
            } else {
              color = dimmedColor;
            }
          }
        } else {
          color = edgeColour(70, unselectedAlpha);
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
    settings.visibleTypes,
    pathInfo,
    maxDistance,
    path,
  ]);

  // Precompute arrow geometry — expands animated edges into multiple instances
  const arrowGeometry = useMemo(() => {
    // Determine which edges are animated (highlighted due to selection)
    const animatedEdges = new Set<number>();
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
            animatedEdges.add(i);
          }
        } else if (edge.source === selectedId || edge.target === selectedId) {
          animatedEdges.add(i);
        } else {
          const distance = pathInfo.edgeDistances.get(edge);
          if (distance !== undefined && distance <= 1) {
            animatedEdges.add(i);
          }
        }
      }
    }

    // Count total instances
    let totalInstances = 0;
    const visibleEdges: number[] = [];
    for (let i = 0; i < data.edges.length; i++) {
      if (settings.visibleTypes[data.edges[i].ty]) {
        visibleEdges.push(i);
        totalInstances += animatedEdges.has(i) ? ARROWS_PER_SELECTED_EDGE : 1;
      }
    }

    const targets = new Float32Array(totalInstances * 2);
    const directions = new Float32Array(totalInstances * 2);
    const phases = new Float32Array(totalInstances);
    const targetNodeIndices: number[] = [];
    const edgeIndices: number[] = [];

    let j = 0;
    for (const i of visibleEdges) {
      const edge = data.edges[i];
      const ti = nodeIdToInt(edge.target);
      const si = nodeIdToInt(edge.source);

      const tx = nodePositions[ti * 2];
      const ty = nodePositions[ti * 2 + 1];
      const dx = tx - nodePositions[si * 2];
      const dy = ty - nodePositions[si * 2 + 1];

      const instanceCount = animatedEdges.has(i) ? ARROWS_PER_SELECTED_EDGE : 1;
      for (let k = 0; k < instanceCount; k++) {
        targets[j * 2] = tx;
        targets[j * 2 + 1] = ty;
        directions[j * 2] = dx;
        directions[j * 2 + 1] = dy;
        phases[j] = instanceCount === 1 ? -1.0 : k / instanceCount;
        targetNodeIndices.push(ti);
        edgeIndices.push(i);
        j++;
      }
    }

    return { targets, directions, phases, targetNodeIndices, edgeIndices };
  }, [data.edges, nodePositions, settings.visibleTypes, selectedId, pathInfo, path]);

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
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
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

    // Fit to content
    camera.setViewportOffset(viewportOffsetX, viewportOffsetY);
    camera.fitToContent(nodePositions);

    // Debounced hover
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;
    const HOVER_DEBOUNCE_MS = 80;

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
          setSelectedId(stateRef.current.selectedId !== nodeId ? nodeId : null);
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
            interp.edgeTgtNodeColors![i * 4 + 1] = interp.nodeColors[ti * 4 + 1];
            interp.edgeTgtNodeColors![i * 4 + 2] = interp.nodeColors[ti * 4 + 2];
            interp.edgeTgtNodeColors![i * 4 + 3] = interp.nodeColors[ti * 4 + 3];
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
            interp.arrowColors[j * 4] = interp.edgeColors[ei * 8];
            interp.arrowColors[j * 4 + 1] = interp.edgeColors[ei * 8 + 1];
            interp.arrowColors[j * 4 + 2] = interp.edgeColors[ei * 8 + 2];
            interp.arrowColors[j * 4 + 3] = interp.edgeColors[ei * 8 + 3];
            interp.arrowTargetSizes![j] =
              interp.nodeSizes[geom.targetNodeIndices[j]];
          }
          renderer.setArrows(
            geom.targets,
            geom.directions,
            interp.arrowColors,
            interp.arrowTargetSizes!,
            geom.phases
          );
        }

        // Dark graph background for both modes; slightly lighter for light mode
        const bg: [number, number, number, number] =
          stateRef.current.theme === "light"
            ? [0.12, 0.12, 0.14, 1]
            : [0, 0, 0, 1];
        renderer.render(
          camera.getViewMatrix(),
          bg,
          stateRef.current.arrowSizeScale * 6,
          camera.zoom * (window.devicePixelRatio || 1),
          now / 1000
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
    camera.setViewportOffset(
      viewportOffsetX * (window.devicePixelRatio || 1),
      viewportOffsetY * (window.devicePixelRatio || 1)
    );
    onCameraChange();
  }, [viewportOffsetX, viewportOffsetY, camera, onCameraChange]);

  // Buffer uploads are now handled in the render loop via interpolation.

  // Animate to fit the selected node's neighbourhood
  useEffect(() => {
    if (selectedId && settings.general.zoomOnSelect) {
      const idx = nodeIdToInt(selectedId);
      if (idx < 0 || idx >= data.nodes.length) return;

      // Gather positions of the selected node + immediate neighbours
      const netPositions: [number, number][] = [
        [nodePositions[idx * 2], nodePositions[idx * 2 + 1]],
      ];
      for (const id of pathInfo.immediateNeighbours) {
        const ni = nodeIdToInt(id);
        if (ni >= 0 && ni < data.nodes.length) {
          netPositions.push([nodePositions[ni * 2], nodePositions[ni * 2 + 1]]);
        }
      }

      // Compute mean
      let mx = 0, my = 0;
      for (const [px, py] of netPositions) { mx += px; my += py; }
      mx /= netPositions.length;
      my /= netPositions.length;

      // Compute stddev of distances from mean
      let variance = 0;
      for (const [px, py] of netPositions) {
        const dx = px - mx, dy = py - my;
        variance += dx * dx + dy * dy;
      }
      const stddev = Math.sqrt(variance / netPositions.length);

      // Zoom to fit 2 stddev radius; large minimum so spatial neighbours stay visible
      const fitRadius = Math.max(stddev * 2, 150);
      const availableSize = Math.min(
        camera.canvasW - Math.abs(camera.viewportOffsetX) - 100,
        camera.canvasH - Math.abs(camera.viewportOffsetY) - 100
      );
      const fitZoom = availableSize / (fitRadius * 2);

      camera.animateTo(mx, my, Math.max(fitZoom, camera.minZoomLevel), 900);
    }
  }, [
    selectedId,
    settings.general.zoomOnSelect,
    data.nodes.length,
    nodePositions,
    pathInfo,
    camera,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ touchAction: "none" }}
    />
  );
}
