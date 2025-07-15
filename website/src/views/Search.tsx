import { Dispatch, useReducer, useEffect, useRef } from "react";

import { EdgeData, NodeData, nodeIdToInt, useDataContext } from "../data";
import { stripGenreNamePrefixFromDescription } from "../util/stripGenreNamePrefixFromDescription";

import { GenreLink } from "./components/links/GenreLink";
import { WikitextTruncateAtLength } from "./components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { SearchIcon } from "./components/icons/SearchIcon";
import { SwapIcon } from "./components/icons/SwapIcon";
import { CloseIcon } from "./components/icons/CloseIcon";
import { VISIBLE_TYPES_BY_TYPE, VisibleTypes } from "../settings";
import React from "react";

/** Represents a search result with node data and description */
type SearchResult = {
  node: NodeData;
  strippedDescription: string;
};

/** The state of the search component */
export type SearchState =
  | {
      // node not selected, search for a node
      type: "initial";
      sourceQuery: string;
      sourceResults: SearchResult[];
      focusTarget?: "source";
    }
  | {
      // node selected, search for a destination node
      type: "selected";
      sourceId: string;
      destinationQuery: string;
      destinationResults: SearchResult[];
      focusTarget?: "source" | "destination";
    }
  | {
      // source and destination selected, show path if available
      type: "path";
      sourceId: string;
      destinationId: string;
      path: string[] | null;
      focusTarget?: "source" | "destination";
    };

/** The actions that can be dispatched to the search reducer */
export type SearchAction =
  | {
      // any state: set the source query for the search, go to `initial` state
      type: "set-source-query";
      sourceQuery: string;
    }
  | {
      // any state: select a node
      // initial/selected: transition into `selected` state with sourceId = nodeId
      // path: if node is on the path, do nothing; otherwise, update path with same destination but with new source
      type: "select-node";
      nodeId: string;
    }
  | {
      // `selected`: clear the source node, transition into `initial` state
      type: "selected:clear-source";
    }
  | {
      // `selected`/`path`: set the destination query for the search, transition into `selected` state
      type: "selected|path:set-destination-query";
      destinationQuery: string;
    }
  | {
      // `selected`: select a destination node, transition into `path` state
      type: "selected:select-destination";
      destinationId: string;
    }
  | {
      // `path`: swap the source and destination, stay in `path` state
      type: "path:swap-source-and-destination";
    }
  | {
      // `path`: clear the path, transition into `selected` state
      type: "path:clear";
    }
  | {
      // `path`: return to the source node, but preserve destination; transition into `selected` state
      type: "path:return-to-selected";
    }
  | {
      // `path`: some global state has changed; rebuild the path, stay in `path` state
      type: "path:rebuild";
    }
  | {
      // `path`: experimental pathfinding was disabled, transition into `selected` state
      type: "path:disable-experimental";
    };

/** Search dropdown that searches over genres and shows results */
export function Search({
  selectedId,
  setSelectedId,
  setFocusedId,
  searchState,
  searchDispatch,
  visibleTypes,
  experimentalPathfinding,
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setFocusedId: (id: string | null) => void;
  searchState: SearchState;
  searchDispatch: Dispatch<SearchAction>;
  visibleTypes: VisibleTypes;
  experimentalPathfinding: boolean;
}) {
  switch (searchState.type) {
    case "initial":
      return (
        <SearchInitial
          searchState={searchState}
          searchDispatch={searchDispatch}
          setFocusedId={setFocusedId}
          setSelectedId={setSelectedId}
        />
      );
    case "selected":
      return (
        <SearchSelected
          searchState={searchState}
          searchDispatch={searchDispatch}
          setFocusedId={setFocusedId}
          experimentalPathfinding={experimentalPathfinding}
        />
      );
    case "path":
      return (
        <SearchPath
          searchState={searchState}
          searchDispatch={searchDispatch}
          setFocusedId={setFocusedId}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          visibleTypes={visibleTypes}
          experimentalPathfinding={experimentalPathfinding}
        />
      );
  }
}

function SearchInitial({
  searchState,
  searchDispatch,
  setFocusedId,
  setSelectedId,
}: {
  searchState: Extract<SearchState, { type: "initial" }>;
  searchDispatch: Dispatch<SearchAction>;
  setFocusedId: (id: string | null) => void;
  setSelectedId: (id: string | null) => void;
}) {
  return (
    <div>
      <SearchBar>
        <SearchInput
          placeholder="Search for genre..."
          value={searchState.sourceQuery}
          onChange={(value) =>
            searchDispatch({
              type: "set-source-query",
              sourceQuery: value,
            })
          }
          shouldFocus={searchState.focusTarget === "source"}
        />
      </SearchBar>

      <GenreResultsList>
        {searchState.sourceResults.map(({ node, strippedDescription }) => (
          <GenreResultItem
            key={node.id}
            node={node}
            description={strippedDescription}
            setFocusedId={setFocusedId}
            onClick={() => {
              setSelectedId(node.id);
            }}
          />
        ))}
      </GenreResultsList>
    </div>
  );
}

function SearchSelected({
  searchState,
  searchDispatch,
  setFocusedId,
  experimentalPathfinding,
}: {
  searchState: Extract<SearchState, { type: "selected" }>;
  searchDispatch: Dispatch<SearchAction>;
  setFocusedId: (id: string | null) => void;
  experimentalPathfinding: boolean;
}) {
  const { nodes } = useDataContext();

  return (
    <div>
      <SearchBar>
        <SearchInput
          placeholder="Search for genre..."
          value={nodes[nodeIdToInt(searchState.sourceId)].label}
          onChange={(value) =>
            searchDispatch({
              type: "set-source-query",
              sourceQuery: value,
            })
          }
          shouldFocus={searchState.focusTarget === "source"}
        />
        {experimentalPathfinding && (
          <SearchInput
            placeholder="Destination..."
            value={searchState.destinationQuery}
            onChange={(value) =>
              searchDispatch({
                type: "selected|path:set-destination-query",
                destinationQuery: value,
              })
            }
            onClear={() => {
              searchDispatch({
                type: "selected|path:set-destination-query",
                destinationQuery: "",
              });
            }}
            shouldFocus={searchState.focusTarget === "destination"}
          />
        )}
      </SearchBar>

      {experimentalPathfinding && (
        <GenreResultsList>
          {searchState.destinationResults.map(
            ({ node, strippedDescription }) => (
              <GenreResultItem
                key={node.id}
                node={node}
                description={strippedDescription}
                setFocusedId={setFocusedId}
                onClick={() => {
                  searchDispatch({
                    type: "selected:select-destination",
                    destinationId: node.id,
                  });
                }}
              />
            )
          )}
        </GenreResultsList>
      )}
    </div>
  );
}

function SearchPath({
  searchState,
  searchDispatch,
  setFocusedId,
  selectedId,
  setSelectedId,
  visibleTypes,
  experimentalPathfinding,
}: {
  searchState: Extract<SearchState, { type: "path" }>;
  searchDispatch: Dispatch<SearchAction>;
  setFocusedId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  visibleTypes: VisibleTypes;
  experimentalPathfinding: boolean;
}) {
  const { nodes } = useDataContext();

  // If experimental pathfinding is disabled, don't render anything while transitioning
  if (!experimentalPathfinding) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center bg-neutral-700">
        <SearchBar>
          <SearchInput
            placeholder="Search for genre..."
            value={nodes[nodeIdToInt(searchState.sourceId)].label}
            onChange={(value) =>
              searchDispatch({
                type: "set-source-query",
                sourceQuery: value,
              })
            }
            shouldFocus={searchState.focusTarget === "source"}
          />
          <SearchInput
            placeholder="Destination..."
            value={nodes[nodeIdToInt(searchState.destinationId)].label}
            onChange={(value) =>
              searchDispatch({
                type: "selected|path:set-destination-query",
                destinationQuery: value,
              })
            }
            onClear={() => {
              searchDispatch({
                type: "selected|path:set-destination-query",
                destinationQuery: "",
              });
            }}
            shouldFocus={searchState.focusTarget === "destination"}
          />
        </SearchBar>
        <button
          className="ml-2 px-2 py-1 bg-neutral-700 hover:bg-neutral-600 transition-colors"
          onClick={() => {
            searchDispatch({
              type: "path:swap-source-and-destination",
            });
          }}
          title="Swap source and destination"
        >
          <SwapIcon width={16} height={16} stroke="#9ca3af" />
        </button>
      </div>

      {searchState.path ? (
        <GenreResultsList>
          {searchState.path.map((nodeId) => {
            const node = nodes[nodeIdToInt(nodeId)];
            const isSelected = nodeId === selectedId;
            return (
              <GenreResultItem
                key={nodeId}
                node={node}
                description={
                  node.wikitext_description
                    ? stripGenreNamePrefixFromDescription(
                        node.label,
                        node.wikitext_description
                      )
                    : ""
                }
                setFocusedId={setFocusedId}
                isSelected={isSelected}
                onClick={() => {
                  setSelectedId(nodeId);
                }}
              />
            );
          })}
        </GenreResultsList>
      ) : (
        <div className="mt-2 text-sm text-neutral-400">
          No path found from {nodes[nodeIdToInt(searchState.sourceId)].label} to{" "}
          {nodes[nodeIdToInt(searchState.destinationId)].label} through{" "}
          {getFormattedThroughLabels(visibleTypes)}.{" "}
          <button
            className="text-blue-400 hover:underline"
            onClick={() => {
              searchDispatch({
                type: "path:swap-source-and-destination",
              });
            }}
          >
            Try swapping direction?
          </button>
        </div>
      )}
    </div>
  );
}

// Reusable components

function SearchInput({
  placeholder,
  value,
  onChange,
  onClear,
  shouldFocus = false,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  shouldFocus?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore focus when the input is recreated and should be focused
  useEffect(() => {
    if (shouldFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [shouldFocus]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
        <SearchIcon width={16} height={16} stroke="#9ca3af" />
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className="w-full p-2 pl-8 bg-neutral-700"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {onClear && (
        <button
          className="absolute inset-y-0 right-2 flex items-center hover:opacity-75 transition-opacity"
          onClick={onClear}
          title="Clear destination"
        >
          <CloseIcon width={16} height={16} stroke="#9ca3af" />
        </button>
      )}
    </div>
  );
}

function SearchBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-neutral-700 flex flex-col flex-grow gap-2">
      <div className="flex-1 flex flex-col gap-0">
        {React.Children.map(children, (child, index) => {
          if (index > 0) {
            return <div className="border-t border-neutral-600">{child}</div>;
          }
          return child;
        })}
      </div>
    </div>
  );
}

function GenreResultItem({
  node,
  description,
  setFocusedId,
  onClick,
  isSelected,
}: {
  node: NodeData;
  description: string;
  setFocusedId: (id: string | null) => void;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  return (
    <div
      className={`p-2 bg-neutral-900 hover:bg-neutral-700 transition-colors ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onMouseEnter={() => setFocusedId(node.id)}
      onMouseLeave={() => setFocusedId(null)}
      onClick={onClick}
    >
      <GenreLink node={node} hoverPreview={false}>
        {node.label}
      </GenreLink>
      {description && (
        <small className="block">
          <WikitextTruncateAtLength wikitext={description} length={100} />
        </small>
      )}
    </div>
  );
}

function GenreResultsList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-2">
      {children}
    </div>
  );
}

function getFormattedThroughLabels(visibleTypes: VisibleTypes) {
  const labels = Object.entries(visibleTypes)
    .filter(([, visible]) => visible)
    .map(([label]) => (
      <span
        key={label}
        style={{
          color: VISIBLE_TYPES_BY_TYPE[label as keyof VisibleTypes].color,
        }}
      >
        {VISIBLE_TYPES_BY_TYPE[
          label as keyof VisibleTypes
        ].label.toLowerCase() + "s"}
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

/**
 * Hook to manage search state and actions
 * @param nodes - Array of node data
 * @param edges - Array of edge data
 * @param visibleTypes - Types of nodes that are visible
 * @param selectedId - ID of currently selected node
 * @returns A tuple containing search state and dispatch function
 */
export function useSearchState(
  nodes: NodeData[],
  edges: EdgeData[],
  visibleTypes: VisibleTypes,
  selectedId: string | null,
  experimentalPathfinding: boolean
): [SearchState, Dispatch<SearchAction>] {
  const [state, dispatch] = useReducer(
    (prevState: SearchState, action: SearchAction): SearchState => {
      const buildInitialState = (sourceQuery: string): SearchState => ({
        type: "initial",
        sourceQuery,
        sourceResults: getFilteredResults(sourceQuery, nodes, selectedId),
        focusTarget: "source",
      });

      const buildSelectedState = (
        sourceId: string,
        destinationQuery: string
      ): SearchState => ({
        type: "selected",
        sourceId,
        destinationQuery,
        destinationResults: getFilteredResults(destinationQuery, nodes, null),
        focusTarget: destinationQuery ? "destination" : "source",
      });

      const buildPathState = (
        sourceId: string,
        destinationId: string
      ): SearchState => ({
        type: "path",
        sourceId,
        destinationId,
        path: computePath(nodes, edges, visibleTypes, sourceId, destinationId),
        focusTarget: "source",
      });

      switch (action.type) {
        case "set-source-query":
          return buildInitialState(action.sourceQuery);
        case "select-node":
          if (prevState.type === "initial" || prevState.type === "selected") {
            return buildSelectedState(action.nodeId, "");
          } else {
            if (prevState.path && prevState.path.includes(action.nodeId)) {
              return prevState;
            } else {
              return buildPathState(action.nodeId, prevState.destinationId);
            }
          }
        case "selected:clear-source":
          if (prevState.type !== "selected") {
            // Called by the app, so gracefully ignore clear-source requests in the wrong state
            return prevState;
          }

          return buildInitialState("");
        case "selected|path:set-destination-query":
          if (prevState.type !== "selected" && prevState.type !== "path") {
            throw new Error(
              `selected|path:set-destination-query from non-selected/path state (${prevState.type})`
            );
          }

          return {
            type: "selected",
            sourceId: prevState.sourceId,
            destinationQuery: action.destinationQuery,
            destinationResults: getFilteredResults(
              action.destinationQuery,
              nodes,
              null
            ),
            focusTarget: "destination" as const,
          };
        case "selected:select-destination":
          if (prevState.type !== "selected") {
            throw new Error(
              `selected:select-destination from non-selected state (${prevState.type})`
            );
          }

          return buildPathState(prevState.sourceId, action.destinationId);
        case "path:swap-source-and-destination":
          if (prevState.type !== "path") {
            throw new Error(
              `path:swap-source-and-destination from non-path state (${prevState.type})`
            );
          }

          return buildPathState(prevState.destinationId, prevState.sourceId);
        case "path:clear":
          if (prevState.type !== "path") {
            throw new Error(
              `path:clear from non-path state (${prevState.type})`
            );
          }

          return buildSelectedState(prevState.sourceId, "");
        case "path:return-to-selected":
          if (prevState.type !== "path") {
            throw new Error(
              `path:return-to-selected from non-path state (${prevState.type})`
            );
          }

          return buildSelectedState(
            prevState.sourceId,
            nodes[nodeIdToInt(prevState.sourceId)].label
          );
        case "path:rebuild":
          if (prevState.type !== "path") {
            // Called by the app, so gracefully ignore rebuild requests in the wrong state
            return prevState;
          }
          return buildPathState(prevState.sourceId, prevState.destinationId);
        case "path:disable-experimental":
          if (prevState.type !== "path") {
            throw new Error(
              `path:disable-experimental from non-path state (${prevState.type})`
            );
          }
          return buildSelectedState(prevState.sourceId, "");
        default:
          return action satisfies never;
      }
    },
    {
      type: "initial",
      sourceQuery: "",
      sourceResults: [],
    }
  );

  // Effect to handle when experimentalPathfinding is disabled while in path state
  useEffect(() => {
    if (!experimentalPathfinding && state.type === "path") {
      dispatch({ type: "path:disable-experimental" });
    }
  }, [experimentalPathfinding, state.type, dispatch]);

  return [state, dispatch];
}

function getFilteredResults(
  filter: string,
  nodes: NodeData[],
  selectedId: string | null
) {
  if (filter.length < 2) {
    return [];
  }

  // Check if current filter matches selected node before showing results
  const currentNode = selectedId ? nodes[nodeIdToInt(selectedId)] : null;
  if (currentNode?.label.toLowerCase() === filter.toLowerCase()) {
    return [];
  }

  // Normalize the filter string to remove diacritics and convert to lowercase
  const normalizeStr = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const normalizedFilter = normalizeStr(filter);

  return nodes
    .filter((node) => normalizeStr(node.label).includes(normalizedFilter))
    .sort((a, b) => {
      // Sort by closest length first
      const lengthDiffA = Math.abs(a.label.length - filter.length);
      const lengthDiffB = Math.abs(b.label.length - filter.length);
      if (lengthDiffA !== lengthDiffB) {
        return lengthDiffA - lengthDiffB;
      }
      // Then alphabetically
      return a.label.localeCompare(b.label);
    })
    .map((node) => ({
      node,
      strippedDescription: stripGenreNamePrefixFromDescription(
        node.label,
        node.wikitext_description ?? ""
      ),
    }));
}

function computePath(
  nodes: NodeData[],
  edges: EdgeData[],
  visibleTypes: VisibleTypes,
  source: string,
  destination: string
): string[] | null {
  // Dijkstra's algorithm to find shortest path
  const distances = new Map<string, number>();
  const previous = new Map<string, string>();
  const unvisited = new Set<string>();
  const visited = new Set<string>();

  // Initialize distances
  nodes.forEach((node) => {
    distances.set(node.id, Infinity);
    unvisited.add(node.id);
  });
  distances.set(source, 0);

  while (unvisited.size > 0) {
    // Find unvisited node with smallest distance
    let currentId: string | null = null;
    let smallestDistance = Infinity;
    for (const id of unvisited) {
      const distance = distances.get(id)!;
      if (distance < smallestDistance) {
        smallestDistance = distance;
        currentId = id;
      }
    }

    if (!currentId || smallestDistance === Infinity) break;

    // If we reached the destination, reconstruct the path
    if (currentId === destination) {
      const path: string[] = [];
      let current = currentId;
      while (current) {
        path.unshift(current);
        current = previous.get(current)!;
      }
      return path;
    }

    // Mark as visited
    unvisited.delete(currentId);
    visited.add(currentId);

    // Update distances to neighbors
    const currentNode = nodes[nodeIdToInt(currentId)];
    for (const edgeIndex of currentNode.edges) {
      const edge = edges[edgeIndex];
      if (edge.source === currentId && visibleTypes[edge.ty]) {
        const neighborId = edge.target;
        if (!visited.has(neighborId)) {
          const newDistance = distances.get(currentId)! + 1;
          if (newDistance < distances.get(neighborId)!) {
            distances.set(neighborId, newDistance);
            previous.set(neighborId, currentId);
          }
        }
      }
    }
  }

  return null;
}
