/**
 * Imperative label management extracted from Labels.tsx.
 * Manages DOM label elements for the graph view without React dependencies.
 */

import {
  nodeColour,
  NodeColourLightness,
  type NodeData,
  nodeIdToInt,
} from "../../data";
import type { Camera } from "./Camera";
import type { PathInfo } from "./pathInfo";
import { resolvePathNodeClick } from "./nodeActivation";
import {
  MAX_VISIBLE_LABELS,
  LABEL_REFERENCE_AREA,
  LABEL_COUNT_MIN,
  LABEL_COUNT_MAX,
  LABEL_ZOOM_THRESHOLD,
  LABEL_ZOOM_RATE,
  LABEL_LIGHTNESS_BOOST,
  LABEL_SPACING_FACTOR,
  LABEL_RESELECT_PAN_PX,
  LABEL_RESELECT_ZOOM_STEP,
  LABEL_FONT_SIZE_BASE,
  LABEL_FONT_SIZE_DEGREE,
  LABEL_CHAR_WIDTH_RATIO,
  LABEL_PADDING_H,
  LABEL_PADDING_V,
  LABEL_GAP,
  LABEL_OPACITY_FALLOFF,
  LABEL_HOVER_LIGHTNESS_BOOST,
  LABEL_SELECTED_LIGHTNESS_BOOST,
  LABEL_DIM_BRIGHTNESS,
  LABEL_DIM_OPACITY,
  LABEL_SELECTED_SIZE_MULT,
  CURSOR_PROXIMITY_RADIUS,
} from "./graphConstants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Current search/pathfinding mode, determines label click and button behavior. */
export type SearchMode = "initial" | "selected" | "path";

/** Callbacks for label event handlers to read/write graph state. */
export interface LabelCallbacks {
  getSelectedId(): string | null;
  getHoveredId(): string | null;
  getSearchMode(): SearchMode;
  getPath(): string[] | null;
  setSelectedId(id: string | null): void;
  setHoveredId(id: string | null): void;
  onSetAsSource(nodeId: string): void;
  onSetAsDestination(nodeId: string): void;
  onCameraChange(): void;
  scheduleRender(): void;
}

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

type SelectionCache = {
  ids: Set<string>;
  /** Canonical viewport signature this set was selected for. */
  signature: string;
};

type LabelEntry = {
  el: HTMLDivElement;
  toBtn: HTMLButtonElement;
  fromBtn: HTMLButtonElement;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAG_THRESHOLD = 5;
const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD = 40;
const TOUCH_LIFT_PX = 50;

const ACTION_BTN_BASE =
  "hidden absolute top-0 bottom-0 px-2 cursor-pointer pointer-events-auto whitespace-nowrap items-center transition-opacity duration-200";

const ARROW_LEFT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m0 0l7 7m-7-7l7-7"/></svg>`;
const ARROW_RIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m0 0l-7-7m7 7l-7 7"/></svg>`;

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
  path: string[] | null,
  noPathEndpoints: { source: string; destination: string } | null = null
): LabelCandidate[] {
  const [minX, minY, maxX, maxY] = bounds;
  const candidates: LabelCandidate[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const wx = nodePositions[i * 2];
    const wy = nodePositions[i * 2 + 1];

    if (wx < minX || wx > maxX || wy < minY || wy > maxY) continue;

    const [sx, sy] = camera.worldToScreen(wx, wy);
    const baseFontSize =
      LABEL_FONT_SIZE_BASE +
      (node.edges.length / maxDegree) * LABEL_FONT_SIZE_DEGREE;
    const fullScale = camera.zoom / LABEL_ZOOM_THRESHOLD;
    const selectedMult =
      selectedId !== null && node.id === selectedId
        ? LABEL_SELECTED_SIZE_MULT
        : 1;
    const fontSize =
      baseFontSize *
      selectedMult *
      Math.max(1, 1 + (fullScale - 1) * LABEL_ZOOM_RATE);

    let priority = node.edges.length;
    let inSelectedNet = false;
    let selectionDistance = Infinity;

    if (selectedId) {
      if (path !== null) {
        // Pathfinding mode: only path nodes are in the selected net
        const pathIndex = path.indexOf(node.id);
        if (pathIndex !== -1) {
          // Highest priority; path endpoints even higher
          priority += 200000 - pathIndex;
          inSelectedNet = true;
          selectionDistance = 0;
        }
      } else if (node.id === selectedId) {
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

    // Keep both endpoints of an unreachable route labelled, not just the
    // selected one, so the user can read where the broken connector lands.
    if (
      noPathEndpoints &&
      (node.id === noPathEndpoints.source ||
        node.id === noPathEndpoints.destination)
    ) {
      priority = 200000;
      inSelectedNet = true;
      selectionDistance = 0;
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

  return candidates;
}

// ---------------------------------------------------------------------------
// Label selection (grid bucketing + overlap culling)
// ---------------------------------------------------------------------------

/**
 * Deterministic candidate ordering: higher priority first, ties broken by node
 * id so the result never depends on input/iteration order.
 */
function byPriorityThenId(a: LabelCandidate, b: LabelCandidate): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.node.id < b.node.id ? -1 : a.node.id > b.node.id ? 1 : 0;
}

type PlacedBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

/**
 * Select which labels to display.
 *
 * Pure function of `(candidates, viewport)` — no history, no spatial grid, so
 * the same viewport always yields the same set. Candidates are placed greedily
 * in priority order; a candidate is dropped if its box overlaps an already
 * placed label, or (for non-selection labels) if its centre falls within the
 * spacing radius of one. The spacing radius spreads labels across the graph
 * the way the old grid did, but continuously: as labels drift apart a
 * suppressed one reappears one at a time rather than a whole cell reshuffling.
 */
function selectLabels(
  candidates: LabelCandidate[],
  screenW: number,
  screenH: number
): LabelCandidate[] {
  // Scale label budget by viewport area relative to reference resolution
  const maxLabels = Math.max(
    LABEL_COUNT_MIN,
    Math.min(
      LABEL_COUNT_MAX,
      Math.round(
        MAX_VISIBLE_LABELS * ((screenW * screenH) / LABEL_REFERENCE_AREA)
      )
    )
  );

  // Minimum centre-to-centre separation for an even spread of `maxLabels`
  // labels over the viewport, scaled by the spacing factor.
  const spacingRadius =
    Math.sqrt((screenW * screenH) / maxLabels) * LABEL_SPACING_FACTOR;
  const spacingR2 = spacingRadius * spacingRadius;

  const placed: PlacedBox[] = [];
  const result: LabelCandidate[] = [];

  const boxOf = (c: LabelCandidate): PlacedBox => {
    const charWidth = c.fontSize * LABEL_CHAR_WIDTH_RATIO;
    const w = c.node.label.length * charWidth + LABEL_PADDING_H + LABEL_GAP;
    const h = c.fontSize + LABEL_PADDING_V + LABEL_GAP;
    return {
      x: c.screenX - w / 2,
      y: c.screenY - h,
      w,
      h,
      cx: c.screenX,
      cy: c.screenY,
    };
  };

  // `exempt` labels (the selection + its neighbourhood) ignore the budget and
  // the spacing radius, but still can't be stacked directly on top of another
  // placed label.
  const tryPlace = (c: LabelCandidate, exempt: boolean): boolean => {
    if (!exempt && result.length >= maxLabels) return false;
    const b = boxOf(c);
    for (const p of placed) {
      if (
        b.x < p.x + p.w &&
        b.x + b.w > p.x &&
        b.y < p.y + p.h &&
        b.y + b.h > p.y
      ) {
        return false;
      }
      if (!exempt) {
        const ddx = b.cx - p.cx;
        const ddy = b.cy - p.cy;
        if (ddx * ddx + ddy * ddy < spacingR2) return false;
      }
    }
    placed.push(b);
    result.push(c);
    return true;
  };

  const selectedCandidates = candidates
    .filter((c) => c.inSelectedNet)
    .sort(byPriorityThenId);
  const otherCandidates = candidates
    .filter((c) => !c.inSelectedNet)
    .sort(byPriorityThenId);

  for (const c of selectedCandidates) tryPlace(c, true);
  for (const c of otherCandidates) tryPlace(c, false);

  return result;
}

// ---------------------------------------------------------------------------
// Throttle cache helpers
// ---------------------------------------------------------------------------

/**
 * Canonical viewport signature for gating label reselection.
 *
 * Selection is a pure function of `(viewport, selectedId)`, but recomputing it
 * every frame churns the label set (and thrashes the DOM) as candidates jitter
 * across the spacing/budget boundaries. Instead we quantise the camera into
 * buckets anchored to the world origin and to canonical zoom levels — not to a
 * path-dependent previous position — and only reselect when the bucket changes.
 *
 * Because the buckets are absolute, the same camera state always maps to the
 * same signature regardless of how it was reached: select a node, zoom out,
 * zoom back in, and the signature (hence the label set) is identical. Between
 * buckets the cached set is reused and tracked by the container CSS transform.
 */
function viewportSignature(
  bounds: [number, number, number, number],
  zoom: number,
  selectedId: string | null
): string {
  const zoomStep = Math.round(
    Math.log(zoom) / Math.log(LABEL_RESELECT_ZOOM_STEP)
  );
  // Canonical zoom for this bucket -> canonical world units per pan step, so
  // the pan grid is reproducible rather than tied to the live zoom.
  const canonicalZoom = Math.pow(LABEL_RESELECT_ZOOM_STEP, zoomStep);
  const cellWorld = LABEL_RESELECT_PAN_PX / canonicalZoom;
  const centerX = (bounds[0] + bounds[2]) / 2;
  const centerY = (bounds[1] + bounds[3]) / 2;
  const panX = Math.round(centerX / cellWorld);
  const panY = Math.round(centerY / cellWorld);
  return `${selectedId ?? ""}|${zoomStep}|${panX}|${panY}`;
}

// ---------------------------------------------------------------------------
// Imperative DOM helpers
// ---------------------------------------------------------------------------

/** Handle a label click based on current search mode. */
function handleLabelClick(nodeId: string, callbacks: LabelCallbacks): void {
  const sid = callbacks.getSelectedId();
  const mode = callbacks.getSearchMode();

  if (mode === "path") {
    const currentPath = callbacks.getPath();
    if (!currentPath) {
      // No reachable path: clicking either lit endpoint just views it.
      callbacks.setSelectedId(nodeId);
    } else if (currentPath.includes(nodeId)) {
      callbacks.setSelectedId(resolvePathNodeClick(nodeId, sid, currentPath));
    }
    // Off-path: no-op (use long-press for buttons on mobile, hover on desktop)
  } else {
    // initial/selected: toggle selection
    callbacks.setSelectedId(sid === nodeId ? null : nodeId);
  }
}

/** Create the flanking "to" (left) and "from" (right) action buttons for a label. */
function createActionButtons(
  nodeId: string,
  callbacks: LabelCallbacks
): { toBtn: HTMLButtonElement; fromBtn: HTMLButtonElement } {
  const makeButton = (html: string, onClick: () => void) => {
    const btn = document.createElement("button");
    btn.innerHTML = html;
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  // "from" on the left -- set as source
  const fromBtn = makeButton(`${ARROW_LEFT_SVG}&nbsp;from`, () => {
    callbacks.onSetAsSource(nodeId);
  });
  fromBtn.className = `${ACTION_BTN_BASE} right-full`;
  fromBtn.style.background = "rgba(170, 120, 52, 0.85)";
  fromBtn.style.color = "#f4eeddee";

  // "to" on the right -- set as destination
  const toBtn = makeButton(`to&nbsp;${ARROW_RIGHT_SVG}`, () => {
    callbacks.onSetAsDestination(nodeId);
  });
  toBtn.className = `${ACTION_BTN_BASE} left-full`;
  toBtn.style.background = "rgba(52, 116, 138, 0.85)";
  toBtn.style.color = "#f4eeddee";

  return { toBtn, fromBtn };
}

/** Update which action buttons are visible based on search mode. */
function updateActionButtons(
  _el: HTMLDivElement,
  toBtn: HTMLButtonElement,
  fromBtn: HTMLButtonElement,
  nodeId: string,
  callbacks: LabelCallbacks
): void {
  const mode = callbacks.getSearchMode();
  const show = (btn: HTMLButtonElement) => {
    btn.classList.remove("hidden");
    btn.classList.add("flex");
  };
  const hide = (btn: HTMLButtonElement) => {
    btn.classList.add("hidden");
    btn.classList.remove("flex");
  };

  let showTo = false;
  let showFrom = false;

  if (mode === "selected") {
    // Don't show "to" for the source node itself
    showTo = callbacks.getSelectedId() !== nodeId;
  } else if (mode === "path") {
    const currentPath = callbacks.getPath();
    const isSource = currentPath && currentPath[0] === nodeId;
    const isDestination =
      currentPath && currentPath[currentPath.length - 1] === nodeId;
    showTo = !isSource && !isDestination;
    showFrom = !isSource;
  }

  if (showTo) show(toBtn);
  else hide(toBtn);
  if (showFrom) show(fromBtn);
  else hide(fromBtn);
}

/** Update a label element's inline styles to reflect current state. */
function updateLabelStyle(
  el: HTMLDivElement,
  label: LabelCandidate,
  maxDegree: number,
  hoveredId: string | null,
  selectedId: string | null,
  cursorWorld: { x: number; y: number }
): void {
  const isHovered = hoveredId === label.node.id;
  const isSelected = selectedId === label.node.id;

  // Cursor proximity factor (0 = far, 1 = at cursor)
  const dx = label.node.x - cursorWorld.x;
  const dy = label.node.y - cursorWorld.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const proximity = Math.max(0, 1 - dist / CURSOR_PROXIMITY_RADIUS);

  const boost =
    (isHovered ? LABEL_HOVER_LIGHTNESS_BOOST : 0) +
    (isSelected ? LABEL_SELECTED_LIGHTNESS_BOOST : 0) +
    proximity * 5;

  const bgColor = nodeColour(
    label.node,
    maxDegree,
    NodeColourLightness.GraphLabelBackgroundBorder +
      LABEL_LIGHTNESS_BOOST +
      boost
  );
  const textColor = nodeColour(
    label.node,
    maxDegree,
    NodeColourLightness.GraphLabelText + LABEL_LIGHTNESS_BOOST + boost
  );

  let filterStyle = "";
  let opacityStyle = 1;
  if (selectedId && !isHovered) {
    if (label.inSelectedNet) {
      opacityStyle =
        label.selectionDistance <= 1
          ? 1.0
          : Math.pow(LABEL_OPACITY_FALLOFF, label.selectionDistance - 1);
    } else {
      filterStyle = `brightness(${LABEL_DIM_BRIGHTNESS})`;
      opacityStyle = LABEL_DIM_OPACITY;
    }
    // Boost dimmed labels near cursor
    if (proximity > 0 && !label.inSelectedNet) {
      opacityStyle = Math.min(1, opacityStyle + proximity * 0.8);
      filterStyle = `brightness(${LABEL_DIM_BRIGHTNESS + proximity * (1 - LABEL_DIM_BRIGHTNESS)})`;
    }
  }

  const s = el.style;
  const touchOffset = el.dataset.touchActive ? -TOUCH_LIFT_PX : 0;
  s.transform = `translate(${label.screenX}px, ${label.screenY + touchOffset}px) translate(-50%, -100%)`;
  s.fontSize = `${label.fontSize}px`;
  s.backgroundColor = `color-mix(in srgb, ${bgColor} 78%, #04060f)`;
  s.borderColor = `color-mix(in srgb, ${textColor} 50%, transparent)`;
  s.color = textColor;
  s.filter = filterStyle;
  s.opacity = String(opacityStyle);
}

// ---------------------------------------------------------------------------
// LabelManager class
// ---------------------------------------------------------------------------

/** Manages the HTML label overlay for graph nodes. */
export class LabelManager {
  private container: HTMLDivElement;
  private camera: Camera;
  private callbacks: LabelCallbacks;

  private labelElements = new Map<string, LabelEntry>();
  private exitingElements = new Map<
    string,
    { el: HTMLDivElement; nodeIndex: number }
  >();
  private cachedSelection: SelectionCache | null = null;
  private cursorWorld = { x: 0, y: 0 };

  constructor(
    container: HTMLDivElement,
    camera: Camera,
    callbacks: LabelCallbacks
  ) {
    this.container = container;
    this.camera = camera;
    this.callbacks = callbacks;
  }

  setCursorWorld(x: number, y: number): void {
    this.cursorWorld.x = x;
    this.cursorWorld.y = y;
  }

  update(
    nodes: NodeData[],
    nodePositions: Float32Array,
    maxDegree: number,
    selectedId: string | null,
    hoveredId: string | null,
    pathInfo: PathInfo,
    maxDistance: number,
    path: string[] | null,
    showLabels: boolean,
    noPathEndpoints: { source: string; destination: string } | null = null
  ): void {
    const camera = this.camera;

    // --- Stable label selection (equivalent to stableLabels useMemo) ---
    let stableResult: LabelCandidate[];
    let allCandidates: LabelCandidate[];

    if (!showLabels) {
      stableResult = [];
      allCandidates = [];
    } else {
      const bounds = camera.getVisibleBounds();
      const camZoom = camera.zoom;
      const signature = viewportSignature(bounds, camZoom, selectedId);
      const reselect =
        !this.cachedSelection || this.cachedSelection.signature !== signature;

      const candidates = buildCandidates(
        nodes,
        nodePositions,
        camera,
        bounds,
        maxDegree,
        selectedId,
        pathInfo,
        maxDistance,
        path,
        noPathEndpoints
      );

      // Reuse previous selection with fresh screen positions when possible
      if (!reselect && this.cachedSelection) {
        stableResult = candidates.filter((c) =>
          this.cachedSelection!.ids.has(c.node.id)
        );
      } else {
        stableResult = selectLabels(
          candidates,
          camera.canvasW || 1,
          camera.canvasH || 1
        );

        const newIds = new Set(stableResult.map((c) => c.node.id));
        this.cachedSelection = { ids: newIds, signature };
      }

      allCandidates = candidates;
    }

    // --- Merge hovered + proximity labels (equivalent to labels useMemo) ---
    const resultIds = new Set(stableResult.map((c) => c.node.id));
    const extras: LabelCandidate[] = [];

    // Force-show hovered label
    if (hoveredId && !resultIds.has(hoveredId)) {
      const hovered = allCandidates.find((c) => c.node.id === hoveredId);
      if (hovered) {
        extras.push(hovered);
        resultIds.add(hoveredId);
      }
    }

    // Force-show labels near cursor, with overlap culling
    const cx = this.cursorWorld.x;
    const cy = this.cursorWorld.y;
    const r2 = CURSOR_PROXIMITY_RADIUS * CURSOR_PROXIMITY_RADIUS;

    // Build placed-box array from existing labels for overlap checks
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const c of stableResult) {
      const charWidth = c.fontSize * LABEL_CHAR_WIDTH_RATIO;
      const w = c.node.label.length * charWidth + LABEL_PADDING_H + LABEL_GAP;
      const h = c.fontSize + LABEL_PADDING_V + LABEL_GAP;
      placed.push({ x: c.screenX - w / 2, y: c.screenY - h, w, h });
    }
    for (const c of extras) {
      const charWidth = c.fontSize * LABEL_CHAR_WIDTH_RATIO;
      const w = c.node.label.length * charWidth + LABEL_PADDING_H + LABEL_GAP;
      const h = c.fontSize + LABEL_PADDING_V + LABEL_GAP;
      placed.push({ x: c.screenX - w / 2, y: c.screenY - h, w, h });
    }

    // Sort proximity candidates by distance to cursor (closest first)
    const proximityCandidates = allCandidates
      .filter((c) => {
        if (resultIds.has(c.node.id)) return false;
        const pdx = c.node.x - cx;
        const pdy = c.node.y - cy;
        return pdx * pdx + pdy * pdy < r2;
      })
      .sort((a, b) => {
        const da = (a.node.x - cx) ** 2 + (a.node.y - cy) ** 2;
        const db = (b.node.x - cx) ** 2 + (b.node.y - cy) ** 2;
        return da - db;
      });

    for (const c of proximityCandidates) {
      const charWidth = c.fontSize * LABEL_CHAR_WIDTH_RATIO;
      const w = c.node.label.length * charWidth + LABEL_PADDING_H + LABEL_GAP;
      const h = c.fontSize + LABEL_PADDING_V + LABEL_GAP;
      const x = c.screenX - w / 2;
      const y = c.screenY - h;

      let overlaps = false;
      for (const p of placed) {
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        extras.push(c);
        resultIds.add(c.node.id);
        placed.push({ x, y, w, h });
      }
    }

    const labels =
      extras.length > 0 ? [...stableResult, ...extras] : stableResult;

    // --- Imperative DOM sync (equivalent to useLayoutEffect) ---
    const elements = this.labelElements;
    const exiting = this.exitingElements;
    const currentIds = new Set<string>();

    for (const label of labels) {
      currentIds.add(label.node.id);

      // Cancel exit if this label is back
      if (exiting.has(label.node.id)) {
        const exitEntry = exiting.get(label.node.id)!;
        exitEntry.el.classList.remove("node-label-exit");
        exiting.delete(label.node.id);
        // Re-wrap as LabelEntry (buttons are still children of the element)
        const toBtn = exitEntry.el.querySelector(
          "button:first-of-type"
        ) as HTMLButtonElement;
        const fromBtn = exitEntry.el.querySelector(
          "button:last-of-type"
        ) as HTMLButtonElement;
        elements.set(label.node.id, { el: exitEntry.el, toBtn, fromBtn });
      }

      let entry = elements.get(label.node.id);
      if (!entry) {
        entry = this.createLabelElement(label.node.id, label.node.label);
        this.container.appendChild(entry.el);
        elements.set(label.node.id, entry);
      }

      updateLabelStyle(
        entry.el,
        label,
        maxDegree,
        hoveredId,
        selectedId,
        this.cursorWorld
      );

      // Show/hide buttons for selected or hovered nodes (desktop)
      const isSelected = selectedId === label.node.id;
      const isHovered = hoveredId === label.node.id;
      if (isSelected || isHovered) {
        updateActionButtons(
          entry.el,
          entry.toBtn,
          entry.fromBtn,
          label.node.id,
          this.callbacks
        );
      } else {
        entry.toBtn.classList.add("hidden");
        entry.toBtn.classList.remove("flex");
        entry.fromBtn.classList.add("hidden");
        entry.fromBtn.classList.remove("flex");
      }
    }

    // Start fade-out for removed labels
    for (const [id, entry] of elements) {
      if (!currentIds.has(id)) {
        elements.delete(id);
        const nodeIndex = nodeIdToInt(id);
        entry.el.classList.add("node-label-exit");
        exiting.set(id, { el: entry.el, nodeIndex });
        const remove = () => {
          // The label may have re-entered (cancel-exit re-wraps it into
          // `elements` and clears the `exiting` entry). Only tear it out if
          // this element is still the one registered as exiting, otherwise a
          // stale timer would detach a live label.
          const current = exiting.get(id);
          if (!current || current.el !== entry.el) return;
          entry.el.remove();
          exiting.delete(id);
        };
        entry.el.addEventListener("animationend", remove, { once: true });
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
  }

  updateExitingPositions(nodePositions: Float32Array): void {
    const camera = this.camera;
    for (const [, { el, nodeIndex }] of this.exitingElements) {
      const wx = nodePositions[nodeIndex * 2];
      const wy = nodePositions[nodeIndex * 2 + 1];
      const [sx, sy] = camera.worldToScreen(wx, wy);
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
    }
  }

  destroy(): void {
    for (const [, entry] of this.labelElements) {
      entry.el.remove();
    }
    this.labelElements.clear();

    for (const [, { el }] of this.exitingElements) {
      el.remove();
    }
    this.exitingElements.clear();

    this.cachedSelection = null;
  }

  // -----------------------------------------------------------------------
  // Private: DOM element creation
  // -----------------------------------------------------------------------

  /** Create a label DOM element with event listeners that read state from callbacks. */
  private createLabelElement(nodeId: string, text: string): LabelEntry {
    const el = document.createElement("div");
    el.className = "node-label node-label-enter relative";

    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    el.appendChild(textSpan);

    const { toBtn, fromBtn } = createActionButtons(nodeId, this.callbacks);
    el.appendChild(toBtn);
    el.appendChild(fromBtn);

    el.addEventListener(
      "animationend",
      () => {
        el.classList.remove("node-label-enter");
      },
      { once: true }
    );

    el.addEventListener("contextmenu", (e) => e.preventDefault());

    const callbacks = this.callbacks;
    const camera = this.camera;
    const container = this.container;

    el.addEventListener("pointerenter", () => {
      callbacks.setHoveredId(nodeId);
      updateActionButtons(el, toBtn, fromBtn, nodeId, callbacks);
    });
    el.addEventListener("pointerleave", () => {
      if (callbacks.getHoveredId() === nodeId) callbacks.setHoveredId(null);
      // Keep buttons visible if this node is currently selected
      if (callbacks.getSelectedId() !== nodeId) {
        toBtn.classList.add("hidden");
        toBtn.classList.remove("flex");
        fromBtn.classList.add("hidden");
        fromBtn.classList.remove("flex");
      }
    });
    el.addEventListener(
      "wheel",
      (e) => {
        const rect = container.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        camera.smoothZoomAt(sx, sy, factor);
        callbacks.onCameraChange();
      },
      { passive: true }
    );
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const cam = camera;
      const onChange = () => callbacks.onCameraChange();

      if (e.pointerType === "touch") {
        let totalDist = 0;
        let lastX = e.clientX;
        let lastY = e.clientY;
        let sawMultitouch = false;
        let longPressed = false;
        let lpStartX = e.clientX;
        let swipeShowTo = false;
        let swipeShowFrom = false;

        // Prevent iOS selection/callout during touch interaction
        el.style.touchAction = "none";

        // Long-press timer: animate label upward and fade in swipe indicators
        let lpTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          lpTimer = null;
          const mode = callbacks.getSearchMode();
          // Determine available actions
          if (mode === "selected") {
            swipeShowTo = callbacks.getSelectedId() !== nodeId;
            swipeShowFrom = false;
          } else if (mode === "path") {
            const currentPath = callbacks.getPath();
            const isSource = currentPath && currentPath[0] === nodeId;
            const isDestination =
              currentPath && currentPath[currentPath.length - 1] === nodeId;
            swipeShowTo = !isSource && !isDestination;
            swipeShowFrom = !isSource;
          }
          if (!swipeShowTo && !swipeShowFrom) return;

          longPressed = true;
          lpStartX = lastX;

          // Lift label above finger with animated transition
          el.dataset.touchActive = "1";
          el.style.zIndex = "10";
          el.style.transition = "transform 200ms ease-out";
          const currentTransform = el.style.transform;
          el.style.transform = currentTransform.replace(
            /translate\(([^,]+),\s*([^)]+)\)/,
            (_, x, y) => `translate(${x}, ${parseFloat(y) - TOUCH_LIFT_PX}px)`
          );
          // Clear transition after animation so layout updates don't animate
          setTimeout(() => {
            el.style.transition = "";
          }, 200);

          // Show buttons with fade-in: start at opacity 0, transition to 0.5
          updateActionButtons(el, toBtn, fromBtn, nodeId, callbacks);
          if (swipeShowFrom) {
            fromBtn.style.opacity = "0";
            requestAnimationFrame(() => {
              fromBtn.style.opacity = "0.5";
            });
          }
          if (swipeShowTo) {
            toBtn.style.opacity = "0";
            requestAnimationFrame(() => {
              toBtn.style.opacity = "0.5";
            });
          }
        }, LONG_PRESS_MS);

        const onMove = (te: TouchEvent) => {
          if (te.touches.length >= 2) {
            sawMultitouch = true;
            if (lpTimer) {
              clearTimeout(lpTimer);
              lpTimer = null;
            }
            // Clear touch state on multitouch
            delete el.dataset.touchActive;
            el.style.zIndex = "";
            el.style.transition = "";
            el.style.touchAction = "";
            return;
          }
          const touch = te.touches[0];
          const dx = touch.clientX - lastX;
          const dy = touch.clientY - lastY;
          totalDist += Math.hypot(dx, dy);

          if (longPressed) {
            // Swipe mode: highlight buttons based on direction, don't pan
            te.preventDefault();
            const swipeDx = touch.clientX - lpStartX;
            // Swipe left = "from" (left button), swipe right = "to" (right button)
            if (swipeShowFrom) {
              fromBtn.style.opacity = swipeDx < -SWIPE_THRESHOLD ? "1" : "0.5";
            }
            if (swipeShowTo) {
              toBtn.style.opacity = swipeDx > SWIPE_THRESHOLD ? "1" : "0.5";
            }
          } else {
            // Normal pan mode -- cancel long-press once dragging starts
            if (totalDist > DRAG_THRESHOLD) {
              if (lpTimer) {
                clearTimeout(lpTimer);
                lpTimer = null;
              }
              el.style.touchAction = "";
            }
            cam.pan(dx, dy);
            onChange();
          }
          lastX = touch.clientX;
          lastY = touch.clientY;
        };
        const cleanupTouch = () => {
          delete el.dataset.touchActive;
          el.style.zIndex = "";
          el.style.transition = "";
          el.style.touchAction = "";
          fromBtn.style.opacity = "";
          toBtn.style.opacity = "";
          toBtn.classList.add("hidden");
          toBtn.classList.remove("flex");
          fromBtn.classList.add("hidden");
          fromBtn.classList.remove("flex");
        };

        const onEnd = (te: TouchEvent) => {
          if (te.touches.length > 0) return;
          if (lpTimer) {
            clearTimeout(lpTimer);
            lpTimer = null;
          }

          if (longPressed) {
            const swipeDx = lastX - lpStartX;
            cleanupTouch();

            // Trigger action based on swipe direction
            if (swipeShowFrom && swipeDx < -SWIPE_THRESHOLD) {
              callbacks.onSetAsSource(nodeId);
            } else if (swipeShowTo && swipeDx > SWIPE_THRESHOLD) {
              callbacks.onSetAsDestination(nodeId);
            }
          } else {
            cleanupTouch();
            if (!sawMultitouch && totalDist < DRAG_THRESHOLD) {
              handleLabelClick(nodeId, callbacks);
            }
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
      const dragState = {
        startX: e.clientX,
        startY: e.clientY,
        totalDist: 0,
      };
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
          handleLabelClick(nodeId, callbacks);
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    return { el, toBtn, fromBtn };
  }
}
