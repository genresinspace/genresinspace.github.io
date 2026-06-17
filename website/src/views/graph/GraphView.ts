/**
 * Imperative graph visualization controller.
 * Owns the WebGL canvas, label overlay, camera, interaction handler, and render loop.
 * Replaces the former React component tree (Graph → GraphCanvas + Labels).
 */

import type { Data } from "../../data";
import type { SettingsData } from "../../settings";
import { Camera } from "./Camera";
import { WebGLRenderer } from "./WebGLRenderer";
import { InteractionHandler } from "./Interaction";
import { hitTestNode, HOVER_HIT_BUFFER } from "./HitTest";
import {
  LabelManager,
  type LabelCallbacks,
  type SearchMode,
} from "./GraphViewLabels";
import {
  getPathsWithinDistance,
  EMPTY_PATH_INFO,
  type PathInfo,
} from "./pathInfo";
import {
  computeNodePositions,
  computeEdgePositions,
  computeEdgeNodeIndices,
  computeNodeColors,
  computeNodeSizes,
  computeEdgeColors,
  computeEdgeWidthScales,
  computeNetArrowGeometry,
  computeArrowGeometry,
  type ArrowGeometry,
} from "./GraphViewComputed";
import {
  TRANSITION_TAU,
  HOVER_DEBOUNCE_MS,
  BG,
  RETICLE_COLOR,
  ARROW_SIZE_MULTIPLIER,
  EDGE_CURVATURE,
  CURSOR_PROXIMITY_RADIUS,
  NODE_LIGHTNESS,
} from "./graphConstants";
import { fitCameraToPositions, gatherNodePositions } from "./cameraFit";
import { NoPathOverlay } from "./NoPathOverlay";
import { resolvePathNodeClick } from "./nodeActivation";
import { FrameInterpolator } from "./FrameInterpolator";

/** Callbacks from the graph view to the parent React component. */
export interface GraphViewCallbacks {
  setSelectedId(id: string | null): void;
  onSetAsSource(nodeId: string): void;
  onSetAsDestination(nodeId: string): void;
}

// ---------------------------------------------------------------------------
// Dirty flags
// ---------------------------------------------------------------------------

interface DirtyFlags {
  pathInfo: boolean;
  nodeColors: boolean;
  nodeSizes: boolean;
  edgeColors: boolean;
  edgeWidthScales: boolean;
  netArrows: boolean;
  arrows: boolean;
  labels: boolean;
  selection: boolean;
}

function allDirty(): DirtyFlags {
  return {
    pathInfo: true,
    nodeColors: true,
    nodeSizes: true,
    edgeColors: true,
    edgeWidthScales: true,
    netArrows: true,
    arrows: true,
    labels: true,
    selection: true,
  };
}

// ---------------------------------------------------------------------------
// Static arrow fade duration (seconds)
// ---------------------------------------------------------------------------

const STATIC_ARROW_FADE_DURATION = 0.5;

// ---------------------------------------------------------------------------
// Label commit throttle interval
// ---------------------------------------------------------------------------

const LABEL_COMMIT_INTERVAL = 33; // ~30 fps

// ---------------------------------------------------------------------------
// GraphView
// ---------------------------------------------------------------------------

/**
 * Imperative graph visualization controller.
 * Owns the WebGL canvas, label overlay, camera, interaction handler, and render loop.
 */
export class GraphView {
  // --- Owned objects ---
  private camera: Camera;
  private renderer: WebGLRenderer;
  private interaction: InteractionHandler;
  private labelManager: LabelManager;
  private resizeObserver: ResizeObserver;

  // --- DOM ---
  private labelContainer: HTMLDivElement;
  private gl: WebGL2RenderingContext;

  // --- External callbacks ---
  private callbacks: GraphViewCallbacks;

  // --- Data (changes rarely) ---
  private data: Data;
  private nodePositions: Float32Array;
  private edgePositions: Float32Array;
  private edgeNodeIndices: { src: Int32Array; tgt: Int32Array };

  // --- Current state ---
  private selectedId: string | null = null;
  private focusedId: string | null = null;
  private hoveredId: string | null = null;
  private path: string[] | null = null;
  // Both route endpoints when set but unreachable: lights both stars and draws
  // the broken connector. Always null while `path` is non-null.
  private noPathEndpoints: { source: string; destination: string } | null =
    null;
  private settings: SettingsData;
  private searchMode: SearchMode = "initial";

  // --- Derived state ---
  private pathInfo: PathInfo = EMPTY_PATH_INFO;
  private targetNodeColors: Float32Array | null = null;
  private targetEdgeColors: Float32Array | null = null;
  private targetNodeSizes: Float32Array | null = null;
  private _edgeWidthScales: Float32Array | null = null;
  private netArrowGeom: Map<number, number> = new Map();
  private arrowGeom: ArrowGeometry | null = null;

  // --- Interpolation ---
  private frame = new FrameInterpolator();

  // --- Render loop ---
  private animFrameId = 0;
  private renderScheduled = false;
  private lastFrameTime = 0;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Static arrow fade ---
  // 1.0 = fully visible (nothing selected), 0.0 = fully hidden (selection active)
  private staticArrowOpacity = 1.0;
  private staticArrowOpacityTarget = 1.0;

  // --- Arrow phase anchors (seconds) ---
  // Net and hover arrows are phased to start at their edge midpoint at the
  // moment they appear. Anchoring them to independent times keeps a hover-only
  // rebuild from re-phasing (and visibly resetting) the selected net arrows.
  private netArrowAnchorTime = performance.now() / 1000;
  private hoverArrowAnchorTime = performance.now() / 1000;

  // --- Dirty flags ---
  private dirty: DirtyFlags = allDirty();

  // --- Label throttle ---
  private lastLabelCommit = 0;
  private pendingLabelCommit = 0;
  private labelSnap = {
    x: 0,
    y: 0,
    zoom: 0,
    screenCenterX: 0,
    screenCenterY: 0,
  };
  private cursorWorld = { x: 0, y: 0 };

  // --- No-path severed connector overlay (SVG inside the label container) ---
  private noPathOverlay: NoPathOverlay;

  // --- Deferred zoom-to-fit request ---
  // Set by requestZoomToSelection/Path; consumed after pathInfo recomputes.
  private pendingZoom: "selection" | "path" | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLDivElement,
    data: Data,
    settings: SettingsData,
    callbacks: GraphViewCallbacks,
    initialState?: {
      selectedId?: string | null;
      focusedId?: string | null;
      path?: string[] | null;
      noPathEndpoints?: { source: string; destination: string } | null;
      searchMode?: SearchMode;
      viewportOffsetX?: number;
      viewportOffsetY?: number;
    }
  ) {
    this.labelContainer = labelContainer;
    this.data = data;
    this.settings = settings;
    this.callbacks = callbacks;

    // Apply initial state before first render
    if (initialState) {
      if (initialState.selectedId != null)
        this.selectedId = initialState.selectedId;
      if (initialState.focusedId != null)
        this.focusedId = initialState.focusedId;
      if (initialState.path != null) this.path = initialState.path;
      if (initialState.noPathEndpoints != null)
        this.noPathEndpoints = initialState.noPathEndpoints;
      if (initialState.searchMode != null)
        this.searchMode = initialState.searchMode;
    }

    // 1. Compute static arrays
    this.nodePositions = computeNodePositions(data.nodes);
    this.edgePositions = computeEdgePositions(data.edges, this.nodePositions);
    this.edgeNodeIndices = computeEdgeNodeIndices(data.edges);

    // Update static arrow fade based on initial selection
    this.updateStaticArrowFadeTarget();
    // Snap opacity immediately (no fade on load)
    this.staticArrowOpacity = this.staticArrowOpacityTarget;

    // 2. Camera
    this.camera = new Camera();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    this.camera.setCanvasSize(w, h);
    if (initialState?.viewportOffsetX != null) {
      this.camera.setViewportOffset(
        initialState.viewportOffsetX,
        initialState.viewportOffsetY ?? 0
      );
    }
    this.camera.fitToContent(this.nodePositions);

    // 3. WebGL
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 not supported");
    this.gl = gl;
    gl.viewport(0, 0, canvas.width, canvas.height);

    this.renderer = new WebGLRenderer(gl);
    this.renderer.setNodePositions(this.nodePositions);
    this.renderer.setEdgePositions(this.edgePositions);
    this.renderer.initNodeSelected(data.nodes.length);

    // 4. Interaction handler
    this.interaction = this.createInteractionHandler(canvas);

    // 5. Label manager
    this.labelManager = new LabelManager(
      labelContainer,
      this.camera,
      this.createLabelCallbacks()
    );

    // 5b. Broken-connector overlay for the no-path state. Lives inside the
    // label container so it rides the same per-frame transform as the labels.
    this.noPathOverlay = new NoPathOverlay(labelContainer);

    // 6. Resize observer
    this.resizeObserver = new ResizeObserver(() => {
      const rw = canvas.clientWidth;
      const rh = canvas.clientHeight;
      canvas.width = rw;
      canvas.height = rh;
      this.gl.viewport(0, 0, rw, rh);
      this.camera.setCanvasSize(rw, rh);
      this.onCameraChange();
      this.scheduleRender();
    });
    this.resizeObserver.observe(canvas);

    // 7. Initial render
    this.scheduleRender();
  }

  // ==========================================================================
  // Interaction + label wiring
  // ==========================================================================

  private createInteractionHandler(
    canvas: HTMLCanvasElement
  ): InteractionHandler {
    return new InteractionHandler(this.camera, canvas, {
      onNodeClick: (idx) => this.handleNodeClick(idx),
      onNodeHover: (idx) => this.handleNodeHover(idx),
      onCursorMove: (wx, wy) => {
        this.cursorWorld.x = wx;
        this.cursorWorld.y = wy;
        this.labelManager.setCursorWorld(wx, wy);
        this.scheduleRender();
      },
      onViewChange: () => {
        this.onCameraChange();
        this.scheduleRender();
      },
      hitTest: (wx, wy) =>
        hitTestNode(
          wx,
          wy,
          this.nodePositions,
          this.frame.nodeSizes || new Float32Array(0),
          HOVER_HIT_BUFFER
        ),
    });
  }

  private createLabelCallbacks(): LabelCallbacks {
    return {
      getSelectedId: () => this.selectedId,
      getHoveredId: () => this.hoveredId,
      getSearchMode: () => this.searchMode,
      getPath: () => this.path,
      setSelectedId: (id) => this.callbacks.setSelectedId(id),
      setHoveredId: (id) => this.setHoveredId(id),
      onSetAsSource: (id) => this.callbacks.onSetAsSource(id),
      onSetAsDestination: (id) => this.callbacks.onSetAsDestination(id),
      onCameraChange: () => {
        this.onCameraChange();
        this.scheduleRender();
      },
      scheduleRender: () => this.scheduleRender(),
    };
  }

  /** Resolve a canvas click on node `idx` (or empty space) to a selection. */
  private handleNodeClick(idx: number | null): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    if (idx === null) {
      this.callbacks.setSelectedId(null);
      return;
    }
    const nodeId = this.data.nodes[idx].id;
    if (this.path) {
      // Only on-path nodes respond while a path is shown.
      if (this.path.includes(nodeId)) {
        this.callbacks.setSelectedId(
          resolvePathNodeClick(nodeId, this.selectedId, this.path)
        );
      }
    } else {
      // No path: toggle selection.
      this.callbacks.setSelectedId(this.selectedId !== nodeId ? nodeId : null);
    }
  }

  private handleNodeHover(idx: number | null): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
    const nodeId = idx !== null ? this.data.nodes[idx].id : null;
    if (nodeId === this.hoveredId) return;
    this.hoverTimer = setTimeout(() => {
      this.setHoveredId(nodeId);
      this.hoverTimer = null;
    }, HOVER_DEBOUNCE_MS);
  }

  // ==========================================================================
  // Public setters (called by React wrapper)
  // ==========================================================================

  setSelectedId(id: string | null): void {
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.dirty.pathInfo = true;
    this.dirty.nodeColors = true;
    this.dirty.nodeSizes = true;
    this.dirty.edgeColors = true;
    this.dirty.edgeWidthScales = true;
    this.dirty.netArrows = true;
    this.dirty.arrows = true;
    this.dirty.labels = true;
    this.dirty.selection = true;
    this.updateStaticArrowFadeTarget();
    this.scheduleRender();
  }

  setFocusedId(id: string | null): void {
    if (id === this.focusedId) return;
    this.focusedId = id;
    this.dirty.nodeSizes = true;
    this.scheduleRender();
  }

  private setHoveredId(id: string | null): void {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    // New hover edges should emerge from their midpoint; re-anchor hover phase.
    this.hoverArrowAnchorTime = performance.now() / 1000;
    this.dirty.nodeColors = true;
    this.dirty.nodeSizes = true;
    this.dirty.edgeColors = true;
    this.dirty.arrows = true;
    this.dirty.labels = true;
    this.updateStaticArrowFadeTarget();
    this.scheduleRender();
  }

  setPath(path: string[] | null): void {
    if (path === this.path) return;
    this.path = path;
    this.dirty.nodeColors = true;
    this.dirty.nodeSizes = true;
    this.dirty.edgeColors = true;
    this.dirty.edgeWidthScales = true;
    this.dirty.netArrows = true;
    this.dirty.arrows = true;
    this.dirty.labels = true;
    this.scheduleRender();
  }

  setNoPathEndpoints(
    endpoints: { source: string; destination: string } | null
  ): void {
    const cur = this.noPathEndpoints;
    if (
      cur === endpoints ||
      (cur &&
        endpoints &&
        cur.source === endpoints.source &&
        cur.destination === endpoints.destination)
    ) {
      return;
    }
    this.noPathEndpoints = endpoints;
    // Entering/leaving the no-path state suppresses or restores the coverage
    // net, so colours, sizes, edges, arrows, and labels all change.
    this.dirty.pathInfo = true;
    this.dirty.nodeColors = true;
    this.dirty.nodeSizes = true;
    this.dirty.edgeColors = true;
    this.dirty.netArrows = true;
    this.dirty.arrows = true;
    this.dirty.labels = true;
    this.noPathOverlay.setEndpoints(endpoints);
    this.refreshNoPathOverlay();
    this.scheduleRender();
  }

  setSettings(settings: SettingsData): void {
    if (settings === this.settings) return;
    const old = this.settings;
    this.settings = settings;

    if (old.visibleTypes !== settings.visibleTypes) {
      this.dirty.pathInfo = true;
      this.dirty.edgeColors = true;
      this.dirty.netArrows = true;
      this.dirty.arrows = true;
    }
    if (
      old.general.maxInfluenceDistance !== settings.general.maxInfluenceDistance
    ) {
      this.dirty.pathInfo = true;
      this.dirty.nodeColors = true;
      this.dirty.nodeSizes = true;
      this.dirty.edgeColors = true;
      this.dirty.netArrows = true;
      this.dirty.arrows = true;
    }
    if (old.general.showLabels !== settings.general.showLabels) {
      this.dirty.labels = true;
    }
    if (
      old.general.arrowSizeScale !== settings.general.arrowSizeScale ||
      old.general.curvedEdges !== settings.general.curvedEdges
    ) {
      // These are read directly in the render call, just need a frame
    }
    this.dirty.labels = true;
    this.scheduleRender();
  }

  setSearchMode(mode: SearchMode): void {
    if (mode === this.searchMode) return;
    this.searchMode = mode;
    this.dirty.labels = true;
    this.scheduleRender();
  }

  setViewportOffset(x: number, y: number): void {
    this.camera.setViewportOffset(x, y);
    this.onCameraChange();
    this.scheduleRender();
  }

  setCallbacks(callbacks: Partial<GraphViewCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  requestZoomToSelection(): void {
    this.pendingZoom = "selection";
    this.scheduleRender();
  }

  requestZoomToPath(): void {
    this.pendingZoom = "path";
    this.scheduleRender();
  }

  destroy(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    cancelAnimationFrame(this.animFrameId);
    cancelAnimationFrame(this.pendingLabelCommit);
    this.renderScheduled = false;
    this.resizeObserver.disconnect();
    this.interaction.destroy();
    this.renderer.destroy();
    this.labelManager.destroy();
    this.noPathOverlay.destroy();
  }

  private updateStaticArrowFadeTarget(): void {
    this.staticArrowOpacityTarget =
      this.selectedId !== null || this.hoveredId !== null ? 0.0 : 1.0;
  }

  // ==========================================================================
  // Render scheduling
  // ==========================================================================

  private scheduleRender(): void {
    if (!this.renderScheduled) {
      this.renderScheduled = true;
      this.animFrameId = requestAnimationFrame(() => this.renderLoop());
    }
  }

  // ==========================================================================
  // Dirty-flag recomputation
  // ==========================================================================

  private recomputeIfDirty(): void {
    const d = this.dirty;
    const maxDistance = this.settings.general.maxInfluenceDistance + 1;
    const graphNodeLightness = NODE_LIGHTNESS;

    if (d.pathInfo) {
      d.pathInfo = false;
      // In the no-path state we deliberately suppress both neighbourhoods so
      // only the two endpoints and the severed connector remain — it reads as
      // "these two stars, and no route between them".
      if (this.selectedId && !this.noPathEndpoints) {
        this.pathInfo = getPathsWithinDistance(
          this.selectedId,
          this.data.nodes,
          this.data.edges,
          this.settings.visibleTypes,
          maxDistance
        );
      } else {
        this.pathInfo = EMPTY_PATH_INFO;
      }
    }

    if (d.nodeColors) {
      d.nodeColors = false;
      this.targetNodeColors = computeNodeColors(
        this.data.nodes,
        this.selectedId,
        this.hoveredId,
        this.data.max_degree,
        graphNodeLightness,
        this.pathInfo,
        maxDistance,
        this.path,
        this.noPathEndpoints
      );
    }

    if (d.nodeSizes) {
      d.nodeSizes = false;
      this.targetNodeSizes = computeNodeSizes(
        this.data.nodes,
        this.data.max_degree,
        this.selectedId,
        this.focusedId,
        this.hoveredId,
        this.pathInfo,
        maxDistance,
        this.path,
        this.noPathEndpoints
      );
    }

    if (d.edgeColors) {
      d.edgeColors = false;
      this.targetEdgeColors = computeEdgeColors(
        this.data.edges,
        this.selectedId,
        this.hoveredId,
        this.settings.visibleTypes,
        this.pathInfo,
        maxDistance,
        this.path,
        this.noPathEndpoints
      );
    }

    if (d.edgeWidthScales) {
      d.edgeWidthScales = false;
      this._edgeWidthScales = computeEdgeWidthScales(
        this.data.edges,
        this.path
      );
    }

    if (d.netArrows) {
      d.netArrows = false;
      this.netArrowGeom = computeNetArrowGeometry(
        this.data.edges,
        this.settings.visibleTypes,
        this.selectedId,
        this.pathInfo,
        maxDistance,
        this.path
      );
      // The net set changed: re-anchor net phases so the arrows emerge from
      // their midpoints now (rather than carrying over a stale anchor).
      this.netArrowAnchorTime = performance.now() / 1000;
      // Net arrow change always requires full arrow recompute
      d.arrows = true;
    }

    if (d.arrows) {
      d.arrows = false;
      this.arrowGeom = computeArrowGeometry(
        this.data.edges,
        this.nodePositions,
        this.settings.visibleTypes,
        this.hoveredId,
        this.netArrowGeom,
        this.targetNodeSizes,
        this.netArrowAnchorTime,
        this.hoverArrowAnchorTime
      );
    }

    // Fire any pending zoom request now that pathInfo is up to date.
    if (this.pendingZoom !== null) {
      const kind = this.pendingZoom;
      this.pendingZoom = null;
      if (kind === "selection") {
        this.animateToSelection();
      } else {
        this.animateToPath();
      }
    }

    // Repaint labels when state changes (theme, selection, settings, etc.)
    if (d.labels) {
      d.labels = false;
      this.commitLabels();
    }
  }

  // ==========================================================================
  // Render loop
  // ==========================================================================

  private renderLoop(): void {
    this.renderScheduled = false;

    // Recompute any dirty derived state
    this.recomputeIfDirty();

    const now = performance.now();
    const dt = this.lastFrameTime > 0 ? now - this.lastFrameTime : 0;
    this.lastFrameTime = now;

    // Update camera (animation, inertia, smooth zoom)
    if (this.camera.update(dt)) {
      this.onCameraChange();
    }
    const factor = dt > 0 ? 1 - Math.exp(-dt / TRANSITION_TAU) : 1;

    // Lerp static arrow opacity toward target
    const dtSec = dt / 1000;
    if (this.staticArrowOpacity !== this.staticArrowOpacityTarget) {
      const fadeSpeed = 1.0 / STATIC_ARROW_FADE_DURATION;
      if (this.staticArrowOpacity < this.staticArrowOpacityTarget) {
        this.staticArrowOpacity = Math.min(
          this.staticArrowOpacityTarget,
          this.staticArrowOpacity + fadeSpeed * dtSec
        );
      } else {
        this.staticArrowOpacity = Math.max(
          this.staticArrowOpacityTarget,
          this.staticArrowOpacity - fadeSpeed * dtSec
        );
      }
    }

    const interpolating = this.frame.step({
      renderer: this.renderer,
      factor,
      targets: {
        nodeColors: this.targetNodeColors,
        edgeColors: this.targetEdgeColors,
        nodeSizes: this.targetNodeSizes,
        edgeWidthScales: this._edgeWidthScales,
      },
      edgeNodeIndices: this.edgeNodeIndices,
      edgeCount: this.data.edges.length,
      nodeCount: this.data.nodes.length,
      arrowGeom: this.arrowGeom,
      staticArrowOpacity: this.staticArrowOpacity,
      selectedId: this.selectedId,
    });

    this.renderer.render(
      this.camera.getViewMatrix(),
      BG,
      this.settings.general.arrowSizeScale * ARROW_SIZE_MULTIPLIER,
      this.camera.zoom,
      now / 1000,
      this.settings.general.curvedEdges ? EDGE_CURVATURE : 0.0,
      this.cursorWorld.x,
      this.cursorWorld.y,
      CURSOR_PROXIMITY_RADIUS,
      1.0,
      RETICLE_COLOR
    );

    // Continue rendering if camera is active, interpolation hasn't converged,
    // or animated arrows are visible (their phase depends on wall-clock time).
    const hasAnimatedArrows =
      this.selectedId !== null || this.hoveredId !== null;
    const arrowFading =
      this.staticArrowOpacity !== this.staticArrowOpacityTarget;

    if (
      this.camera.isActive ||
      interpolating ||
      hasAnimatedArrows ||
      arrowFading
    ) {
      this.scheduleRender();
    }
  }

  // ==========================================================================
  // Camera change handling (CSS label transform + throttled label update)
  // ==========================================================================

  private onCameraChange(): void {
    // Apply CSS transform to labels container immediately (same frame as WebGL)
    const snap = this.labelSnap;
    const state = this.camera.getState();
    if (snap.zoom > 0) {
      const s = state.zoom / snap.zoom;
      const tx = (snap.x - state.x) * state.zoom;
      const ty = (snap.y - state.y) * state.zoom;
      const cx = state.screenCenterX;
      const cy = state.screenCenterY;
      const ox = cx * (1 - s) + tx;
      const oy = cy * (1 - s) + ty;
      this.labelContainer.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
    }

    // Throttle full label updates
    const now = performance.now();
    if (now - this.lastLabelCommit >= LABEL_COMMIT_INTERVAL) {
      this.lastLabelCommit = now;
      cancelAnimationFrame(this.pendingLabelCommit);
      this.pendingLabelCommit = 0;
      this.commitLabels();
    } else if (!this.pendingLabelCommit) {
      this.pendingLabelCommit = requestAnimationFrame(() => {
        this.pendingLabelCommit = 0;
        this.lastLabelCommit = performance.now();
        this.commitLabels();
      });
    }
  }

  /** Run a full label update and reset the CSS transform snapshot. */
  private commitLabels(): void {
    const maxDistance = this.settings.general.maxInfluenceDistance + 1;
    this.labelManager.update(
      this.data.nodes,
      this.nodePositions,
      this.data.max_degree,
      this.selectedId,
      this.hoveredId,
      this.pathInfo,
      maxDistance,
      this.path,
      this.settings.general.showLabels,
      this.noPathEndpoints
    );

    this.refreshNoPathOverlay();

    // Snapshot camera state and reset transform (equivalent to the useLayoutEffect)
    this.labelSnap = this.camera.getState();
    this.labelContainer.style.transform = "";
  }

  /** Reposition the no-path connector against the current camera. */
  private refreshNoPathOverlay(): void {
    this.noPathOverlay.update(
      this.camera,
      this.nodePositions,
      this.data.nodes.length
    );
  }

  // ==========================================================================
  // Zoom-to-fit helpers
  // ==========================================================================

  private fitTo(positions: [number, number][]): void {
    if (fitCameraToPositions(this.camera, positions)) this.scheduleRender();
  }

  private animateToSelection(): void {
    if (!this.selectedId) return;
    if (this.path && this.path.length > 0) return;
    const ids = [this.selectedId, ...this.pathInfo.immediateNeighbours];
    this.fitTo(
      gatherNodePositions(ids, this.nodePositions, this.data.nodes.length)
    );
  }

  private animateToPath(): void {
    // With no reachable path, frame the two endpoints so the broken connector
    // between them is visible and the user can re-aim from there.
    const ids =
      this.path && this.path.length > 0
        ? this.path
        : this.noPathEndpoints
          ? [this.noPathEndpoints.source, this.noPathEndpoints.destination]
          : null;
    if (!ids) return;
    this.fitTo(
      gatherNodePositions(ids, this.nodePositions, this.data.nodes.length)
    );
  }
}
