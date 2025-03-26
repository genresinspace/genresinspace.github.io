import { useMemo, useEffect } from "react";
import { Cosmograph as RawCosmograph } from "@cosmograph/cosmograph";
import { Cosmograph, useCosmograph } from "@cosmograph/react";

import { EdgeData, NodeData, nodeIdToInt } from "./data";
import { SettingsData } from "./settings";

/** The colour of a derivative genre */
export const derivativeColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(0, ${saturation}%, 60%, ${alpha})`;

/** The colour of a subgenre */
export const subgenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(120, ${saturation}%, 60%, ${alpha})`;

/** The colour of a fusion genre */
export const fusionGenreColour = (saturation: number = 70, alpha: number = 1) =>
  `hsla(240, ${saturation}%, 60%, ${alpha})`;

/** Cosmograph component wired up to display the data. Depends on a Cosmograph context in the parent. */
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
    const nodeData = selectedId ? nodes?.[nodeIdToInt(selectedId)] : null;
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
    const nodeData = focusedId ? nodes?.[nodeIdToInt(focusedId)] : null;
    if (nodeData) {
      cosmograph?.focusNode(nodeData);
    } else {
      cosmograph?.focusNode(undefined);
    }
  }, [focusedId, nodes]);

  useCosmographLabelColourPatch(cosmograph, maxDegree);

  const onClick = (nodeData: NodeData | undefined): void => {
    setSelectedId(nodeData && selectedId !== nodeData.id ? nodeData.id : null);
  };

  const isHighlightedDueToSelection = (d: NodeData, includePath: boolean) => {
    if (!selectedId) return false;
    const isSelected = d.id === selectedId;
    const isImmediateNeighbour = pathInfo.immediateNeighbours.has(d.id);
    const isInPath =
      includePath &&
      (pathInfo.nodeDistances.get(d.id) || Number.POSITIVE_INFINITY) <
        maxDistance;
    return isSelected || isImmediateNeighbour || isInPath;
  };

  const nodeColor = (d: NodeData) => {
    const colour = nodeColour(d, maxDegree);

    if (selectedId) {
      if (isHighlightedDueToSelection(d, true)) {
        return colour;
      } else {
        return "hsl(0, 0%, 60%)";
      }
    } else {
      return colour;
    }
  };
  return (
    <Cosmograph
      disableSimulation={false}
      backgroundColor="#000"
      showDynamicLabels={settings.general.showLabels}
      nodeLabelAccessor={(d: NodeData) => d.label}
      nodeColor={nodeColor}
      linkColor={(d: EdgeData) => {
        if (!settings.visibleTypes[d.ty]) {
          return "rgba(0, 0, 0, 0)";
        }

        const colour = (saturation: number, alpha: number) =>
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
      linkArrowsSizeScale={settings.general.arrowSizeScale}
      nodeLabelColor={nodeColor}
      hoveredNodeLabelColor={nodeColor}
      showLabelsFor={
        selectedId
          ? nodes?.filter((d) => isHighlightedDueToSelection(d, false))
          : undefined
      }
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

/** Given a node, calculate its colour, factoring in degree and lightness */
export function nodeColour(
  d: NodeData,
  maxDegree: number,
  lightness: number = 60
) {
  const hash = d.id
    .split("")
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0);
  const hue = Math.abs(hash % 360);
  const colour = `hsl(${hue}, ${
    ((d.edges.length / maxDegree) * 0.8 + 0.2) * 100
  }%, ${lightness}%)`;
  return colour;
}

/**
 * Patch Cosmograph's functions for rendering labels. This does a number of things:
 * - use a custom background and foreground colour, instead of just foreground colour
 * - set the bottom border to a custom colour
 * - overrides the weight logic to give precedence to selected nodes
 * - sets the font size based on the node's degree
 * - moves labels to be close to the centre of their node, as opposed to on top of it
 * - hardcodes a few assumptions for the project
 *
 * Cosmograph is not fully open-source, so this was done by looking at the source map
 * for the relevant file, extracting the relevant functions, and then updating them
 * to meet our requirements.
 */
function useCosmographLabelColourPatch(
  cosmograph: RawCosmograph<NodeData, EdgeData> | undefined,
  maxDegree: number
) {
  useEffect(() => {
    if (!cosmograph) return;
    if ("wasPatchedByGenresInSpace" in cosmograph) return;

    const calcFontSize = (node: NodeData) => {
      return 10 + (node.edges.length / maxDegree) * 6;
    };

    const getNodeLabelStyle = (node: NodeData, isVisible: boolean) => {
      const style = [
        `background-color: ${nodeColour(node, maxDegree, 25)};`,
        `border-bottom: 4px solid ${nodeColour(node, maxDegree, 35)};`,
      ];
      if (!isVisible) {
        style.push("opacity: 0.1;");
      }
      return style.join(" ");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cosmograph as unknown as any)._renderLabels = function (): void {
      if (this._isLabelsDestroyed || !this._cosmos) return;
      const {
        _cosmos,
        _selectedNodesSet,
        _cosmographConfig: { showDynamicLabels, nodeLabelAccessor },
      } = this;
      let labels = [];
      const trackedNodesPositions = _cosmos.getTrackedNodePositionsMap();
      const nodeToLabelInfo = new Map<
        NodeData,
        [string | undefined, [number, number] | undefined, number]
      >();
      if (showDynamicLabels) {
        const sampledNodesPositions = (
          this as RawCosmograph<NodeData, EdgeData>
        ).getSampledNodePositionsMap();
        sampledNodesPositions?.forEach((positions, id) => {
          const node = _cosmos.graph.getNodeById(id);
          if (node)
            nodeToLabelInfo.set(node, [
              nodeLabelAccessor?.(node) ?? node.id,
              positions,
              0.7,
            ]);
        });
      }
      this._nodesForTopLabels.forEach((node: NodeData) => {
        nodeToLabelInfo.set(node, [
          this._trackedNodeToLabel.get(node),
          trackedNodesPositions.get(node.id),
          0.9,
        ]);
      });
      this._nodesForForcedLabels.forEach((node: NodeData) => {
        nodeToLabelInfo.set(node, [
          this._trackedNodeToLabel.get(node),
          trackedNodesPositions.get(node.id),
          1.0,
        ]);
      });
      labels = [...nodeToLabelInfo.entries()].map(
        ([p, [text, positions, weight]]) => {
          const screenPosition = this.spaceToScreenPosition([
            positions?.[0] ?? 0,
            positions?.[1] ?? 0,
          ]) as [number, number];

          const isSelected = _selectedNodesSet?.has(p);
          const isVisible =
            isSelected ||
            this._nodesForForcedLabels.size == 0 ||
            this._nodesForForcedLabels.has(p);

          return {
            id: p.id,
            text: text ?? "",
            x: screenPosition[0],
            y: screenPosition[1],
            fontSize: calcFontSize(p),
            weight:
              this._nodesForForcedLabels.size > 0
                ? isVisible
                  ? 100 + (isSelected ? 100 : 0)
                  : 0.1
                : weight,
            shouldBeShown: isVisible,
            style: getNodeLabelStyle(p, isVisible),
            color: nodeColour(p, maxDegree, 60),
            className: "node-label",
          };
        }
      );
      this._cssLabelsRenderer.setLabels(labels);
      this._cssLabelsRenderer.draw(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cosmograph as unknown as any)._renderLabelForHovered = function (
      node?: NodeData,
      nodeSpacePosition?: [number, number]
    ): void {
      if (!this._cosmos) return;
      const {
        _cosmographConfig: {
          showHoveredNodeLabel,
          nodeLabelAccessor,
          hoveredNodeLabelColor,
        },
      } = this;
      if (this._isLabelsDestroyed) return;
      if (showHoveredNodeLabel && node && nodeSpacePosition) {
        const screenPosition = this.spaceToScreenPosition(
          nodeSpacePosition
        ) as [number, number];
        this._hoveredCssLabel.setText(nodeLabelAccessor?.(node) ?? node.id);
        this._hoveredCssLabel.setVisibility(true);
        this._hoveredCssLabel.setPosition(screenPosition[0], screenPosition[1]);
        this._hoveredCssLabel.setClassName("node-label node-hovered-label");
        this._hoveredCssLabel.setStyle(getNodeLabelStyle(node, true));
        this._hoveredCssLabel.setFontSize(calcFontSize(node));
        const textColor = hoveredNodeLabelColor(node);
        if (textColor) this._hoveredCssLabel.setColor(textColor);
      } else {
        this._hoveredCssLabel.setVisibility(false);
      }
      this._hoveredCssLabel.draw();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cosmograph as unknown as any).wasPatchedByGenresInSpace = true;
  }, [cosmograph, maxDegree]);
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
