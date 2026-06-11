import React, { Fragment } from "react";

import {
  EdgeType,
  NodeColourLightness,
  NodeData,
  nodeColour,
  nodeIdToInt,
  useDataContext,
} from "../../data";
import { VISIBLE_TYPES_BY_TYPE, VisibleTypes } from "../../settings";
import type { SetSelectedId } from "../../App";

import { ArrowUpIcon } from "../components/icons/ArrowUpIcon";
import { GenreLink } from "../components/links/GenreLink";
import { colourStyles } from "../colours";
import { GenreSnippet, ListLabel } from "./SearchResults";

/** Format the visible edge types as a coloured, comma-separated phrase. */
export function getFormattedThroughLabels(visibleTypes: VisibleTypes) {
  const labels = Object.entries(visibleTypes)
    .filter(([, visible]) => visible)
    .map(([key]) => parseInt(key) as EdgeType)
    .map((key) => (
      <span
        key={key}
        style={{
          color: VISIBLE_TYPES_BY_TYPE[key].color,
        }}
      >
        {VISIBLE_TYPES_BY_TYPE[key].label.toLowerCase() + "s"}
      </span>
    ));

  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2)
    return (
      <>
        {labels[0]} and {labels[1]}
      </>
    );

  return (
    <>
      {labels.slice(0, -1).map((label, i) => (
        <React.Fragment key={i}>
          {label}
          {i < labels.length - 2 ? ", " : ""}
        </React.Fragment>
      ))}
      {", and "}
      {labels[labels.length - 1]}
    </>
  );
}

/** Explains why there's no path, offering a swap when the reverse works. */
export function NoPathMessage({
  sourceNode,
  destinationNode,
  reverseExists,
  visibleTypes,
  onSwap,
}: {
  sourceNode: NodeData;
  destinationNode: NodeData;
  reverseExists: boolean;
  visibleTypes: VisibleTypes;
  onSwap: () => void;
}) {
  const throughLabels = getFormattedThroughLabels(visibleTypes);
  if (!throughLabels) {
    return (
      <div className={`mt-2 p-1 text-sm ${colourStyles.text.secondary}`}>
        No edge types are enabled — turn some on in Settings to find a path.
      </div>
    );
  }
  return (
    <div className={`mt-2 p-1 text-sm ${colourStyles.text.secondary}`}>
      {reverseExists ? (
        <>
          No path from <strong>{sourceNode.label}</strong> to{" "}
          <strong>{destinationNode.label}</strong> through {throughLabels}, but
          one exists in the other direction.{" "}
          <button
            className={`${colourStyles.text.accentLink} hover:underline`}
            onClick={onSwap}
          >
            Swap direction?
          </button>
        </>
      ) : (
        <>
          No path between <strong>{sourceNode.label}</strong> and{" "}
          <strong>{destinationNode.label}</strong> in either direction through{" "}
          {throughLabels}.
        </>
      )}
    </div>
  );
}

/** The first visible edge type connecting `a` → `b`, if any. */
function edgeTypeBetween(
  nodes: NodeData[],
  edges: ReturnType<typeof useDataContext>["edges"],
  visibleTypes: VisibleTypes,
  a: string,
  b: string
): EdgeType | null {
  for (const edgeIndex of nodes[nodeIdToInt(a)].edges) {
    const edge = edges[edgeIndex];
    if (edge.source === a && edge.target === b && visibleTypes[edge.ty]) {
      return edge.ty;
    }
  }
  return null;
}

function PathRow({
  node,
  isSelected,
  isEndpoint,
  setSelectedId,
  setFocusedId,
  onSetAsSource,
  onSetAsDestination,
}: {
  node: NodeData;
  isSelected: boolean;
  isEndpoint: "source" | "destination" | null;
  setSelectedId: SetSelectedId;
  setFocusedId: (id: string | null) => void;
  onSetAsSource: ((nodeId: string) => void) | null;
  onSetAsDestination: ((nodeId: string) => void) | null;
}) {
  const { max_degree: maxDegree } = useDataContext();
  const dotColour = nodeColour(node, maxDegree, NodeColourLightness.GraphNode);

  return (
    <div
      className={`flex items-stretch ${colourStyles.search.item} border ${colourStyles.border.divider} transition-colors cursor-pointer ${
        isSelected ? `ring-2 ${colourStyles.border.selectedRing}` : ""
      }`}
      onMouseEnter={() => setFocusedId(node.id)}
      onMouseLeave={() => setFocusedId(null)}
      onClick={(e) => {
        // Prevent the GenreLink's href from also triggering hash navigation
        e.preventDefault();
        setSelectedId(node.id, { zoom: "selection" });
      }}
    >
      <div className="w-6 flex-none flex items-center justify-center">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: dotColour }}
        />
      </div>
      <div className="flex-1 min-w-0 py-2 pr-1">
        <GenreLink node={node} hoverPreview={false}>
          {node.label}
        </GenreLink>
        <GenreSnippet node={node} />
      </div>
      <div className="flex-none flex flex-col justify-center gap-1 pr-1">
        {onSetAsSource && isEndpoint !== "source" && (
          <button
            className={`w-11 h-11 flex items-center justify-center ${colourStyles.search.button} transition-colors`}
            title={`Start the path at ${node.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetAsSource(node.id);
            }}
          >
            <ArrowUpIcon width={16} height={16} stroke="#9ba6bc" />
          </button>
        )}
        {onSetAsDestination && isEndpoint !== "destination" && (
          <button
            className={`w-11 h-11 flex items-center justify-center ${colourStyles.search.button} transition-colors`}
            title={`End the path at ${node.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onSetAsDestination(node.id);
            }}
          >
            <ArrowUpIcon
              width={16}
              height={16}
              stroke="#9ba6bc"
              className="rotate-180"
            />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The found path, as a vertical timeline: hue-coloured node dots joined by
 * connectors tinted by the edge type, with per-row retargeting buttons.
 */
export function PathList({
  path,
  selectedId,
  visibleTypes,
  setSelectedId,
  setFocusedId,
  onSetAsSource,
  onSetAsDestination,
}: {
  path: string[];
  selectedId: string | null;
  visibleTypes: VisibleTypes;
  setSelectedId: SetSelectedId;
  setFocusedId: (id: string | null) => void;
  onSetAsSource: ((nodeId: string) => void) | null;
  onSetAsDestination: ((nodeId: string) => void) | null;
}) {
  const { nodes, edges } = useDataContext();

  return (
    <div className="flex flex-col max-h-[60vh] overflow-y-auto mt-2 p-1 gap-0">
      <ListLabel>Path</ListLabel>
      {path.map((nodeId, index) => {
        const connectingType =
          index > 0
            ? edgeTypeBetween(
                nodes,
                edges,
                visibleTypes,
                path[index - 1],
                nodeId
              )
            : null;
        return (
          <Fragment key={nodeId}>
            {index > 0 && (
              <div
                className="w-6 flex-none flex justify-center"
                title={
                  connectingType !== null
                    ? VISIBLE_TYPES_BY_TYPE[connectingType].label
                    : undefined
                }
              >
                <span
                  className="w-0.5 h-3"
                  style={{
                    background:
                      connectingType !== null
                        ? VISIBLE_TYPES_BY_TYPE[connectingType].color
                        : "rgba(255,255,255,0.2)",
                  }}
                />
              </div>
            )}
            <PathRow
              node={nodes[nodeIdToInt(nodeId)]}
              isSelected={nodeId === selectedId}
              isEndpoint={
                index === 0
                  ? "source"
                  : index === path.length - 1
                    ? "destination"
                    : null
              }
              setSelectedId={setSelectedId}
              setFocusedId={setFocusedId}
              onSetAsSource={onSetAsSource}
              onSetAsDestination={onSetAsDestination}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
