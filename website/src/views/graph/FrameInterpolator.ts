/**
 * Per-frame interpolation and GPU upload. Holds the smoothed (interpolated)
 * node/edge colour and size buffers and, each frame, eases them toward the
 * latest target arrays, derives the edge-endpoint tint and arrow buffers, and
 * pushes everything to the renderer. `GraphView` owns the targets and the
 * actual draw call; this owns the in-between state.
 */

import { nodeIdToInt } from "../../data";
import { WebGLRenderer } from "./WebGLRenderer";
import type { ArrowGeometry } from "./GraphViewComputed";

/** The latest target arrays to ease toward (null until first computed). */
export interface FrameTargets {
  nodeColors: Float32Array | null;
  edgeColors: Float32Array | null;
  nodeSizes: Float32Array | null;
  edgeWidthScales: Float32Array | null;
}

/** Everything a single interpolation step needs from `GraphView`. */
export interface FrameStepParams {
  renderer: WebGLRenderer;
  /** Easing factor in [0, 1]: how far to move toward the targets this frame. */
  factor: number;
  targets: FrameTargets;
  edgeNodeIndices: { src: Int32Array; tgt: Int32Array };
  edgeCount: number;
  nodeCount: number;
  arrowGeom: ArrowGeometry | null;
  staticArrowOpacity: number;
  selectedId: string | null;
}

/** True if `interp` has effectively reached `target`. */
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

/** Owns the interpolated render buffers and eases them toward each frame's targets. */
export class FrameInterpolator {
  private nodeColors: Float32Array | null = null;
  private edgeColors: Float32Array | null = null;
  private _nodeSizes: Float32Array | null = null;
  private edgeSrcNodeColors: Float32Array | null = null;
  private edgeTgtNodeColors: Float32Array | null = null;
  private arrowColors: Float32Array | null = null;
  private arrowTargetSizes: Float32Array | null = null;
  private nodeSelected: Float32Array | null = null;
  private prevSelectedId: string | null = null;

  /** The interpolated node sizes, exposed for hit-testing. */
  get nodeSizes(): Float32Array | null {
    return this._nodeSizes;
  }

  /**
   * Ease the interpolated buffers toward the targets, derive edge/arrow/
   * selection buffers, upload them all, and report whether colours/sizes are
   * still in motion (so the caller knows to schedule another frame).
   */
  step(p: FrameStepParams): boolean {
    const { renderer, factor, targets } = p;

    // Lerp node colors
    if (targets.nodeColors) {
      if (
        !this.nodeColors ||
        this.nodeColors.length !== targets.nodeColors.length
      ) {
        this.nodeColors = new Float32Array(targets.nodeColors);
      } else {
        const src = targets.nodeColors;
        const dst = this.nodeColors;
        for (let i = 0; i < dst.length; i++) {
          dst[i] += (src[i] - dst[i]) * factor;
        }
      }
      renderer.setNodeColors(this.nodeColors);
    }

    // Lerp edge colors
    if (targets.edgeColors) {
      if (
        !this.edgeColors ||
        this.edgeColors.length !== targets.edgeColors.length
      ) {
        this.edgeColors = new Float32Array(targets.edgeColors);
      } else {
        const src = targets.edgeColors;
        const dst = this.edgeColors;
        for (let i = 0; i < dst.length; i++) {
          dst[i] += (src[i] - dst[i]) * factor;
        }
      }
      renderer.setEdgeColors(this.edgeColors);
    }

    // Upload edge width scales (no interpolation needed)
    if (targets.edgeWidthScales) {
      renderer.setEdgeWidthScales(targets.edgeWidthScales);
    }

    // Lerp node sizes
    if (targets.nodeSizes) {
      if (
        !this._nodeSizes ||
        this._nodeSizes.length !== targets.nodeSizes.length
      ) {
        this._nodeSizes = new Float32Array(targets.nodeSizes);
      } else {
        const src = targets.nodeSizes;
        const dst = this._nodeSizes;
        for (let i = 0; i < dst.length; i++) {
          dst[i] += (src[i] - dst[i]) * factor;
        }
      }
      renderer.setNodeSizes(this._nodeSizes);
    }

    // Compute per-edge node colors for endpoint tinting
    const eni = p.edgeNodeIndices;
    if (eni && this.nodeColors) {
      const n = p.edgeCount;
      if (!this.edgeSrcNodeColors || this.edgeSrcNodeColors.length !== n * 4) {
        this.edgeSrcNodeColors = new Float32Array(n * 4);
        this.edgeTgtNodeColors = new Float32Array(n * 4);
      }
      for (let i = 0; i < n; i++) {
        const si = eni.src[i];
        const ti = eni.tgt[i];
        this.edgeSrcNodeColors[i * 4] = this.nodeColors[si * 4];
        this.edgeSrcNodeColors[i * 4 + 1] = this.nodeColors[si * 4 + 1];
        this.edgeSrcNodeColors[i * 4 + 2] = this.nodeColors[si * 4 + 2];
        this.edgeSrcNodeColors[i * 4 + 3] = this.nodeColors[si * 4 + 3];
        this.edgeTgtNodeColors![i * 4] = this.nodeColors[ti * 4];
        this.edgeTgtNodeColors![i * 4 + 1] = this.nodeColors[ti * 4 + 1];
        this.edgeTgtNodeColors![i * 4 + 2] = this.nodeColors[ti * 4 + 2];
        this.edgeTgtNodeColors![i * 4 + 3] = this.nodeColors[ti * 4 + 3];
      }
      renderer.setEdgeNodeColors(
        this.edgeSrcNodeColors,
        this.edgeTgtNodeColors!
      );
    }

    // Compute arrow colors/sizes from interpolated edge/node data
    // Layout: [static | net | hover]. Static arrows get fading opacity.
    const geom = p.arrowGeom;
    if (geom && this.edgeColors && this._nodeSizes) {
      const n = geom.edgeIndices.length;
      if (!this.arrowColors || this.arrowColors.length !== n * 4) {
        this.arrowColors = new Float32Array(n * 4);
        this.arrowTargetSizes = new Float32Array(n);
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
          this.arrowColors[j * 4] = geom.hoverColors[hi * 4];
          this.arrowColors[j * 4 + 1] = geom.hoverColors[hi * 4 + 1];
          this.arrowColors[j * 4 + 2] = geom.hoverColors[hi * 4 + 2];
          this.arrowColors[j * 4 + 3] = geom.hoverColors[hi * 4 + 3];
        } else if (j < staticEnd) {
          // Static arrows: color from edge, with fade opacity.
          // If this edge also has an animated arrow, hide immediately
          // to avoid doubling.
          const alpha = animatedEdges.has(ei)
            ? 0.0
            : this.edgeColors[ei * 8 + 3] * p.staticArrowOpacity;
          this.arrowColors[j * 4] = this.edgeColors[ei * 8];
          this.arrowColors[j * 4 + 1] = this.edgeColors[ei * 8 + 1];
          this.arrowColors[j * 4 + 2] = this.edgeColors[ei * 8 + 2];
          this.arrowColors[j * 4 + 3] = alpha;
        } else {
          // Net arrows: color from interpolated edge colors
          this.arrowColors[j * 4] = this.edgeColors[ei * 8];
          this.arrowColors[j * 4 + 1] = this.edgeColors[ei * 8 + 1];
          this.arrowColors[j * 4 + 2] = this.edgeColors[ei * 8 + 2];
          this.arrowColors[j * 4 + 3] = this.edgeColors[ei * 8 + 3];
        }
        this.arrowTargetSizes![j] = this._nodeSizes[geom.targetNodeIndices[j]];
      }
      renderer.setArrows(
        geom.targets,
        geom.directions,
        this.arrowColors,
        this.arrowTargetSizes!,
        geom.phases,
        geom.speeds
      );
    }

    // Update selection indicator
    if (p.selectedId !== this.prevSelectedId) {
      this.prevSelectedId = p.selectedId;
      const count = p.nodeCount;
      if (!this.nodeSelected || this.nodeSelected.length !== count) {
        this.nodeSelected = new Float32Array(count);
      } else {
        this.nodeSelected.fill(0);
      }
      if (p.selectedId) {
        const idx = nodeIdToInt(p.selectedId);
        if (idx >= 0 && idx < count) {
          this.nodeSelected[idx] = 1.0;
        }
      }
      renderer.setNodeSelected(this.nodeSelected);
    }

    // Still interpolating if colours or sizes haven't reached their targets.
    return (
      !hasConverged(this.nodeColors, targets.nodeColors) ||
      !hasConverged(this.edgeColors, targets.edgeColors) ||
      !hasConverged(this._nodeSizes, targets.nodeSizes)
    );
  }
}
