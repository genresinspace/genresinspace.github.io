/** Zoom-to-fit helpers: frame a set of world positions within the viewport. */

import { nodeIdToInt } from "../../data";
import { Camera } from "./Camera";
import {
  FIT_STDDEV_MULT,
  FIT_RADIUS_MIN,
  FIT_PADDING_FRAC,
  FIT_ANIM_DURATION,
} from "./graphConstants";

/** Look up world positions for a set of node ids, skipping any out of range. */
export function gatherNodePositions(
  ids: Iterable<string>,
  nodePositions: Float32Array,
  nodeCount: number
): [number, number][] {
  const positions: [number, number][] = [];
  for (const id of ids) {
    const ni = nodeIdToInt(id);
    if (ni >= 0 && ni < nodeCount) {
      positions.push([nodePositions[ni * 2], nodePositions[ni * 2 + 1]]);
    }
  }
  return positions;
}

/**
 * Animate the camera to frame the given positions (centroid + spread).
 * Returns false (and does nothing) when there is nothing to fit.
 */
export function fitCameraToPositions(
  camera: Camera,
  positions: [number, number][]
): boolean {
  if (positions.length === 0) return false;

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
  const rawW = camera.canvasW - Math.abs(camera.viewportOffsetX);
  const rawH = camera.canvasH - Math.abs(camera.viewportOffsetY);
  const padding = Math.min(rawW, rawH) * FIT_PADDING_FRAC;
  const availableSize = Math.min(rawW - padding, rawH - padding);
  const fitZoom = availableSize / (fitRadius * 2);

  camera.animateTo(
    mx,
    my,
    Math.max(fitZoom, camera.minZoomLevel),
    FIT_ANIM_DURATION
  );
  return true;
}
