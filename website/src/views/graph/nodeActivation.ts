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
