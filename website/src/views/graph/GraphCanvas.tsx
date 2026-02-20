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
  hoverPathInfo,
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
  hoverPathInfo: PathInfo;
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
  });
  stateRef.current.selectedId = selectedId;
  stateRef.current.hoveredId = hoveredId;
  stateRef.current.theme = theme;
  stateRef.current.arrowSizeScale = settings.general.arrowSizeScale;

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

  // Compute node colors
  const nodeColors = useMemo(() => {
    const arr = new Float32Array(data.nodes.length * 4);
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      let cssColor: string;

      const isHovered = hoveredId === node.id;

      if (selectedId && !isHovered) {
        if (isHighlightedDueToSelection(node.id, true)) {
          cssColor = nodeColour(node, maxDegree, graphNodeLightness);
        } else if (hoveredId && hoverPathInfo.nodeDistances.has(node.id)) {
          // Part of hover coverage net — show slightly brighter
          cssColor = nodeColour(node, maxDegree, graphNodeLightness, 10);
        } else {
          cssColor = "hsla(0, 0%, 70%, 0.1)";
        }
      } else if (
        hoveredId &&
        !selectedId &&
        hoverPathInfo.nodeDistances.has(node.id)
      ) {
        cssColor = nodeColour(node, maxDegree, graphNodeLightness, 10);
      } else {
        cssColor = nodeColour(node, maxDegree, graphNodeLightness);
      }

      const [r, g, b, a] = parseColor(cssColor);
      arr[i * 4] = r;
      arr[i * 4 + 1] = g;
      arr[i * 4 + 2] = b;
      arr[i * 4 + 3] = a;
    }
    return arr;
  }, [
    data.nodes,
    selectedId,
    hoveredId,
    maxDegree,
    graphNodeLightness,
    isHighlightedDueToSelection,
    hoverPathInfo,
  ]);

  // Compute node sizes (in world units — shader multiplies by zoom)
  const nodeSizes = useMemo(() => {
    const arr = new Float32Array(data.nodes.length);
    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      let size = 15.0 * (0.2 + (node.edges.length / maxDegree) * 0.8);

      // Shrink if not highlighted when something is selected
      if (
        selectedId &&
        !isHighlightedDueToSelection(node.id, true) &&
        !(hoveredId && hoverPathInfo.nodeDistances.has(node.id))
      ) {
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
    hoverPathInfo,
  ]);
  stateRef.current.sizes = nodeSizes;

  // Compute edge colors
  const edgeColors = useMemo(() => {
    const arr = new Float32Array(data.edges.length * 8); // 4 components * 2 vertices
    const dimmedColor = parseColor("hsla(0, 0%, 20%, 0.1)");

    const selectedAlpha = 0.8;
    const selectedMinInfluenceAlpha = 0.4;
    const unselectedAlpha = 0.08;

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
          } else if (edge.source === selectedId) {
            color = edgeColour(90, selectedAlpha);
          } else if (edge.target === selectedId) {
            color = edgeColour(40, selectedAlpha);
          } else {
            const distance = pathInfo.edgeDistances.get(edge);
            if (distance !== undefined) {
              const factor = 1 - distance / maxDistance;
              const saturation = Math.max(0, 100 * factor);
              const alpha =
                selectedMinInfluenceAlpha +
                (selectedAlpha - selectedMinInfluenceAlpha) * factor;
              if (saturation > 0) {
                color = edgeColour(saturation, alpha);
              } else {
                color = dimmedColor;
              }
            } else if (hoveredId && hoverPathInfo.edgeDistances.has(edge)) {
              const hDist = hoverPathInfo.edgeDistances.get(edge)!;
              const factor = 1 - hDist / maxDistance;
              color = edgeColour(Math.max(0, 80 * factor), 0.3 + 0.4 * factor);
            } else {
              color = dimmedColor;
            }
          }
        } else if (hoveredId && hoverPathInfo.edgeDistances.has(edge)) {
          const hDist = hoverPathInfo.edgeDistances.get(edge)!;
          const factor = 1 - hDist / maxDistance;
          color = edgeColour(Math.max(0, 80 * factor), 0.3 + 0.4 * factor);
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
    hoveredId,
    settings.visibleTypes,
    pathInfo,
    hoverPathInfo,
    maxDistance,
    path,
  ]);

  // Compute arrow data
  const arrowData = useMemo(() => {
    const visibleEdges: number[] = [];
    for (let i = 0; i < data.edges.length; i++) {
      if (settings.visibleTypes[data.edges[i].ty]) {
        // Only show arrow if the edge has non-zero alpha
        const alpha = edgeColors[i * 8 + 3];
        if (alpha > 0.01) {
          visibleEdges.push(i);
        }
      }
    }

    const targets = new Float32Array(visibleEdges.length * 2);
    const directions = new Float32Array(visibleEdges.length * 2);
    const colors = new Float32Array(visibleEdges.length * 4);
    const targetSizes = new Float32Array(visibleEdges.length);

    for (let j = 0; j < visibleEdges.length; j++) {
      const i = visibleEdges[j];
      const edge = data.edges[i];
      const ti = nodeIdToInt(edge.target);
      const si = nodeIdToInt(edge.source);

      targets[j * 2] = nodePositions[ti * 2];
      targets[j * 2 + 1] = nodePositions[ti * 2 + 1];

      const dx = nodePositions[ti * 2] - nodePositions[si * 2];
      const dy = nodePositions[ti * 2 + 1] - nodePositions[si * 2 + 1];
      directions[j * 2] = dx;
      directions[j * 2 + 1] = dy;

      // Use the edge color for the arrow
      colors[j * 4] = edgeColors[i * 8];
      colors[j * 4 + 1] = edgeColors[i * 8 + 1];
      colors[j * 4 + 2] = edgeColors[i * 8 + 2];
      colors[j * 4 + 3] = edgeColors[i * 8 + 3];

      targetSizes[j] = nodeSizes[ti];
    }

    return { targets, directions, colors, targetSizes };
  }, [data.edges, nodePositions, edgeColors, nodeSizes, settings.visibleTypes]);

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
    const renderLoop = () => {
      // Tick camera animation
      if (camera.isAnimating) {
        camera.tick();
        onCameraChange();
      }

      if (rendererRef.current) {
        // Dark graph background for both modes; slightly lighter for light mode
        const bg: [number, number, number, number] =
          stateRef.current.theme === "light"
            ? [0.12, 0.12, 0.14, 1]
            : [0, 0, 0, 1];
        rendererRef.current.render(
          camera.getViewMatrix(),
          bg,
          stateRef.current.arrowSizeScale,
          camera.zoom * (window.devicePixelRatio || 1)
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

  // Update dynamic buffers when colors/sizes change
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.setNodeColors(nodeColors);
    rendererRef.current.setNodeSizes(nodeSizes);
    rendererRef.current.setEdgeColors(edgeColors);
    rendererRef.current.setArrows(
      arrowData.targets,
      arrowData.directions,
      arrowData.colors,
      arrowData.targetSizes
    );
  }, [nodeColors, nodeSizes, edgeColors, arrowData]);

  // Animate to node on selection
  useEffect(() => {
    if (selectedId && settings.general.zoomOnSelect) {
      const idx = nodeIdToInt(selectedId);
      if (idx >= 0 && idx < data.nodes.length) {
        camera.animateTo(
          nodePositions[idx * 2],
          nodePositions[idx * 2 + 1],
          Math.max(camera.zoom, 2),
          300
        );
      }
    }
  }, [
    selectedId,
    settings.general.zoomOnSelect,
    data.nodes.length,
    nodePositions,
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
