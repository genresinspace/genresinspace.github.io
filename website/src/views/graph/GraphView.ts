/**
 * Imperative graph visualization controller.
 * Owns the WebGL canvas, label overlay, camera, interaction handler, and render loop.
 * Replaces the former React component tree (Graph → GraphCanvas + Labels).
 */

import type { Data } from "../../data";
import { nodeIdToInt } from "../../data";
import type { Theme } from "../../theme";
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
  BG_LIGHT,
  BG_DARK,
  ARROW_SIZE_MULTIPLIER,
  EDGE_CURVATURE,
  CURSOR_PROXIMITY_RADIUS,
  NODE_LIGHTNESS_LIGHT,
  NODE_LIGHTNESS_DARK,
  FIT_STDDEV_MULT,
  FIT_RADIUS_MIN,
  FIT_PADDING_FRAC,
  FIT_ANIM_DURATION,
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
  private settings: SettingsData;
  private theme: Theme = "dark";
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

  // --- Previous values for zoom-to-fit triggers ---
  private prevSelectedIdForZoom: string | null = null;
  private prevPathForZoom: string[] | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    labelContainer: HTMLDivElement,
    data: Data,
    settings: SettingsData,
    theme: Theme,
    callbacks: GraphViewCallbacks
  ) {
    this.labelContainer = labelContainer;
    this.data = data;
    this.settings = settings;
    this.theme = theme;
    this.callbacks = callbacks;

    // 1. Compute static arrays
    this.nodePositions = computeNodePositions(data.nodes);
    this.edgePositions = computeEdgePositions(data.edges, this.nodePositions);
    this.edgeNodeIndices = computeEdgeNodeIndices(data.edges);

    // 2. Camera
    this.camera = new Camera();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w;
    canvas.height = h;
    this.camera.setCanvasSize(w, h);
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

  setTheme(theme: Theme): void {
    if (theme === this.theme) return;
    this.theme = theme;
    this.dirty.nodeColors = true;
    this.dirty.edgeColors = true;
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

  destroy(): void {
    if (this.hoverTimer) clearTimeout(this.hoverTimer);
    cancelAnimationFrame(this.animFrameId);
    cancelAnimationFrame(this.pendingLabelCommit);
    this.renderScheduled = false;
    this.resizeObserver.disconnect();
    this.interaction.destroy();
    this.renderer.destroy();
    this.labelManager.destroy();
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
    const graphNodeLightness =
      this.theme === "light" ? NODE_LIGHTNESS_LIGHT : NODE_LIGHTNESS_DARK;

    if (d.pathInfo) {
      d.pathInfo = false;
      if (this.selectedId) {
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
        this.theme
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
        this.path
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
        this.theme
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
        this.netArrowGeom
      );
    }

    // Zoom-to-fit on selection change
    if (this.selectedId !== this.prevSelectedIdForZoom) {
      this.prevSelectedIdForZoom = this.selectedId;
      this.animateToSelection();
    }

    // Zoom-to-fit on path change
    if (this.path !== this.prevPathForZoom) {
      this.prevPathForZoom = this.path;
      this.animateToPath();
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
    const geom = this.arrowGeom;
    if (geom && interp.edgeColors && interp.nodeSizes) {
      const n = geom.edgeIndices.length;
      if (!interp.arrowColors || interp.arrowColors.length !== n * 4) {
        interp.arrowColors = new Float32Array(n * 4);
        interp.arrowTargetSizes = new Float32Array(n);
      }
      for (let j = 0; j < n; j++) {
        const ei = geom.edgeIndices[j];
        if (j >= geom.netArrowCount) {
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

    // Render
    const bg: [number, number, number, number] =
      this.theme === "light" ? BG_LIGHT : BG_DARK;
    const isLight = this.theme === "light";
    this.renderer.render(
      this.camera.getViewMatrix(),
      bg,
      this.settings.general.arrowSizeScale * ARROW_SIZE_MULTIPLIER,
      this.camera.zoom,
      now / 1000,
      this.settings.general.curvedEdges ? EDGE_CURVATURE : 0.0,
      this.cursorWorld.x,
      this.cursorWorld.y,
      CURSOR_PROXIMITY_RADIUS,
      isLight ? -1.0 : 1.0,
      isLight ? [0, 0, 0] : [1, 1, 1]
    );

    // Continue rendering if camera is active or interpolation hasn't converged
    const interpolating =
      !hasConverged(interp.nodeColors, this.targetNodeColors) ||
      !hasConverged(interp.edgeColors, this.targetEdgeColors) ||
      !hasConverged(interp.nodeSizes, this.targetNodeSizes);

    if (this.camera.isActive || interpolating) {
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
      this.theme
    );

    // Snapshot camera state and reset transform (equivalent to the useLayoutEffect)
    this.labelSnap = this.camera.getState();
    this.labelContainer.style.transform = "";
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
    if (!this.selectedId || !this.settings.general.zoomOnSelect) return;
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
    if (
      !this.path ||
      this.path.length === 0 ||
      !this.settings.general.zoomOnSelect
    )
      return;

    const positions: [number, number][] = [];
    for (const id of this.path) {
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
