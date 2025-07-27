import { useMemo, useEffect, useRef, useCallback, useState } from "react";

import {
  EdgeData,
  EdgeType,
  nodeColour,
  NodeColourLightness,
  NodeData,
  nodeIdToInt,
  useDataContext,
} from "../data";
import {
  derivativeColour,
  fusionGenreColour,
  SettingsData,
  subgenreColour,
} from "../settings";
import ForceGraph, { ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide } from "d3-force";

/** Renders a graph using `react-force-graph-2d`. */
export function Graph({
  settings,
  selectedId,
  setSelectedId,
  focusedId,
  path,
}: {
  settings: SettingsData;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusedId: string | null;
  path: string[] | null;
}) {
  const { max_degree: maxDegree, nodes, edges } = useDataContext();
  const fgRef = useRef<ForceGraphMethods<NodeData, EdgeData>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Calculate connected paths and their distances
  const maxDistance = settings.general.maxInfluenceDistance + 1;
  const pathInfo = useMemo(() => {
    if (!selectedId || !nodes || !edges)
      return { nodeDistances: new Map(), edgeDistances: new Map() } as PathInfo;
    return getPathsWithinDistance(
      selectedId,
      nodes,
      edges,
      settings.visibleTypes,
      maxDistance
    );
  }, [selectedId, nodes, edges, maxDistance, settings.visibleTypes]);

  const nodeSize = useCallback(
    (d: NodeData) => {
      return (
        10 *
        (8.0 * (0.2 + (d.edges.length / maxDegree) * 0.8) +
          1.0 *
            (selectedId &&
            !(
              pathInfo.immediateNeighbours.has(d.id) ||
              (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
                maxDistance
            )
              ? -1
              : 0) +
          1.0 * (focusedId === d.id ? 1 : 0))
      );
    },
    [selectedId, focusedId]
  );

  const isHighlightedDueToSelection = useCallback(
    (d: NodeData, includePath: boolean): boolean => {
      if (!selectedId) return false;
      const isSelected = d.id === selectedId;
      const isImmediateNeighbour = pathInfo.immediateNeighbours.has(d.id);
      const isInPath =
        includePath &&
        (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
          maxDistance;
      const isInDirectionalPath = path?.includes(d.id) || false;
      return path !== null
        ? isInDirectionalPath
        : isSelected || isImmediateNeighbour || isInPath;
    },
    [selectedId, pathInfo, path, maxDistance]
  );

  const nodeDataColour = useCallback(
    (node: NodeData, isBeingHovered: boolean) => {
      const colour = nodeColour(node, maxDegree, NodeColourLightness.GraphNode);

      if (selectedId && !isBeingHovered) {
        if (isHighlightedDueToSelection(node, true)) {
          return colour;
        } else {
          return "hsla(0, 0%, 70%, 0.1)";
        }
      } else {
        return colour;
      }
    },
    [selectedId, maxDegree]
  );

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("link")?.distance(50);
      fgRef.current.d3Force("charge")?.strength(-5000);
      fgRef.current?.d3Force(
        "collide",
        forceCollide((d) => 2 * nodeSize(d))
      );
    }
  }, [nodeSize]);

  useEffect(() => {
    const nodeData = selectedId ? nodes?.[nodeIdToInt(selectedId)] : null;
    if (nodeData) {
      if (settings.general.zoomOnSelect) {
        fgRef.current?.zoomToFit(undefined, undefined, (d) =>
          isHighlightedDueToSelection(d, true)
        );
      }
    }
  }, [selectedId, settings.general.zoomOnSelect, isHighlightedDueToSelection]);

  // Handle resize events to update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newDimensions = {
          width: rect.width,
          height: rect.height,
        };
        console.log("Graph container resized:", newDimensions);
        setDimensions(newDimensions);
      }
    };

    // Initial size
    updateDimensions();

    // Set up resize observer for more accurate size tracking
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerRef.current) {
          const rect = entry.contentRect;
          setDimensions({
            width: rect.width,
            height: rect.height,
          });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Also listen to window resize as fallback
    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  const onClick = (nodeData: NodeData | undefined): void => {
    setSelectedId(nodeData && selectedId !== nodeData.id ? nodeData.id : null);
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      <ForceGraph
        key={`${dimensions.width}x${dimensions.height}`}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{
          nodes,
          links: edges,
        }}
        ref={fgRef as any}
        backgroundColor="#000"
        nodeColor={(d) => nodeDataColour(d, false)}
        nodeLabel={(d) => d.label}
        nodeVal={nodeSize}
        nodeRelSize={2}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkCurvature={0.25}
        linkColor={(d: EdgeData) => {
          if (!settings.visibleTypes[d.ty]) {
            return "rgba(0, 0, 0, 0)";
          }

          const colour = (saturation: number, alpha: number) =>
            d.ty === EdgeType.Derivative
              ? derivativeColour(saturation, alpha)
              : d.ty === EdgeType.Subgenre
                ? subgenreColour(saturation, alpha)
                : fusionGenreColour(saturation, alpha);

          const selectedAlpha = 0.8;
          const selectedMinInfluenceAlpha = 0.4;
          const selectedDimmedAlpha = 0.1;
          const unselectedAlpha = 0.3;
          const dimmedColour = `hsla(0, 0%, 20%, ${selectedDimmedAlpha})`;

          if (selectedId) {
            if (path) {
              const sourceIndex = path.indexOf(d.source);
              const targetIndex = path.indexOf(d.target);
              if (
                sourceIndex !== -1 &&
                targetIndex !== -1 &&
                Math.abs(sourceIndex - targetIndex) === 1
              ) {
                return colour(90, selectedAlpha);
              }
              return dimmedColour;
            } else if (d.source === selectedId) {
              return colour(90, selectedAlpha);
            } else if (d.target === selectedId) {
              return colour(40, selectedAlpha);
            } else {
              const distance = pathInfo.edgeDistances.get(d);
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
              return dimmedColour;
            }
          }

          // Default edge colors when no selection
          return colour(70, unselectedAlpha);
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
        onNodeClick={onClick}
        onBackgroundClick={() => setSelectedId(null)}
        enableNodeDrag={false}
      />
    </div>
  );
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

  // Set the starting node
  nodeDistances.set(startId, 0);

  let frontier = new Set([startId]);
  let currentDistance = 0;

  while (frontier.size > 0 && currentDistance < maxDistance) {
    const nextFrontier = new Set<string>();
    currentDistance++;

    for (const nodeId of frontier) {
      const nodeData = nodes[nodeIdToInt(nodeId)];

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
