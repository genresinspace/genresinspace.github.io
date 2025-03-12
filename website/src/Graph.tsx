import { useMemo, useEffect } from "react";
import { Cosmograph, useCosmograph } from "@cosmograph/react";

import { EdgeData, NodeData } from "./Data";
import { SettingsData } from "./Settings";

export const derivativeColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(0, ${saturation}%, 60%, ${alpha})`;
export const subgenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(120, ${saturation}%, 60%, ${alpha})`;
export const fusionGenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(240, ${saturation}%, 60%, ${alpha})`;

export function Graph({
  settings,
  maxDegree,
  selectedId,
  setSelectedId,
  focusedId,
}: {
  settings: SettingsData;
  maxDegree: number;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
}) {
  const { cosmograph, nodes, links } = useCosmograph<NodeData, EdgeData>()!;

  // Calculate connected paths and their distances
  const maxDistance = settings.general.maxInfluenceDistance + 1;
  const pathInfo = useMemo(() => {
    if (!selectedId || !nodes || !links)
      return { nodeDistances: new Map(), edgeDistances: new Map() } as PathInfo;
    return getPathsWithinDistance(
      selectedId,
      nodes,
      links,
      settings.visibleTypes,
      maxDistance
    );
  }, [selectedId, nodes, links, maxDistance, settings.visibleTypes]);

  useEffect(() => {
    const nodeData = selectedId ? nodes?.[parseInt(selectedId, 10)] : null;
    if (nodeData) {
      cosmograph?.selectNode(nodeData, false);
      if (settings.general.zoomOnSelect) {
        cosmograph?.zoomToNode(nodeData);
      }
    } else {
      cosmograph?.unselectNodes();
    }
  }, [selectedId]);

  useEffect(() => {
    const nodeData = focusedId ? nodes?.[parseInt(focusedId, 10)] : null;
    if (nodeData) {
      cosmograph?.focusNode(nodeData);
    } else {
      cosmograph?.focusNode(undefined);
    }
  }, [focusedId, nodes]);

  const onClick = (nodeData: NodeData | undefined): void => {
    setSelectedId(nodeData && selectedId !== nodeData.id ? nodeData.id : null);
  };

  return (
    <Cosmograph
      disableSimulation={false}
      backgroundColor="#000"
      showDynamicLabels={settings.general.showLabels}
      nodeLabelAccessor={(d: NodeData) => d.label}
      nodeColor={(d) => {
        let color = nodeColour(d, maxDegree);

        if (selectedId) {
          if (
            pathInfo.immediateNeighbours.has(d.id) ||
            (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
              maxDistance
          ) {
            return color;
          } else {
            return "hsl(0, 0%, 60%)";
          }
        } else {
          return color;
        }
      }}
      linkColor={(d: EdgeData) => {
        if (!settings.visibleTypes[d.ty]) {
          return "rgba(0, 0, 0, 0)";
        }

        let colour = (saturation: number, alpha: number) =>
          d.ty === "Derivative"
            ? derivativeColour(saturation, alpha)
            : d.ty === "Subgenre"
            ? subgenreColour(saturation, alpha)
            : fusionGenreColour(saturation, alpha);

        const selectedAlpha = 0.8;
        const selectedMinInfluenceAlpha = 0.4;
        const selectedDimmedAlpha = 0.1;
        const unselectedAlpha = 0.3;

        if (selectedId) {
          if (d.source === selectedId) {
            return colour(90, selectedAlpha);
          } else if (d.target === selectedId) {
            return colour(40, selectedAlpha);
          } else {
            let distance = pathInfo.edgeDistances.get(d);
            if (distance !== undefined) {
              const factor = 1 - distance / maxDistance;
              const saturation = Math.max(0, 100 * factor);
              const alpha =
                selectedMinInfluenceAlpha +
                (selectedAlpha - selectedMinInfluenceAlpha) * factor;

              // Use the appropriate base color based on edge type
              if (saturation > 0) {
                return colour(saturation, alpha);
              }
            }

            // Edges not in path
            return `hsla(0, 0%, 20%, ${selectedDimmedAlpha})`;
          }
        }

        // Default edge colors when no selection
        return colour(70, unselectedAlpha);
      }}
      nodeSize={(d: NodeData) => {
        return (
          8.0 * (0.2 + (d.edges.length / maxDegree) * 0.8) +
          1.0 *
            (selectedId &&
            !(
              pathInfo.immediateNeighbours.has(d.id) ||
              (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
                maxDistance
            )
              ? -1
              : 0) +
          1.0 * (focusedId === d.id ? 1 : 0)
        );
      }}
      linkWidth={(d: EdgeData) => {
        if (selectedId) {
          if (d.source === selectedId) {
            return 2.5;
          } else if (d.target === selectedId) {
            return 1.5;
          }
          const distance = pathInfo.edgeDistances.get(d);
          if (distance !== undefined) {
            // Scale width based on distance, with minimum of 1
            return Math.max(1, 2.5 * (1 - distance / maxDistance));
          }
        }
        return 1;
      }}
      linkArrowsSizeScale={1}
      nodeLabelColor="#CCC"
      hoveredNodeLabelColor="#FFF"
      spaceSize={8192}
      {...settings.simulation}
      randomSeed={"Where words fail, music speaks"}
      nodeGreyoutOpacity={1}
      linkGreyoutOpacity={1}
      linkVisibilityMinTransparency={selectedId ? 0.75 : 0.25}
      onClick={onClick}
      onLabelClick={onClick}
    />
  );
}

export function nodeColour(
  d: NodeData,
  maxDegree: number,
  lightness: number = 60
) {
  const hash = d.id
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  const hue = Math.abs(hash % 360);
  let color = `hsl(${hue}, ${
    ((d.edges.length / maxDegree) * 0.8 + 0.2) * 100
  }%, ${lightness}%)`;
  return color;
}

// Helper types for storing path information
type NodeDistances = Map<string, number>;
type EdgeDistances = Map<EdgeData, number>;
type PathInfo = {
  nodeDistances: NodeDistances;
  // Maps edge index to its distance from source
  edgeDistances: EdgeDistances;
  immediateNeighbours: Set<string>;
};
function getPathsWithinDistance(
  startId: string,
  nodes: NodeData[],
  edges: EdgeData[],
  visibleTypes: SettingsData["visibleTypes"],
  maxDistance: number
): PathInfo {
  const nodeDistances = new Map<string, number>();
  const edgeDistances = new Map<EdgeData, number>();
  const immediateNeighbours = new Set<string>();

  const startNodeData = nodes[parseInt(startId, 10)];
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

  // Set the starting node
  nodeDistances.set(startId, 0);

  let frontier = new Set([startId]);
  let currentDistance = 0;

  while (frontier.size > 0 && currentDistance < maxDistance) {
    const nextFrontier = new Set<string>();
    currentDistance++;

    for (const nodeId of frontier) {
      const nodeIndex = parseInt(nodeId, 10);
      const nodeData = nodes[nodeIndex];

      if (!nodeData) continue;

      // Process outgoing edges
      for (const edgeIndex of nodeData.edges) {
        const edge = edges[edgeIndex];
        if (!visibleTypes[edge.ty]) continue;
        if (edge.source === nodeId) {
          // Only follow outgoing edges
          const targetId = edge.target;

          // If we haven't seen this node yet
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

  return { nodeDistances, edgeDistances: edgeDistances, immediateNeighbours };
}
