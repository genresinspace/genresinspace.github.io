/**
 * Imperative graph visualization controller.
 * Owns the WebGL canvas, label overlay, camera, interaction handler, and render loop.
 * Replaces the former React component tree (Graph → GraphCanvas + Labels).
 */

import type { Data } from "../../data";
import { nodeIdToInt } from "../../data";
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
  FIT_STDDEV_MULT,
  FIT_RADIUS_MIN,
  FIT_PADDING_FRAC,
  FIT_ANIM_DURATION,
  NO_PATH_LINE_COLOR,
  NO_PATH_BREAK_COLOR,
} from "./graphConstants";

/** Callbacks from the graph view to the parent React component. */
export interface GraphViewCallbacks {
  setSelectedId(id: string | null): void;
  onSetAsSource(nodeId: string): void;
  onSetAsDestination(nodeId: string): void;
}

// ---------------------------------------------------------------------------
// Interpolation state
// ---------------------------------------------------------------------------

interface InterpState {
  nodeColors: Float32Array | null;
  edgeColors: Float32Array | null;
  nodeSizes: Float32Array | null;
  arrowColors: Float32Array | null;
  arrowTargetSizes: Float32Array | null;
  edgeSrcNodeColors: Float32Array | null;
  edgeTgtNodeColors: Float32Array | null;
  nodeSelected: Float32Array | null;
  prevSelectedId: string | null;
  lastTime: number;
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
// Convergence check
// ---------------------------------------------------------------------------

function hasConverged(
  interp: Float32Array | null,
  target: Float32Array | null,
  threshold: number = 0.001
): boolean {
  if (!interp || !target) return true;
  if (interp.length !== target.length) return false;
  for (let i = 0; i < interp.length; i++) {
    if (Math.abs(interp[i] - target[i]) > threshold) return false;
  }
  return true;
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
  private interp: InterpState = {
    nodeColors: null,
    edgeColors: null,
    nodeSizes: null,
    arrowColors: null,
    arrowTargetSizes: null,
    edgeSrcNodeColors: null,
    edgeTgtNodeColors: null,
    nodeSelected: null,
    prevSelectedId: null,
    lastTime: 0,
  };

  // --- Render loop ---
  private animFrameId = 0;
  private renderScheduled = false;
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;

  // --- Static arrow fade ---
  // 1.0 = fully visible (nothing selected), 0.0 = fully hidden (selection active)
  private staticArrowOpacity = 1.0;
  private staticArrowOpacityTarget = 1.0;

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
  // Two dashed stubs from each endpoint with a gap, crossed by an ✕ to read as
  // a broken connection rather than a real edge.
  private noPathSvg: SVGSVGElement | null = null;
  private noPathSeg1: SVGLineElement | null = null;
  private noPathSeg2: SVGLineElement | null = null;
  private noPathCross1: SVGLineElement | null = null;
  private noPathCross2: SVGLineElement | null = null;

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
    this.interaction = new InteractionHandler(this.camera, canvas, {
      onNodeClick: (idx) => {
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
          this.hoverTimer = null;
        }
        if (idx !== null) {
          const nodeId = data.nodes[idx].id;
          const sid = this.selectedId;
          const currentPath = this.path;

          if (currentPath) {
            if (currentPath.includes(nodeId)) {
              if (sid === nodeId) {
                const sourceId = currentPath[0];
                if (sourceId && sourceId !== nodeId) {
                  this.callbacks.setSelectedId(sourceId);
                } else {
                  this.callbacks.setSelectedId(null);
                }
              } else {
                this.callbacks.setSelectedId(nodeId);
              }
            }
          } else {
            this.callbacks.setSelectedId(sid !== nodeId ? nodeId : null);
          }
        } else {
          this.callbacks.setSelectedId(null);
        }
      },
      onNodeHover: (idx) => {
        if (this.hoverTimer) {
          clearTimeout(this.hoverTimer);
          this.hoverTimer = null;
        }
        const nodeId = idx !== null ? data.nodes[idx].id : null;
        if (nodeId === this.hoveredId) return;
        this.hoverTimer = setTimeout(() => {
          this.setHoveredId(nodeId);
          this.hoverTimer = null;
        }, HOVER_DEBOUNCE_MS);
      },
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
      hitTest: (wx, wy) => {
        return hitTestNode(
          wx,
          wy,
          this.nodePositions,
          this.interp.nodeSizes || new Float32Array(0),
          HOVER_HIT_BUFFER
        );
      },
    });

    // 5. Label manager
    const labelCallbacks: LabelCallbacks = {
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
    this.labelManager = new LabelManager(
      labelContainer,
      this.camera,
      labelCallbacks
    );

    // 5b. Broken-connector overlay for the no-path state. Lives inside the
    // label container so it rides the same per-frame transform as the labels.
    this.createNoPathOverlay();

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
    // Both endpoints light their own neighbourhood net, so the coverage net,
    // colours, sizes, edges, and arrows all change.
    this.dirty.pathInfo = true;
    this.dirty.nodeColors = true;
    this.dirty.nodeSizes = true;
    this.dirty.edgeColors = true;
    this.dirty.netArrows = true;
    this.dirty.arrows = true;
    this.dirty.labels = true;
    this.updateNoPathOverlay();
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
    this.noPathSvg?.remove();
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
        performance.now() / 1000
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

    const interp = this.interp;
    const now = performance.now();
    const dt = interp.lastTime > 0 ? now - interp.lastTime : 0;
    interp.lastTime = now;

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

    // Lerp node colors
    if (this.targetNodeColors) {
      if (
        !interp.nodeColors ||
        interp.nodeColors.length !== this.targetNodeColors.length
      ) {
        interp.nodeColors = new Float32Array(this.targetNodeColors);
      } else {
        const src = this.targetNodeColors;
        const dst = interp.nodeColors;
        for (let i = 0; i < dst.length; i++) {
          dst[i] += (src[i] - dst[i]) * factor;
        }
      }
      this.renderer.setNodeColors(interp.nodeColors);
    }

    // Lerp edge colors
    if (this.targetEdgeColors) {
      if (
        !interp.edgeColors ||
        interp.edgeColors.length !== this.targetEdgeColors.length
      ) {
        interp.edgeColors = new Float32Array(this.targetEdgeColors);
      } else {
        const src = this.targetEdgeColors;
        const dst = interp.edgeColors;
        for (let i = 0; i < dst.length; i++) {
          dst[i] += (src[i] - dst[i]) * factor;
        }
      }
      this.renderer.setEdgeColors(interp.edgeColors);
    }

    // Upload edge width scales (no interpolation needed)
    if (this._edgeWidthScales) {
      this.renderer.setEdgeWidthScales(this._edgeWidthScales);
    }

    // Lerp node sizes
    if (this.targetNodeSizes) {
      if (
        !interp.nodeSizes ||
        interp.nodeSizes.length !== this.targetNodeSizes.length
      ) {
        interp.nodeSizes = new Float32Array(this.targetNodeSizes);
      } else {
        const src = this.targetNodeSizes;
        const dst = interp.nodeSizes;
        for (let i = 0; i < dst.length; i++) {
          dst[i] += (src[i] - dst[i]) * factor;
        }
      }
      this.renderer.setNodeSizes(interp.nodeSizes);
    }

    // Compute per-edge node colors for endpoint tinting
    const eni = this.edgeNodeIndices;
    if (eni && interp.nodeColors) {
      const n = this.data.edges.length;
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
      this.renderer.setEdgeNodeColors(
        interp.edgeSrcNodeColors,
        interp.edgeTgtNodeColors!
      );
    }

    // Compute arrow colors/sizes from interpolated edge/node data
    // Layout: [static | net | hover]. Static arrows get fading opacity.
    const geom = this.arrowGeom;
    if (geom && interp.edgeColors && interp.nodeSizes) {
      const n = geom.edgeIndices.length;
      if (!interp.arrowColors || interp.arrowColors.length !== n * 4) {
        interp.arrowColors = new Float32Array(n * 4);
        interp.arrowTargetSizes = new Float32Array(n);
      }
      const staticEnd = geom.staticArrowCount;
      const netEnd = staticEnd + geom.netArrowCount;
      // Collect edge indices that have animated arrows so we can hide
      // their static duplicates immediately (no doubling during fade).
      const animatedEdges = new Set<number>();
      for (let k = staticEnd; k < n; k++) {
        animatedEdges.add(geom.edgeIndices[k]);
      }
      for (let j = 0; j < n; j++) {
        const ei = geom.edgeIndices[j];
        if (j >= netEnd) {
          // Hover arrows: precomputed type-based colors
          const hi = j - netEnd;
          interp.arrowColors[j * 4] = geom.hoverColors[hi * 4];
          interp.arrowColors[j * 4 + 1] = geom.hoverColors[hi * 4 + 1];
          interp.arrowColors[j * 4 + 2] = geom.hoverColors[hi * 4 + 2];
          interp.arrowColors[j * 4 + 3] = geom.hoverColors[hi * 4 + 3];
        } else if (j < staticEnd) {
          // Static arrows: color from edge, with fade opacity.
          // If this edge also has an animated arrow, hide immediately
          // to avoid doubling.
          const alpha = animatedEdges.has(ei)
            ? 0.0
            : interp.edgeColors[ei * 8 + 3] * this.staticArrowOpacity;
          interp.arrowColors[j * 4] = interp.edgeColors[ei * 8];
          interp.arrowColors[j * 4 + 1] = interp.edgeColors[ei * 8 + 1];
          interp.arrowColors[j * 4 + 2] = interp.edgeColors[ei * 8 + 2];
          interp.arrowColors[j * 4 + 3] = alpha;
        } else {
          // Net arrows: color from interpolated edge colors
          interp.arrowColors[j * 4] = interp.edgeColors[ei * 8];
          interp.arrowColors[j * 4 + 1] = interp.edgeColors[ei * 8 + 1];
          interp.arrowColors[j * 4 + 2] = interp.edgeColors[ei * 8 + 2];
          interp.arrowColors[j * 4 + 3] = interp.edgeColors[ei * 8 + 3];
        }
        interp.arrowTargetSizes![j] =
          interp.nodeSizes[geom.targetNodeIndices[j]];
      }
      this.renderer.setArrows(
        geom.targets,
        geom.directions,
        interp.arrowColors,
        interp.arrowTargetSizes!,
        geom.phases,
        geom.speeds
      );
    }

    // Update selection indicator
    if (this.selectedId !== interp.prevSelectedId) {
      interp.prevSelectedId = this.selectedId;
      const count = this.data.nodes.length;
      if (!interp.nodeSelected || interp.nodeSelected.length !== count) {
        interp.nodeSelected = new Float32Array(count);
      } else {
        interp.nodeSelected.fill(0);
      }
      if (this.selectedId) {
        const idx = nodeIdToInt(this.selectedId);
        if (idx >= 0 && idx < count) {
          interp.nodeSelected[idx] = 1.0;
        }
      }
      this.renderer.setNodeSelected(interp.nodeSelected);
    }

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
    const interpolating =
      !hasConverged(interp.nodeColors, this.targetNodeColors) ||
      !hasConverged(interp.edgeColors, this.targetEdgeColors) ||
      !hasConverged(interp.nodeSizes, this.targetNodeSizes);
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

    this.updateNoPathOverlay();

    // Snapshot camera state and reset transform (equivalent to the useLayoutEffect)
    this.labelSnap = this.camera.getState();
    this.labelContainer.style.transform = "";
  }

  /** Build the severed-connector SVG used to mark an unreachable destination. */
  private createNoPathOverlay(): void {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.position = "absolute";
    svg.style.inset = "0";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    svg.style.display = "none";

    const seg = () => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("stroke", NO_PATH_LINE_COLOR);
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-dasharray", "5 5");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-opacity", "0.6");
      svg.appendChild(line);
      return line;
    };
    const cross = () => {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("stroke", NO_PATH_BREAK_COLOR);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("stroke-opacity", "0.95");
      svg.appendChild(line);
      return line;
    };

    this.noPathSeg1 = seg();
    this.noPathSeg2 = seg();
    this.noPathCross1 = cross();
    this.noPathCross2 = cross();

    this.labelContainer.appendChild(svg);
    this.noPathSvg = svg;
  }

  /**
   * Position (or hide) the severed connector: a dashed stub from each endpoint
   * stopping short of the midpoint, with an ✕ marking the gap. Endpoints are
   * projected with the current camera, matching the screen space the labels are
   * committed in, so the overlay tracks the same per-frame container transform.
   */
  private updateNoPathOverlay(): void {
    const svg = this.noPathSvg;
    const seg1 = this.noPathSeg1;
    const seg2 = this.noPathSeg2;
    const cross1 = this.noPathCross1;
    const cross2 = this.noPathCross2;
    if (!svg || !seg1 || !seg2 || !cross1 || !cross2) return;

    const ep = this.noPathEndpoints;
    if (!ep) {
      svg.style.display = "none";
      return;
    }

    const si = nodeIdToInt(ep.source);
    const di = nodeIdToInt(ep.destination);
    if (
      si < 0 ||
      si >= this.data.nodes.length ||
      di < 0 ||
      di >= this.data.nodes.length
    ) {
      svg.style.display = "none";
      return;
    }

    const [x1, y1] = this.camera.worldToScreen(
      this.nodePositions[si * 2],
      this.nodePositions[si * 2 + 1]
    );
    const [x2, y2] = this.camera.worldToScreen(
      this.nodePositions[di * 2],
      this.nodePositions[di * 2 + 1]
    );

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);

    const setLine = (
      line: SVGLineElement,
      ax: number,
      ay: number,
      bx: number,
      by: number
    ) => {
      line.setAttribute("x1", String(ax));
      line.setAttribute("y1", String(ay));
      line.setAttribute("x2", String(bx));
      line.setAttribute("y2", String(by));
    };

    // Gap left around the midpoint for the break marker, shrinking on short runs
    const gap = Math.min(14, len / 4);
    const ux = len > 0 ? dx / len : 0;
    const uy = len > 0 ? dy / len : 0;
    setLine(seg1, x1, y1, mx - ux * gap, my - uy * gap);
    setLine(seg2, mx + ux * gap, my + uy * gap, x2, y2);

    // A fixed-orientation ✕ over the gap reads as "no connection" at any angle
    const r = Math.min(6, gap * 0.7);
    setLine(cross1, mx - r, my - r, mx + r, my + r);
    setLine(cross2, mx - r, my + r, mx + r, my - r);

    svg.style.display = "block";
  }

  // ==========================================================================
  // Zoom-to-fit helpers
  // ==========================================================================

  private animateToFitPositions(positions: [number, number][]): void {
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
    const rawW = this.camera.canvasW - Math.abs(this.camera.viewportOffsetX);
    const rawH = this.camera.canvasH - Math.abs(this.camera.viewportOffsetY);
    const padding = Math.min(rawW, rawH) * FIT_PADDING_FRAC;
    const availableSize = Math.min(rawW - padding, rawH - padding);
    const fitZoom = availableSize / (fitRadius * 2);

    this.camera.animateTo(
      mx,
      my,
      Math.max(fitZoom, this.camera.minZoomLevel),
      FIT_ANIM_DURATION
    );
    this.scheduleRender();
  }

  private animateToSelection(): void {
    if (!this.selectedId) return;
    if (this.path && this.path.length > 0) return;

    const idx = nodeIdToInt(this.selectedId);
    if (idx < 0 || idx >= this.data.nodes.length) return;

    const positions: [number, number][] = [
      [this.nodePositions[idx * 2], this.nodePositions[idx * 2 + 1]],
    ];
    for (const id of this.pathInfo.immediateNeighbours) {
      const ni = nodeIdToInt(id);
      if (ni >= 0 && ni < this.data.nodes.length) {
        positions.push([
          this.nodePositions[ni * 2],
          this.nodePositions[ni * 2 + 1],
        ]);
      }
    }

    this.animateToFitPositions(positions);
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

    const positions: [number, number][] = [];
    for (const id of ids) {
      const ni = nodeIdToInt(id);
      if (ni >= 0 && ni < this.data.nodes.length) {
        positions.push([
          this.nodePositions[ni * 2],
          this.nodePositions[ni * 2 + 1],
        ]);
      }
    }

    this.animateToFitPositions(positions);
  }
}
