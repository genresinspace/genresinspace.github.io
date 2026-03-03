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
const GRID_COLS = 8;
const GRID_ROWS = 6;

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

// ---------------------------------------------------------------------------
// Label candidate building
// ---------------------------------------------------------------------------

/** Build label candidates from visible on-screen nodes. */
function buildCandidates(
  nodes: NodeData[],
  nodePositions: Float32Array,
  camera: Camera,
  bounds: [number, number, number, number],
  maxDegree: number,
  selectedId: string | null,
  pathInfo: PathInfo,
  maxDistance: number,
): LabelCandidate[] {
  const [minX, minY, maxX, maxY] = bounds;
  const candidates: LabelCandidate[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const wx = nodePositions[i * 2];
    const wy = nodePositions[i * 2 + 1];

    if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;

    const [sx, sy] = camera.worldToScreen(wx, wy);
    const baseFontSize = 10 + (node.edges.length / maxDegree) * 6;
    const fullScale = camera.zoom / LABEL_ZOOM_THRESHOLD;
    const fontSize = baseFontSize * Math.max(1, 1 + (fullScale - 1) * LABEL_ZOOM_RATE);

    let priority = node.edges.length;
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
      nodeIndex: i, node, screenX: sx, screenY: sy,
      fontSize, priority, inSelectedNet, selectionDistance,
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Label selection (grid bucketing + overlap culling)
// ---------------------------------------------------------------------------

/** Select which labels to display using spatial grid bucketing and overlap culling. */
function selectLabels(
  candidates: LabelCandidate[],
  screenW: number,
  screenH: number,
  prevIds: Set<string>,
): LabelCandidate[] {
  const selectedCandidates = candidates
    .filter((c) => c.inSelectedNet)
    .sort((a, b) => b.priority - a.priority);
  const otherCandidates = candidates
    .filter((c) => !c.inSelectedNet)
    .sort((a, b) => b.priority - a.priority);

  // Spatial bucketing: divide the screen into a grid and interleave
  // the best candidate from each cell so labels spread across the
  // full graph instead of clustering in the dense center.
  const cellW = screenW / GRID_COLS;
  const cellH = screenH / GRID_ROWS;
  const grid: LabelCandidate[][] = Array.from(
    { length: GRID_COLS * GRID_ROWS },
    () => []
  );
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

  return result;
}

// ---------------------------------------------------------------------------
// Imperative DOM helpers
// ---------------------------------------------------------------------------

type LabelRefs = {
  selectedId: RefObject<string | null>;
  hoveredId: RefObject<string | null>;
  camera: RefObject<Camera>;
  onCameraChange: RefObject<() => void>;
  setSelectedId: RefObject<(id: string | null) => void>;
  setHoveredId: RefObject<(id: string | null) => void>;
  containerRef: RefObject<RefObject<HTMLDivElement | null>>;
};

/** Create a label DOM element with event listeners that read state from refs. */
function createLabelElement(nodeId: string, text: string, refs: LabelRefs): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "node-label node-label-enter";
  el.textContent = text;

  el.addEventListener("animationend", () => {
    el.classList.remove("node-label-enter");
  }, { once: true });

  el.addEventListener("pointerenter", () => {
    refs.setHoveredId.current(nodeId);
  });
  el.addEventListener("pointerleave", () => {
    if (refs.hoveredId.current === nodeId) refs.setHoveredId.current(null);
  });
  el.addEventListener("wheel", (e) => {
    const rect = refs.containerRef.current.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    refs.camera.current.smoothZoomAt(sx, sy, factor);
    refs.onCameraChange.current();
  }, { passive: true });
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const cam = refs.camera.current;
    const onChange = refs.onCameraChange.current;

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
          const sid = refs.selectedId.current;
          refs.setSelectedId.current(sid === nodeId ? null : nodeId);
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
        const sid = refs.selectedId.current;
        refs.setSelectedId.current(sid === nodeId ? null : nodeId);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });

  return el;
}

/** Update a label element's inline styles to reflect current state. */
function updateLabelStyle(
  el: HTMLDivElement,
  label: LabelCandidate,
  maxDegree: number,
  colorLightness: typeof NodeColourLightnessDark | typeof NodeColourLightnessLight,
  hoveredId: string | null,
  selectedId: string | null,
): void {
  const bgColor = nodeColour(
    label.node, maxDegree,
    colorLightness.GraphLabelBackgroundBorder + LABEL_LIGHTNESS_BOOST,
  );
  const borderColor = nodeColour(
    label.node, maxDegree,
    colorLightness.GraphLabelBackground + LABEL_LIGHTNESS_BOOST,
  );
  const textColor = nodeColour(
    label.node, maxDegree,
    colorLightness.GraphLabelText + LABEL_LIGHTNESS_BOOST,
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

// ---------------------------------------------------------------------------
// Throttle cache
// ---------------------------------------------------------------------------

type SelectionCache = {
  ids: Set<string>;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  zoom: number;
  selectedId: string | null;
};

/** Check whether the camera has moved enough to warrant reselecting labels. */
function needsReselection(
  cached: SelectionCache | null,
  bounds: [number, number, number, number],
  zoom: number,
  selectedId: string | null,
): boolean {
  if (!cached || cached.selectedId !== selectedId) return true;

  const [minX, minY, maxX, maxY] = bounds;
  const prevW = cached.boundsMaxX - cached.boundsMinX;
  const prevH = cached.boundsMaxY - cached.boundsMinY;
  const panFracX = prevW > 0 ? Math.abs((minX + maxX) / 2 - (cached.boundsMinX + cached.boundsMaxX) / 2) / prevW : 1;
  const panFracY = prevH > 0 ? Math.abs((minY + maxY) / 2 - (cached.boundsMinY + cached.boundsMaxY) / 2) / prevH : 1;
  const zoomRatio = cached.zoom > 0 ? zoom / cached.zoom : 2;

  // Reselect if panned >25% of viewport or zoom changed by >20%
  return panFracX > 0.25 || panFracY > 0.25 || zoomRatio > 1.2 || zoomRatio < 1 / 1.2;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const refs: LabelRefs = {
    selectedId: useRef(selectedId),
    hoveredId: useRef(hoveredId),
    camera: useRef(camera),
    onCameraChange: useRef(onCameraChange),
    setSelectedId: useRef(setSelectedId),
    setHoveredId: useRef(setHoveredId),
    containerRef: useRef(containerRef),
  };
  refs.selectedId.current = selectedId;
  refs.hoveredId.current = hoveredId;
  refs.camera.current = camera;
  refs.onCameraChange.current = onCameraChange;
  refs.setSelectedId.current = setSelectedId;
  refs.setHoveredId.current = setHoveredId;
  refs.containerRef.current = containerRef;

  const prevLabelIdsRef = useRef<Set<string>>(new Set());
  const cachedSelectionRef = useRef<SelectionCache | null>(null);

  const stableLabels = useMemo(() => {
    if (!settings.general.showLabels)
      return { result: [] as LabelCandidate[], allCandidates: [] as LabelCandidate[] };

    const bounds = camera.getVisibleBounds();
    const camZoom = camera.zoom;
    const cached = cachedSelectionRef.current;
    const reselect = needsReselection(cached, bounds, camZoom, selectedId);

    const candidates = buildCandidates(
      data.nodes, nodePositions, camera, bounds,
      maxDegree, selectedId, pathInfo, maxDistance,
    );

    // Reuse previous selection with fresh screen positions when possible
    if (!reselect && cached) {
      return {
        result: candidates.filter((c) => cached.ids.has(c.node.id)),
        allCandidates: candidates,
      };
    }

    const result = selectLabels(
      candidates, camera.canvasW || 1, camera.canvasH || 1, prevLabelIdsRef.current,
    );

    const newIds = new Set(result.map((c) => c.node.id));
    prevLabelIdsRef.current = newIds;
    cachedSelectionRef.current = {
      ids: newIds,
      boundsMinX: bounds[0], boundsMinY: bounds[1],
      boundsMaxX: bounds[2], boundsMaxY: bounds[3],
      zoom: camZoom, selectedId,
    };

    return { result, allCandidates: candidates };
  }, [
    data.nodes, camera, nodePositions,
    settings.general.showLabels, selectedId, pathInfo,
    maxDegree, maxDistance, cameraVersion,
  ]);

  // Ensure hovered label is always shown, even if culled by overlap.
  const labels = useMemo(() => {
    const { result, allCandidates } = stableLabels;
    if (!hoveredId || result.some((c) => c.node.id === hoveredId)) {
      return result;
    }
    const hovered = allCandidates.find((c) => c.node.id === hoveredId);
    return hovered ? [...result, hovered] : result;
  }, [stableLabels, hoveredId]);

  // --- Imperative DOM sync ---
  const labelElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const exitingElementsRef = useRef<Map<string, { el: HTMLDivElement; nodeIndex: number }>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const elements = labelElementsRef.current;
    const exiting = exitingElementsRef.current;
    const currentIds = new Set<string>();

    for (const label of labels) {
      currentIds.add(label.node.id);

      // Cancel exit if this label is back
      if (exiting.has(label.node.id)) {
        const entry = exiting.get(label.node.id)!;
        entry.el.classList.remove("node-label-exit");
        exiting.delete(label.node.id);
        elements.set(label.node.id, entry.el);
      }

      let el = elements.get(label.node.id);
      if (!el) {
        el = createLabelElement(label.node.id, label.node.label, refs);
        container.appendChild(el);
        elements.set(label.node.id, el);
      }

      updateLabelStyle(el, label, maxDegree, colorLightness, hoveredId, selectedId);
    }

    // Start fade-out for removed labels
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

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden node-label-container"
      style={{ pointerEvents: "none", willChange: "transform" }}
    />
  );
}
