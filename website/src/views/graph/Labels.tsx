/** HTML label overlay with conflict-avoidance layout. */

import { useMemo, useRef, useLayoutEffect, type RefObject } from "react";

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

  // Refs for current values so imperative event handlers avoid stale closures
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const hoveredIdRef = useRef(hoveredId);
  hoveredIdRef.current = hoveredId;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  const setSelectedIdRef = useRef(setSelectedId);
  setSelectedIdRef.current = setSelectedId;
  const setHoveredIdRef = useRef(setHoveredId);
  setHoveredIdRef.current = setHoveredId;
  const containerRefRef = useRef(containerRef);
  containerRefRef.current = containerRef;

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

  // --- Imperative DOM management ---
  // We bypass React reconciliation for label elements so we can reliably
  // control CSS animations (fade-in on enter) and avoid React re-keying
  // causing spurious animation replays.
  const labelElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  /** Exiting elements that are fading out but still need position updates. */
  const exitingElementsRef = useRef<Map<string, { el: HTMLDivElement; nodeIndex: number }>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = labelElementsRef.current;
    const exiting = exitingElementsRef.current;
    const currentIds = new Set<string>();

    for (const label of labels) {
      currentIds.add(label.node.id);

      // If this label was exiting, cancel the exit — it's back
      if (exiting.has(label.node.id)) {
        const entry = exiting.get(label.node.id)!;
        entry.el.classList.remove("node-label-exit");
        exiting.delete(label.node.id);
        elements.set(label.node.id, entry.el);
      }

      let el = elements.get(label.node.id);

      if (!el) {
        el = document.createElement("div");
        el.className = "node-label node-label-enter";
        el.textContent = label.node.label;

        // Remove enter animation class after it finishes
        el.addEventListener("animationend", () => {
          el!.classList.remove("node-label-enter");
        }, { once: true });

        // Attach event listeners — they read current state from refs
        const nodeId = label.node.id;

        el.addEventListener("pointerenter", () => {
          setHoveredIdRef.current(nodeId);
        });
        el.addEventListener("pointerleave", () => {
          if (hoveredIdRef.current === nodeId) setHoveredIdRef.current(null);
        });
        el.addEventListener("wheel", (e) => {
          const rect = containerRefRef.current.current!.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          cameraRef.current.smoothZoomAt(sx, sy, factor);
          onCameraChangeRef.current();
        }, { passive: true });
        el.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          const cam = cameraRef.current;
          const onChange = onCameraChangeRef.current;

          if (e.pointerType === "touch") {
            let totalDist = 0;
            let lastX = e.clientX;
            let lastY = e.clientY;
            let sawMultitouch = false;

            const onMove = (te: TouchEvent) => {
              if (te.touches.length >= 2) { sawMultitouch = true; return; }
              const touch = te.touches[0];
              const dx = touch.clientX - lastX;
              const dy = touch.clientY - lastY;
              totalDist += Math.hypot(dx, dy);
              cam.pan(dx, dy);
              lastX = touch.clientX;
              lastY = touch.clientY;
              onChange();
            };
            const onEnd = (te: TouchEvent) => {
              if (te.touches.length > 0) return;
              if (!sawMultitouch && totalDist < DRAG_THRESHOLD) {
                const sid = selectedIdRef.current;
                setSelectedIdRef.current(sid === nodeId ? null : nodeId);
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

          // Mouse drag tracking
          const dragState = { startX: e.clientX, startY: e.clientY, totalDist: 0 };
          const onMove = (me: PointerEvent) => {
            const dx = me.clientX - dragState.startX;
            const dy = me.clientY - dragState.startY;
            dragState.totalDist += Math.sqrt(dx * dx + dy * dy);
            cam.pan(dx, dy);
            dragState.startX = me.clientX;
            dragState.startY = me.clientY;
            onChange();
          };
          const onUp = () => {
            if (dragState.totalDist < DRAG_THRESHOLD) {
              const sid = selectedIdRef.current;
              setSelectedIdRef.current(sid === nodeId ? null : nodeId);
            }
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        });

        container.appendChild(el);
        elements.set(nodeId, el);
      }

      // Update styles on every sync
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

      const isHovered = hoveredId === label.node.id;
      let filterStyle = "";
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

      const s = el.style;
      s.transform = `translate(${label.screenX}px, ${label.screenY}px) translate(-50%, -100%)`;
      s.fontSize = `${label.fontSize}px`;
      s.backgroundColor = bgColor;
      s.borderBottom = `4px solid ${borderColor}`;
      s.color = textColor;
      s.filter = filterStyle;
      s.opacity = String(opacityStyle);
    }

    // Start fade-out for elements no longer in the active set
    for (const [id, el] of elements) {
      if (!currentIds.has(id)) {
        elements.delete(id);
        const nodeIndex = parseInt(id, 10);
        el.classList.add("node-label-exit");
        exiting.set(id, { el, nodeIndex });
        const remove = () => { el.remove(); exiting.delete(id); };
        el.addEventListener("animationend", remove, { once: true });
        setTimeout(remove, 250);
      }
    }

    // Update positions of exiting elements so they follow the camera
    for (const [, { el, nodeIndex }] of exiting) {
      const wx = nodePositions[nodeIndex * 2];
      const wy = nodePositions[nodeIndex * 2 + 1];
      const [sx, sy] = camera.worldToScreen(wx, wy);
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    }
  }, [labels, colorLightness, maxDegree, selectedId, hoveredId, camera, nodePositions, cameraVersion]);

  // Render just the container — children are managed imperatively
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden node-label-container"
      style={{ pointerEvents: "none", willChange: "transform" }}
    />
  );
}
