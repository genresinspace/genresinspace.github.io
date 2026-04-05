/**
 * Imperative label management extracted from Labels.tsx.
 * Manages DOM label elements for the graph view without React dependencies.
 */

import {
  nodeColour,
  NodeColourLightnessDark,
  NodeColourLightnessLight,
  type NodeData,
  nodeIdToInt,
} from "../../data";
import type { Camera } from "./Camera";
import type { PathInfo } from "./pathInfo";
import {
  MAX_VISIBLE_LABELS,
  LABEL_REFERENCE_AREA,
  LABEL_COUNT_MIN,
  LABEL_COUNT_MAX,
  LABEL_ZOOM_THRESHOLD,
  LABEL_ZOOM_RATE,
  LABEL_LIGHTNESS_BOOST,
  LABEL_LIGHTNESS_BOOST_LIGHT,
  LABEL_GRID_COLS,
  LABEL_GRID_ROWS,
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
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  zoom: number;
  selectedId: string | null;
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
  "hidden absolute top-0 -bottom-1 px-2 cursor-pointer pointer-events-auto whitespace-nowrap items-center border-b-4 transition-opacity duration-200";

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
  path: string[] | null
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
    const fontSize =
      baseFontSize * Math.max(1, 1 + (fullScale - 1) * LABEL_ZOOM_RATE);

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

/** Select which labels to display using spatial grid bucketing and overlap culling. */
function selectLabels(
  candidates: LabelCandidate[],
  screenW: number,
  screenH: number,
  prevIds: Set<string>
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
  const cellW = screenW / LABEL_GRID_COLS;
  const cellH = screenH / LABEL_GRID_ROWS;
  const grid: LabelCandidate[][] = Array.from(
    { length: LABEL_GRID_COLS * LABEL_GRID_ROWS },
    () => []
  );
  for (const c of otherCandidates) {
    const col = Math.min(Math.floor(c.screenX / cellW), LABEL_GRID_COLS - 1);
    const row = Math.min(Math.floor(c.screenY / cellH), LABEL_GRID_ROWS - 1);
    if (col >= 0 && row >= 0) {
      grid[row * LABEL_GRID_COLS + col].push(c);
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

  // Greedy overlap culling
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const result: LabelCandidate[] = [];

  const tryPlace = (c: LabelCandidate): boolean => {
    if (result.length >= maxLabels) return false;
    const charWidth = c.fontSize * LABEL_CHAR_WIDTH_RATIO;
    const w = c.node.label.length * charWidth + LABEL_PADDING_H + LABEL_GAP;
    const h = c.fontSize + LABEL_PADDING_V + LABEL_GAP;
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
// Throttle cache helpers
// ---------------------------------------------------------------------------

/** Check whether the camera has moved enough to warrant reselecting labels. */
function needsReselection(
  cached: SelectionCache | null,
  bounds: [number, number, number, number],
  zoom: number,
  selectedId: string | null
): boolean {
  if (!cached || cached.selectedId !== selectedId) return true;

  const [minX, minY, maxX, maxY] = bounds;
  const prevW = cached.boundsMaxX - cached.boundsMinX;
  const prevH = cached.boundsMaxY - cached.boundsMinY;
  const panFracX =
    prevW > 0
      ? Math.abs(
          (minX + maxX) / 2 - (cached.boundsMinX + cached.boundsMaxX) / 2
        ) / prevW
      : 1;
  const panFracY =
    prevH > 0
      ? Math.abs(
          (minY + maxY) / 2 - (cached.boundsMinY + cached.boundsMaxY) / 2
        ) / prevH
      : 1;
  const zoomRatio = cached.zoom > 0 ? zoom / cached.zoom : 2;

  // Reselect if panned >25% of viewport or zoom changed by >20%
  return (
    panFracX > 0.25 || panFracY > 0.25 || zoomRatio > 1.2 || zoomRatio < 1 / 1.2
  );
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
    if (currentPath && currentPath.includes(nodeId)) {
      if (sid === nodeId) {
        // Clicking the currently-viewed on-path node: revert to source or clear
        const sourceId = currentPath[0];
        if (sourceId && sourceId !== nodeId) {
          callbacks.setSelectedId(sourceId);
        } else {
          callbacks.setSelectedId(null);
        }
      } else {
        // Select on-path node for viewing
        callbacks.setSelectedId(nodeId);
      }
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
  fromBtn.className = `${ACTION_BTN_BASE} right-full rounded-l-lg`;
  fromBtn.style.background = "rgba(234, 88, 12, 0.75)";
  fromBtn.style.borderBottomColor = "rgba(194, 68, 2, 0.85)";
  fromBtn.style.color = "#e2e8f0";

  // "to" on the right -- set as destination
  const toBtn = makeButton(`to&nbsp;${ARROW_RIGHT_SVG}`, () => {
    callbacks.onSetAsDestination(nodeId);
  });
  toBtn.className = `${ACTION_BTN_BASE} left-full rounded-r-lg`;
  toBtn.style.background = "rgba(59, 130, 246, 0.75)";
  toBtn.style.borderBottomColor = "rgba(49, 110, 206, 0.85)";
  toBtn.style.color = "#e2e8f0";

  return { toBtn, fromBtn };
}

/** Update which action buttons are visible based on search mode. */
function updateActionButtons(
  el: HTMLDivElement,
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

  // Square off label corners where buttons connect (from=left, to=right)
  el.style.borderRadius = `${showFrom ? 0 : 8}px ${showTo ? 0 : 8}px ${showTo ? 0 : 8}px ${showFrom ? 0 : 8}px`;
}

/** Update a label element's inline styles to reflect current state. */
function updateLabelStyle(
  el: HTMLDivElement,
  label: LabelCandidate,
  maxDegree: number,
  colorLightness:
    | typeof NodeColourLightnessDark
    | typeof NodeColourLightnessLight,
  hoveredId: string | null,
  selectedId: string | null,
  cursorWorld: { x: number; y: number },
  theme: string
): void {
  const isLight = theme === "light";
  const isHovered = hoveredId === label.node.id;
  const isSelected = selectedId === label.node.id;

  // Cursor proximity factor (0 = far, 1 = at cursor)
  const dx = label.node.x - cursorWorld.x;
  const dy = label.node.y - cursorWorld.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const proximity = Math.max(0, 1 - dist / CURSOR_PROXIMITY_RADIUS);

  const lightnessBoost = isLight
    ? LABEL_LIGHTNESS_BOOST_LIGHT
    : LABEL_LIGHTNESS_BOOST;
  const proximityBoostDir = isLight ? -5 : 5;

  const boost =
    (isHovered ? LABEL_HOVER_LIGHTNESS_BOOST : 0) +
    (isSelected ? LABEL_SELECTED_LIGHTNESS_BOOST : 0) +
    proximity * proximityBoostDir;

  const bgColor = nodeColour(
    label.node,
    maxDegree,
    colorLightness.GraphLabelBackgroundBorder + lightnessBoost + boost
  );
  const borderColor = nodeColour(
    label.node,
    maxDegree,
    colorLightness.GraphLabelBackground + lightnessBoost + boost
  );
  const textColor = nodeColour(
    label.node,
    maxDegree,
    colorLightness.GraphLabelText + lightnessBoost + boost
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
      if (isLight) {
        // On white bg, use opacity-only dimming (brightness would darken)
        filterStyle = "";
        opacityStyle = 0.15;
      } else {
        filterStyle = `brightness(${LABEL_DIM_BRIGHTNESS})`;
        opacityStyle = LABEL_DIM_OPACITY;
      }
    }
    // Boost dimmed labels near cursor
    if (proximity > 0 && !label.inSelectedNet) {
      if (isLight) {
        opacityStyle = Math.min(1, opacityStyle + proximity * 0.8);
      } else {
        opacityStyle = Math.min(1, opacityStyle + proximity * 0.8);
        filterStyle = `brightness(${LABEL_DIM_BRIGHTNESS + proximity * (1 - LABEL_DIM_BRIGHTNESS)})`;
      }
    }
  }

  const s = el.style;
  const touchOffset = el.dataset.touchActive ? -TOUCH_LIFT_PX : 0;
  s.transform = `translate(${label.screenX}px, ${label.screenY + touchOffset}px) translate(-50%, -100%)`;
  s.fontSize = `${label.fontSize}px`;
  s.backgroundColor = bgColor;
  s.borderBottom = `4px solid ${borderColor}`;
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
  private prevLabelIds = new Set<string>();
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
    theme: string
  ): void {
    const camera = this.camera;
    const colorLightness =
      theme === "light" ? NodeColourLightnessLight : NodeColourLightnessDark;

    // --- Stable label selection (equivalent to stableLabels useMemo) ---
    let stableResult: LabelCandidate[];
    let allCandidates: LabelCandidate[];

    if (!showLabels) {
      stableResult = [];
      allCandidates = [];
    } else {
      const bounds = camera.getVisibleBounds();
      const camZoom = camera.zoom;
      const reselect = needsReselection(
        this.cachedSelection,
        bounds,
        camZoom,
        selectedId
      );

      const candidates = buildCandidates(
        nodes,
        nodePositions,
        camera,
        bounds,
        maxDegree,
        selectedId,
        pathInfo,
        maxDistance,
        path
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
          camera.canvasH || 1,
          this.prevLabelIds
        );

        const newIds = new Set(stableResult.map((c) => c.node.id));
        this.prevLabelIds = newIds;
        this.cachedSelection = {
          ids: newIds,
          boundsMinX: bounds[0],
          boundsMinY: bounds[1],
          boundsMaxX: bounds[2],
          boundsMaxY: bounds[3],
          zoom: camZoom,
          selectedId,
        };
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
        colorLightness,
        hoveredId,
        selectedId,
        this.cursorWorld,
        theme
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
        entry.el.style.borderRadius = "";
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

    this.prevLabelIds.clear();
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
        el.style.borderRadius = "";
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
          el.style.borderRadius = "";
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
