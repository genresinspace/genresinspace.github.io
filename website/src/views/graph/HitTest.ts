/** Hit-test nodes by linear scan (fast for ~1335 nodes). */

/** Extra radius multiplier for hover hit testing (1.0 = exact, 1.5 = 50% buffer). */
export const HOVER_HIT_BUFFER = 1.5;

/** Find the node under the given world-space coordinates.
 *  Sizes are in world units. `radiusScale` multiplies the hit radius (use
 *  HOVER_HIT_BUFFER for hover, 1.0 for click). Returns the node index or null. */
export function hitTestNode(
  worldX: number,
  worldY: number,
  positions: Float32Array,
  sizes: Float32Array,
  radiusScale: number = 1.0
): number | null {
  let bestIndex: number | null = null;
  let bestDistSq = Infinity;

  for (let i = 0; i < sizes.length; i++) {
    const px = positions[i * 2];
    const py = positions[i * 2 + 1];
    // Node visual radius in world space (sizes are world-unit diameters)
    const radius = sizes[i] * 0.5 * radiusScale;
    const dx = worldX - px;
    const dy = worldY - py;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius && distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }

  return bestIndex;
}
