/** BFS-based coverage net computation, extracted from Graph.tsx. */

import { EdgeData, NodeData, nodeIdToInt } from "../../data";
import { SettingsData } from "../../settings";

/** Distances and neighbor info for a selected node's coverage net. */
export type PathInfo = {
  nodeDistances: Map<string, number>;
  edgeDistances: Map<EdgeData, number>;
  immediateNeighbours: Set<string>;
};

/** Empty path info constant. */
export const EMPTY_PATH_INFO: PathInfo = {
  nodeDistances: new Map(),
  edgeDistances: new Map(),
  immediateNeighbours: new Set(),
};

/** Compute BFS coverage net from a starting node, following outgoing visible edges. */
export function getPathsWithinDistance(
  startId: string,
  nodes: NodeData[],
  edges: EdgeData[],
  visibleTypes: SettingsData["visibleTypes"],
  maxDistance: number
): PathInfo {
  const nodeDistances = new Map<string, number>();
  const edgeDistances = new Map<EdgeData, number>();
  const immediateNeighbours = new Set<string>();

  const startNodeData = nodes[nodeIdToInt(startId)];
  if (startNodeData) {
    immediateNeighbours.add(startNodeData.id);
    for (const edgeIndex of startNodeData.edges) {
      const edge = edges[edgeIndex];
      if (visibleTypes[edge.ty]) {
        immediateNeighbours.add(edge.source);
        immediateNeighbours.add(edge.target);
      }
    }
  }

  nodeDistances.set(startId, 0);

  let frontier = new Set([startId]);
  let currentDistance = 0;

  while (frontier.size > 0 && currentDistance < maxDistance) {
    const nextFrontier = new Set<string>();
    currentDistance++;

    for (const nodeId of frontier) {
      const nodeData = nodes[nodeIdToInt(nodeId)];
      if (!nodeData) continue;

      for (const edgeIndex of nodeData.edges) {
        const edge = edges[edgeIndex];
        if (!visibleTypes[edge.ty]) continue;
        if (edge.source === nodeId) {
          const targetId = edge.target;
          if (!nodeDistances.has(targetId)) {
            nodeDistances.set(targetId, currentDistance);
            edgeDistances.set(edge, currentDistance);
            nextFrontier.add(targetId);
          }
        }
      }
    }

    frontier = nextFrontier;
  }

  return { nodeDistances, edgeDistances, immediateNeighbours };
}
