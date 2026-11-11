/** Shared selection policy for clicks on nodes, used by both the canvas and the labels. */

/**
 * Resolve a click on a node that lies on the current path: clicking the
 * already-selected on-path node reverts to the source (or clears, if it *is*
 * the source); clicking any other on-path node selects it for viewing.
 */
export function resolvePathNodeClick(
  nodeId: string,
  selectedId: string | null,
  path: string[]
): string | null {
  if (selectedId === nodeId) {
    const source = path[0];
    return source && source !== nodeId ? source : null;
  }
  return nodeId;
}

/** Which end of the route a graph "from"/"to" action sets. */
export type RetargetRole = "source" | "destination";

/** A complete route, in the shape the route reducer takes. */
export type Retarget = { sourceId: string; destinationId: string };

/**
 * Resolve a graph "from"/"to" action. The hovered node takes `role`; the node
 * selected in the path takes the other role, which is what makes the selected
 * node the fixed end while the far end moves.
 *
 * The selection keeps that job only while it can hold the other role. When the
 * selection already holds `role`, the hovered node is about to take that role
 * over, so the route's opposite end stands in for the selection. Without that
 * rule a path A to B with B selected answers "to" on C with B to C, which drops
 * the source the user was aiming from.
 *
 * Returns null when the result would pair a node with itself or repeat the
 * route that is already set. Both are cases where the action cannot do
 * anything, so a graph label offers no button for them.
 */
export function resolveRetarget(
  hoveredId: string,
  role: RetargetRole,
  selectedId: string | null,
  sourceId: string | null,
  destinationId: string | null
): Retarget | null {
  const replaced = role === "source" ? sourceId : destinationId;
  const opposite = role === "source" ? destinationId : sourceId;
  const partner = selectedId && selectedId !== replaced ? selectedId : opposite;
  if (!partner || partner === hoveredId) return null;

  const retarget =
    role === "source"
      ? { sourceId: hoveredId, destinationId: partner }
      : { sourceId: partner, destinationId: hoveredId };

  if (
    retarget.sourceId === sourceId &&
    retarget.destinationId === destinationId
  ) {
    return null;
  }
  return retarget;
}
