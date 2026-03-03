/** HTML label overlay with conflict-avoidance layout. */

import { useMemo, useRef, useCallback, type RefObject } from "react";

import {
  nodeColour,
  NodeColourLightnessDark,
  NodeColourLightnessLight,
  NodeData,
  useDataContext,
} from "../../data";
import { SettingsData } from "../../settings";
import { useTheme } from "../../theme";

import type { Camera } from "./Camera";
import { PathInfo } from "./pathInfo";

import "../graph.css";

const MAX_VISIBLE_LABELS = 100;
/** Labels stay at base size until zoom exceeds this, then grow proportionally. */
const LABEL_ZOOM_THRESHOLD = 1.5;
/** Fraction of full zoom-scaling applied to labels beyond the threshold (0=fixed, 1=full). */
const LABEL_ZOOM_RATE = 0.25;
/** Extra HSL lightness added to graph labels to compensate for the dark graph background. */
const LABEL_LIGHTNESS_BOOST = 5;
const DRAG_THRESHOLD = 5;

type LabelCandidate = {
  nodeIndex: number;
  node: NodeData;
  screenX: number;
  screenY: number;
  fontSize: number;
  priority: number;
  /** Whether this label is in the selected coverage net */
  inSelectedNet: boolean;
  /** BFS distance from selected node (0 = selected, Infinity = not in net) */
  selectionDistance: number;
};

/** HTML label overlay with degree-prioritized conflict avoidance. */
export function Labels({
  settings,
  selectedId,
  setSelectedId,
  hoveredId,
  setHoveredId,
  pathInfo,
  camera,
  nodePositions,
  cameraVersion,
  onCameraChange,
  containerRef,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  pathInfo: PathInfo;
  camera: Camera;
  nodePositions: Float32Array;
  cameraVersion: number;
  onCameraChange: () => void;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const data = useDataContext();
  const { theme } = useTheme();
  const colorLightness =
    theme === "light" ? NodeColourLightnessLight : NodeColourLightnessDark;
  const maxDegree = data.max_degree;
  const maxDistance = settings.general.maxInfluenceDistance + 1;
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    totalDist: number;
    nodeId: string;
  } | null>(null);

  // Handle pointerdown on a label: track for drag vs click.
  // Touch uses touchmove/touchend (not pointermove) so we can check
  // e.touches.length and stop panning when multitouch begins.
  const onLabelPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      e.preventDefault();

      if (e.pointerType === "touch") {
        let totalDist = 0;
        let lastX = e.clientX;
        let lastY = e.clientY;
        let sawMultitouch = false;

        const onMove = (te: TouchEvent) => {
          // When a second finger arrives, stop panning — the canvas will
          // handle pinch via its own touchmove (which sees all touches).
          if (te.touches.length >= 2) {
            sawMultitouch = true;
            return;
          }
          const touch = te.touches[0];
          const dx = touch.clientX - lastX;
          const dy = touch.clientY - lastY;
          totalDist += Math.hypot(dx, dy);
          camera.pan(dx, dy);
          lastX = touch.clientX;
          lastY = touch.clientY;
          onCameraChange();
        };

        const onEnd = (te: TouchEvent) => {
          if (te.touches.length > 0) return; // other fingers still active
          if (!sawMultitouch && totalDist < DRAG_THRESHOLD) {
            setSelectedId(selectedId === nodeId ? null : nodeId);
          }
          window.removeEventListener("touchmove", onMove);
          window.removeEventListener("touchend", onEnd);
          window.removeEventListener("touchcancel", onEnd);
        };

        window.addEventListener("touchmove", onMove);
        window.addEventListener("touchend", onEnd);
        window.addEventListener("touchcancel", onEnd);
        return;
      }

      // Mouse: full drag tracking with camera pan
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        totalDist: 0,
        nodeId,
      };

      const onMove = (me: PointerEvent) => {
        const state = dragStateRef.current;
        if (!state) return;
        const dx = me.clientX - state.startX;
        const dy = me.clientY - state.startY;
        state.totalDist += Math.sqrt(dx * dx + dy * dy);
        // Pan camera directly
        camera.pan(dx, dy);
        state.startX = me.clientX;
        state.startY = me.clientY;
        onCameraChange();
      };

      const onUp = () => {
        const state = dragStateRef.current;
        if (state && state.totalDist < DRAG_THRESHOLD) {
          // Click — toggle selection
          setSelectedId(selectedId === state.nodeId ? null : state.nodeId);
        }
        dragStateRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [camera, selectedId, setSelectedId, onCameraChange]
  );

  const prevLabelIdsRef = useRef<Set<string>>(new Set());
  /** Cached label selection — reused between full recomputations. */
  const cachedSelectionRef = useRef<{
    ids: Set<string>;
    boundsMinX: number;
    boundsMinY: number;
    boundsMaxX: number;
    boundsMaxY: number;
    zoom: number;
    selectedId: string | null;
  } | null>(null);

  const stableLabels = useMemo(() => {
    if (!settings.general.showLabels)
      return { result: [] as LabelCandidate[], allCandidates: [] as LabelCandidate[] };

    const [minX, minY, maxX, maxY] = camera.getVisibleBounds();
    const camZoom = camera.zoom;

    // Decide whether to reuse the cached label selection or recompute.
    // The CSS transform trick in Graph.tsx handles smooth inter-frame movement,
    // so we only need to reselect labels when the camera moves significantly.
    const cached = cachedSelectionRef.current;
    let needsReselect = !cached || cached.selectedId !== selectedId;
    if (cached && !needsReselect) {
      const prevW = cached.boundsMaxX - cached.boundsMinX;
      const prevH = cached.boundsMaxY - cached.boundsMinY;
      const panFracX = prevW > 0 ? Math.abs((minX + maxX) / 2 - (cached.boundsMinX + cached.boundsMaxX) / 2) / prevW : 1;
      const panFracY = prevH > 0 ? Math.abs((minY + maxY) / 2 - (cached.boundsMinY + cached.boundsMaxY) / 2) / prevH : 1;
      const zoomRatio = cached.zoom > 0 ? camZoom / cached.zoom : 2;
      // Reselect if panned >25% of viewport or zoom changed by >20%
      if (panFracX > 0.25 || panFracY > 0.25 || zoomRatio > 1.2 || zoomRatio < 1 / 1.2) {
        needsReselect = true;
      }
    }

    // Build candidate list (always needed for fresh screen positions)
    const candidates: LabelCandidate[] = [];

    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      const wx = nodePositions[i * 2];
      const wy = nodePositions[i * 2 + 1];

      // Skip off-screen nodes
      if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;

      const [sx, sy] = camera.worldToScreen(wx, wy);
      const baseFontSize = 10 + (node.edges.length / maxDegree) * 6;
      const zoomScale = camera.zoom;
      const fullScale = zoomScale / LABEL_ZOOM_THRESHOLD;
      const fontSize = baseFontSize * Math.max(1, 1 + (fullScale - 1) * LABEL_ZOOM_RATE);

      const basePriority = node.edges.length;
      let priority = basePriority;
      let inSelectedNet = false;
      let selectionDistance = Infinity;

      if (selectedId) {
        if (node.id === selectedId) {
          priority += 100000;
          inSelectedNet = true;
          selectionDistance = 0;
        } else {
          const dist = pathInfo.nodeDistances.get(node.id);
          if (dist !== undefined && dist < maxDistance) {
            priority += 10000 - dist * 1000;
            inSelectedNet = true;
            selectionDistance = dist;
          }
          if (pathInfo.immediateNeighbours.has(node.id)) {
            priority += 10000;
            inSelectedNet = true;
            if (selectionDistance > 1) selectionDistance = 1;
          }
        }
      }

      candidates.push({
        nodeIndex: i,
        node,
        screenX: sx,
        screenY: sy,
        fontSize,
        priority,
        inSelectedNet,
        selectionDistance,
      });
    }

    // If we can reuse the previous selection, just filter to cached IDs
    // with fresh screen positions. This keeps labels stable during small
    // pans/zooms — the CSS transform handles smooth movement between frames.
    if (!needsReselect && cached) {
      const result = candidates.filter((c) => cached.ids.has(c.node.id));
      return { result, allCandidates: candidates };
    }

    // Full reselection — selected-net first, then spatially diverse grid
    const selectedCandidates = candidates
      .filter((c) => c.inSelectedNet)
      .sort((a, b) => b.priority - a.priority);
    const otherCandidates = candidates
      .filter((c) => !c.inSelectedNet)
      .sort((a, b) => b.priority - a.priority);

    const screenW = camera.canvasW || 1;
    const screenH = camera.canvasH || 1;
    const GRID_COLS = 8;
    const GRID_ROWS = 6;
    const cellW = screenW / GRID_COLS;
    const cellH = screenH / GRID_ROWS;
    const grid: LabelCandidate[][] = Array.from(
      { length: GRID_COLS * GRID_ROWS },
      () => []
    );
    const prevIds = prevLabelIdsRef.current;
    for (const c of otherCandidates) {
      const col = Math.min(Math.floor(c.screenX / cellW), GRID_COLS - 1);
      const row = Math.min(Math.floor(c.screenY / cellH), GRID_ROWS - 1);
      if (col >= 0 && row >= 0) {
        grid[row * GRID_COLS + col].push(c);
      }
    }
    // Within each cell: prefer previously-visible labels (stability),
    // then sort by priority.
    for (const cell of grid) {
      cell.sort((a, b) => {
        const aKeep = prevIds.has(a.node.id) ? 1 : 0;
        const bKeep = prevIds.has(b.node.id) ? 1 : 0;
        if (aKeep !== bKeep) return bKeep - aKeep;
        return b.priority - a.priority;
      });
    }
    // Round-robin: take one candidate from each non-empty cell, repeat
    const spatialOrder: LabelCandidate[] = [];
    const usedIds = new Set<string>();
    let remaining = true;
    for (let round = 0; remaining; round++) {
      remaining = false;
      for (const cell of grid) {
        if (round < cell.length) {
          remaining = true;
          const c = cell[round];
          if (!usedIds.has(c.node.id)) {
            usedIds.add(c.node.id);
            spatialOrder.push(c);
          }
        }
      }
    }

    // Greedy overlap culling
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const result: LabelCandidate[] = [];

    const tryPlace = (c: LabelCandidate): boolean => {
      if (result.length >= MAX_VISIBLE_LABELS) return false;
      const charWidth = c.fontSize * 0.6;
      const w = c.node.label.length * charWidth + 16;
      const h = c.fontSize + 4;
      const x = c.screenX - w / 2;
      const y = c.screenY - h;

      for (const p of placed) {
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) {
          return false;
        }
      }
      placed.push({ x, y, w, h });
      result.push(c);
      return true;
    };

    for (const c of selectedCandidates) tryPlace(c);
    for (const c of spatialOrder) tryPlace(c);

    // Cache for throttling
    const newIds = new Set(result.map((c) => c.node.id));
    prevLabelIdsRef.current = newIds;
    cachedSelectionRef.current = {
      ids: newIds,
      boundsMinX: minX,
      boundsMinY: minY,
      boundsMaxX: maxX,
      boundsMaxY: maxY,
      zoom: camZoom,
      selectedId,
    };

    return { result, allCandidates: candidates };
  }, [
    data.nodes,
    camera,
    nodePositions,
    settings.general.showLabels,
    selectedId,
    pathInfo,
    maxDegree,
    maxDistance,
    cameraVersion,
  ]);

  // Ensure hovered label is always shown, even if culled by overlap.
  // Computed outside the stable useMemo so hover doesn't cause remounts.
  const labels = useMemo(() => {
    const { result, allCandidates } = stableLabels;
    if (!hoveredId || result.some((c) => c.node.id === hoveredId)) {
      return result;
    }
    const hovered = allCandidates.find((c) => c.node.id === hoveredId);
    return hovered ? [...result, hovered] : result;
  }, [stableLabels, hoveredId]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden node-label-container"
      style={{ pointerEvents: "none", willChange: "transform" }}
    >
      {labels.map((label) => {
        const bgColor = nodeColour(
          label.node,
          maxDegree,
          colorLightness.GraphLabelBackgroundBorder + LABEL_LIGHTNESS_BOOST
        );
        const borderColor = nodeColour(
          label.node,
          maxDegree,
          colorLightness.GraphLabelBackground + LABEL_LIGHTNESS_BOOST
        );
        const textColor = nodeColour(
          label.node,
          maxDegree,
          colorLightness.GraphLabelText + LABEL_LIGHTNESS_BOOST
        );

        // Hover overrides all dimming — hovered labels are always fully visible
        const isHovered = hoveredId === label.node.id;
        let filterStyle: string | undefined;
        let opacityStyle = 1;
        if (isHovered) {
          filterStyle = "brightness(1.6)";
        } else if (selectedId) {
          if (label.inSelectedNet) {
            opacityStyle = label.selectionDistance <= 1
              ? 1.0
              : Math.pow(0.25, label.selectionDistance - 1);
          } else {
            filterStyle = "brightness(0.4)";
            opacityStyle = 0.2;
          }
        }

        return (
          <div
            key={label.node.id}
            className="node-label"
            style={{
              transform: `translate(${label.screenX}px, ${label.screenY}px) translate(-50%, -100%)`,
              fontSize: `${label.fontSize}px`,
              backgroundColor: bgColor,
              borderBottom: `4px solid ${borderColor}`,
              color: textColor,
              filter: filterStyle,
              opacity: opacityStyle,
            }}
            onPointerEnter={() => setHoveredId(label.node.id)}
            onPointerLeave={() => {
              if (hoveredId === label.node.id) setHoveredId(null);
            }}
            onWheel={(e) => {
              // Forward wheel events to the camera so zoom works over labels
              const rect = containerRef.current!.getBoundingClientRect();
              const sx = e.clientX - rect.left;
              const sy = e.clientY - rect.top;
              const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
              camera.smoothZoomAt(sx, sy, factor);
              onCameraChange();
            }}
            onPointerDown={(e) => onLabelPointerDown(e, label.node.id)}
          >
            {label.node.label}
          </div>
        );
      })}
    </div>
  );
}
