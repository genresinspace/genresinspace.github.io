import { useMemo, useEffect, useCallback } from "react";
import { Cosmograph, useCosmograph } from "@cosmograph/react";

import {
  EdgeData,
  EdgeType,
  nodeColour,
  NodeColourLightnessDark,
  NodeColourLightnessLight,
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
import { useTheme } from "../theme";

/** Cosmograph component wired up to display the data. Depends on a Cosmograph context in the parent. */
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
  const data = useDataContext();
  const { nodes, edges, max_degree: maxDegree } = data;
  const { cosmograph } = useCosmograph()!;
  const { theme } = useTheme();

  // Select the appropriate color lightness values based on theme
  const colorLightness =
    theme === "light" ? NodeColourLightnessLight : NodeColourLightnessDark;
  const backgroundColor = theme === "light" ? "#222222" : "#000000";
  const dimmedColor = "hsla(0, 0%, 20%, 0.1)";

  // Calculate connected paths and their distances
  const maxDistance = settings.general.maxInfluenceDistance + 1;
  const pathInfo = useMemo(() => {
    if (!selectedId || !nodes || !edges)
      return {
        nodeDistances: new Map(),
        edgeDistances: new Map(),
      } as PathInfo;
    return getPathsWithinDistance(
      selectedId,
      nodes,
      edges,
      settings.visibleTypes,
      maxDistance
    );
  }, [selectedId, nodes, edges, maxDistance, settings.visibleTypes]);

  // Generate dynamic CSS for per-node label styling
  const labelStyleElement = useMemo(() => {
    if (!nodes) return "";
    const rules: string[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const bgColor = nodeColour(
        node,
        maxDegree,
        colorLightness.GraphLabelBackgroundBorder
      );
      const borderColor = nodeColour(
        node,
        maxDegree,
        colorLightness.GraphLabelBackground
      );
      const textColor = nodeColour(
        node,
        maxDegree,
        colorLightness.GraphLabelText
      );
      const fontSize = 10 + (node.edges.length / maxDegree) * 6;
      rules.push(
        `.node-label-${i} { background-color: ${bgColor}; border-bottom: 4px solid ${borderColor}; color: ${textColor}; font-size: ${fontSize.toFixed(1)}px; }`
      );
    }
    return rules.join("\n");
  }, [nodes, maxDegree, colorLightness]);

  // Fit view to graph once simulation ends
  const hasFittedView = useMemo(() => ({ current: false }), []);
  const onSimulationEnd = useCallback(() => {
    if (!hasFittedView.current && cosmograph) {
      hasFittedView.current = true;
      cosmograph.fitView(500);
    }
  }, [cosmograph, hasFittedView]);

  // Handle selection changes
  useEffect(() => {
    if (!cosmograph) return;
    if (selectedId) {
      const index = nodeIdToInt(selectedId);
      cosmograph.selectPoint(index, false);
      if (settings.general.zoomOnSelect) {
        cosmograph.zoomToPoint(index);
      }
    } else {
      cosmograph.unselectAllPoints();
    }
  }, [selectedId]);

  // Handle focus changes
  useEffect(() => {
    if (!cosmograph) return;
    if (focusedId) {
      cosmograph.setFocusedPoint(nodeIdToInt(focusedId));
    } else {
      cosmograph.setFocusedPoint(undefined);
    }
  }, [focusedId, cosmograph]);

  const isHighlightedDueToSelection = useCallback(
    (nodeId: string, includePath: boolean) => {
      if (!selectedId) return false;
      const isSelected = nodeId === selectedId;
      const isImmediateNeighbour = pathInfo.immediateNeighbours.has(nodeId);
      const isInPath =
        includePath &&
        (pathInfo.nodeDistances.get(nodeId) || Number.POSITIVE_INFINITY) <
          maxDistance;
      const isInDirectionalPath = path?.includes(nodeId);
      return path !== null
        ? isInDirectionalPath
        : isSelected || isImmediateNeighbour || isInPath;
    },
    [selectedId, pathInfo, maxDistance, path]
  );

  const showLabelsForIds = useMemo(() => {
    if (!selectedId || !nodes) return undefined;
    return nodes
      .filter((d) => isHighlightedDueToSelection(d.id, false))
      .map((d) => d.id);
  }, [selectedId, nodes, isHighlightedDueToSelection]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: labelStyleElement }} />
      <Cosmograph
        enableSimulation={true}
        backgroundColor={backgroundColor}
        points={nodes}
        links={edges}
        pointIdBy="id"
        pointIndexBy="index"
        linkSourceBy="source"
        linkSourceIndexBy="sourceIndex"
        linkTargetBy="target"
        linkTargetIndexBy="targetIndex"
        pointColorBy="id"
        pointSizeBy="id"
        linkColorBy="ty"
        linkWidthBy="ty"
        showDynamicLabels={settings.general.showLabels}
        pointLabelBy="label"
        pointLabelClassName={(_text: string, pointIndex: number) => {
          return `node-label node-label-${pointIndex}`;
        }}
        hoveredPointLabelClassName={(_text: string, pointIndex: number) => {
          return `node-label node-hovered-label node-label-${pointIndex}`;
        }}
        pointLabelWeightFn={(_value: unknown, index?: number) => {
          if (index === undefined) return 0.7;
          const node = nodes[index];
          if (!node) return 0.7;
          if (!selectedId) return 0.7;
          const isVisible = isHighlightedDueToSelection(node.id, false);
          if (showLabelsForIds && showLabelsForIds.length > 0) {
            if (isVisible) {
              return node.id === selectedId ? 1.0 : 0.9;
            }
            return 0.1;
          }
          return 0.7;
        }}
        showLabelsFor={showLabelsForIds}
        pointColorByFn={(_value: unknown, index?: number) => {
          if (index === undefined) return "#000";
          const node = nodes[index];
          if (!node) return "#000";
          const colour = nodeColour(node, maxDegree, colorLightness.GraphNode);
          if (selectedId) {
            if (isHighlightedDueToSelection(node.id, true)) {
              return colour;
            } else {
              return "hsla(0, 0%, 70%, 0.1)";
            }
          }
          return colour;
        }}
        linkColorByFn={(_value: unknown, index?: number) => {
          if (index === undefined) return dimmedColor;
          const d = edges[index];
          if (!d) return dimmedColor;

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
          const unselectedAlpha = 0.3;

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
              return dimmedColor;
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

                if (saturation > 0) {
                  return colour(saturation, alpha);
                }
              }
              return dimmedColor;
            }
          }

          return colour(70, unselectedAlpha);
        }}
        pointSizeByFn={(_value: unknown, index?: number) => {
          if (index === undefined) return 4;
          const d = nodes[index];
          if (!d) return 4;
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
        linkWidthByFn={(_value: unknown, index?: number) => {
          if (index === undefined) return 1;
          const d = edges[index];
          if (!d) return 1;
          if (selectedId) {
            if (d.source === selectedId) {
              return 2.5;
            } else if (d.target === selectedId) {
              return 1.5;
            }
            const distance = pathInfo.edgeDistances.get(d);
            if (distance !== undefined) {
              return Math.max(1, 2.5 * (1 - distance / maxDistance));
            }
          }
          return 1;
        }}
        pointSizeStrategy={"direct"}
        pointSizeScale={3}
        linkWidthStrategy={"direct"}
        linkWidthScale={2}
        linkArrowsSizeScale={settings.general.arrowSizeScale}
        spaceSize={4096}
        fitViewOnInit={false}
        onSimulationEnd={onSimulationEnd}
        {...settings.simulation}
        randomSeed={"Where words fail, music speaks"}
        pointGreyoutOpacity={1}
        linkGreyoutOpacity={1}
        linkVisibilityMinTransparency={selectedId ? 0.75 : 0.25}
        onClick={(index: number | undefined) => {
          if (index !== undefined) {
            const nodeId = nodes[index]?.id;
            setSelectedId(nodeId && selectedId !== nodeId ? nodeId : null);
          } else {
            setSelectedId(null);
          }
        }}
        onLabelClick={(index: number) => {
          const nodeId = nodes[index]?.id;
          setSelectedId(nodeId && selectedId !== nodeId ? nodeId : null);
        }}
      />
    </>
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
