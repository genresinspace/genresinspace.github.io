import { EdgeData, NodeData, nodeIdToInt } from "../data";
import { VisibleTypes } from "../settings";

/**
 * Find the shortest path from `source` to `destination` along outgoing edges
 * whose type is visible, or `null` if no such path exists.
 */
export function computePath(
  nodes: NodeData[],
  edges: EdgeData[],
  visibleTypes: VisibleTypes,
  source: string,
  destination: string
): string[] | null {
  // BFS — all edges have unit weight so BFS finds the shortest path in O(V+E)
  const previous = new Map<string, string>();
  const visited = new Set<string>();
  const queue: string[] = [source];
  visited.add(source);

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (currentId === destination) {
      const path: string[] = [];
      let current: string | undefined = currentId;
      while (current) {
        path.unshift(current);
        current = previous.get(current);
      }
      return path;
    }

    const currentNode = nodes[nodeIdToInt(currentId)];
    for (const edgeIndex of currentNode.edges) {
      const edge = edges[edgeIndex];
      if (edge.source === currentId && visibleTypes[edge.ty]) {
        const neighborId = edge.target;
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          previous.set(neighborId, currentId);
          queue.push(neighborId);
        }
      }
    }
  }

  return null;
}
