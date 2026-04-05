import { Dispatch, useReducer, useEffect, useRef, useMemo } from "react";

import {
  EdgeData,
  EdgeType,
  NodeData,
  nodeIdToInt,
  nodePageTitle,
  useDataContext,
} from "../data";
import { stripGenreNamePrefixFromDescription } from "../util/stripGenreNamePrefixFromDescription";

import { GenreLink } from "./components/links/GenreLink";
import { WikitextTruncateAtLength } from "./components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { SearchIcon } from "./components/icons/SearchIcon";
import { SwapIcon } from "./components/icons/SwapIcon";
import { CloseIcon } from "./components/icons/CloseIcon";
import { VISIBLE_TYPES_BY_TYPE, VisibleTypes } from "../settings";
import React from "react";
import { useGenre } from "../services/dataCache";
import { colourStyles } from "./colours";

/** The state of the search component */
export type SearchState =
  | {
      // node not selected, search for a node
      type: "initial";
      sourceQuery: string;
      sourceResults: NodeData[];
      focusTarget?: "source";
    }
  | {
      // node selected, search for a destination node
      type: "selected";
      sourceQuery: string;
      sourceId: string;
      destinationQuery: string;
      destinationResults: NodeData[];
      focusTarget?: "source" | "destination";
    }
  | {
      // source and destination selected, show path if available
      type: "path";
      sourceQuery: string;
      sourceId: string;
      destinationQuery: string;
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
      // any state: select a node (from graph click)
      // initial/selected: transition into `selected` state with sourceId = nodeId
      // path: if node is on the path, do nothing; otherwise, update path with same destination but with new source
      type: "select-node";
      nodeId: string;
    }
  | {
      // `selected`/`path`: update source text without leaving state
      type: "selected|path:set-source-query";
      sourceQuery: string;
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
      // `path`: clear the path, transition into `selected` state with given source
      type: "path:clear";
      newSourceId: string;
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
      // single node from URL/link — updates destination in pathfinding, source otherwise
      type: "hash-navigate";
      nodeId: string;
    }
  | {
      // full path state from URL — restores source + destination + computes path
      type: "restore-path";
      sourceId: string;
      destinationId: string;
    };

/** Search dropdown that searches over genres and shows results */
export function Search({
  selectedId,
  setSelectedId,
  setFocusedId,
  searchState,
  searchDispatch,
  visibleTypes,
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  setFocusedId: (id: string | null) => void;
  searchState: SearchState;
  searchDispatch: Dispatch<SearchAction>;
  visibleTypes: VisibleTypes;
}) {
  const { nodes } = useDataContext();
  const sourceRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  // Restore focus after state transitions
  useEffect(() => {
    if (searchState.focusTarget === "source") {
      sourceRef.current?.focus();
    } else if (searchState.focusTarget === "destination") {
      destRef.current?.focus();
    }
  }, [searchState]);

  // Source and destination values always come directly from state
  const sourceValue = searchState.sourceQuery;
  const destValue =
    searchState.type === "selected"
      ? searchState.destinationQuery
      : searchState.type === "path"
        ? searchState.destinationQuery
        : "";

  const showDest = searchState.type !== "initial";
  const isPath = searchState.type === "path";

  // Source results when editing in selected/path state
  // (shown when sourceQuery differs from the node's label)
  const sourceResultsOnEdit = useMemo(() => {
    if (searchState.type === "initial") return null;
    if (searchState.sourceQuery.length < 2) return null;
    const nodeLabel = nodes[nodeIdToInt(searchState.sourceId)].label;
    if (searchState.sourceQuery === nodeLabel) return null;
    return getFilteredResults(searchState.sourceQuery, nodes, null);
  }, [searchState, nodes]);

  // Results list
  const results =
    searchState.type === "initial"
      ? searchState.sourceResults
      : sourceResultsOnEdit
        ? sourceResultsOnEdit
        : searchState.type === "selected"
          ? searchState.destinationResults
          : null;

  // Whether results are source results (initial search or editing source in selected/path)
  const resultsAreSource =
    searchState.type === "initial" || sourceResultsOnEdit !== null;

  return (
    <div>
      <div
        className={
          isPath
            ? `flex items-center rounded-xl overflow-hidden ${colourStyles.search.container}`
            : undefined
        }
      >
        <SearchBar>
          <SearchInput
            ref={sourceRef}
            placeholder="Search for genre..."
            value={sourceValue}
            onChange={(value) => {
              if (searchState.type === "initial") {
                searchDispatch({
                  type: "set-source-query",
                  sourceQuery: value,
                });
              } else {
                searchDispatch({
                  type: "selected|path:set-source-query",
                  sourceQuery: value,
                });
              }
            }}
          />
          {showDest && (
            <SearchInput
              ref={destRef}
              placeholder="Destination..."
              value={destValue}
              onChange={(value) =>
                searchDispatch({
                  type: "selected|path:set-destination-query",
                  destinationQuery: value,
                })
              }
              onClear={() => {
                if (searchState.type === "path") {
                  searchDispatch({
                    type: "path:clear",
                    newSourceId: selectedId ?? searchState.sourceId,
                  });
                  setSelectedId(selectedId ?? searchState.sourceId);
                } else {
                  searchDispatch({
                    type: "selected|path:set-destination-query",
                    destinationQuery: "",
                  });
                }
              }}
            />
          )}
        </SearchBar>
        {isPath && (
          <button
            className={`ml-2 px-2 py-1 rounded-lg ${colourStyles.search.button} transition-colors`}
            onClick={() => {
              searchDispatch({
                type: "path:swap-source-and-destination",
              });
            }}
            title="Swap source and destination"
          >
            <SwapIcon width={16} height={16} stroke="#9ca3af" />
          </button>
        )}
      </div>

      {showDest && isTouchDevice && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Long-press a label, then swipe left/right to set source/destination.
        </p>
      )}

      {results && results.length > 0 && (
        <GenreResultsList
          label={
            showDest
              ? resultsAreSource
                ? "Source results"
                : "Destination results"
              : undefined
          }
        >
          {results.map((node) => (
            <GenreResultItem
              key={node.id}
              node={node}
              setFocusedId={setFocusedId}
              onClick={() => {
                if (resultsAreSource) {
                  setSelectedId(node.id);
                } else if (searchState.type === "selected") {
                  searchDispatch({
                    type: "selected:select-destination",
                    destinationId: node.id,
                  });
                }
              }}
            />
          ))}
        </GenreResultsList>
      )}

      {isPath && searchState.type === "path" && (
        <>
          {searchState.path ? (
            <GenreResultsList label="Path">
              {searchState.path.map((nodeId) => (
                <GenreResultItem
                  key={nodeId}
                  node={nodes[nodeIdToInt(nodeId)]}
                  setFocusedId={setFocusedId}
                  isSelected={nodeId === selectedId}
                  onClick={() => {
                    setSelectedId(nodeId);
                  }}
                />
              ))}
            </GenreResultsList>
          ) : (
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              No path found from{" "}
              {nodes[nodeIdToInt(searchState.sourceId)].label} to{" "}
              {nodes[nodeIdToInt(searchState.destinationId)].label} through{" "}
              {getFormattedThroughLabels(visibleTypes)}.{" "}
              <button
                className="text-teal-600 dark:text-blue-400 hover:underline"
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
        </>
      )}
    </div>
  );
}

// Reusable components
const SearchInput = React.forwardRef<
  HTMLInputElement,
  {
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onClear?: () => void;
  }
>(function SearchInput({ placeholder, value, onChange, onClear }, ref) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
        <SearchIcon width={16} height={16} stroke="#9ca3af" />
      </div>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        className={`w-full p-2 pl-8 rounded-lg ${colourStyles.search.input}`}
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
});

function SearchBar({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${colourStyles.search.results} rounded-xl overflow-hidden flex flex-col flex-grow gap-2`}
    >
      <div className="flex-1 flex flex-col gap-0">
        {React.Children.map(children, (child, index) => {
          if (index > 0) {
            return (
              <div className="border-t border-slate-300 dark:border-slate-600">
                {child}
              </div>
            );
          }
          return child;
        })}
      </div>
    </div>
  );
}

function GenreResultItem({
  node,
  setFocusedId,
  onClick,
  isSelected,
}: {
  node: NodeData;
  setFocusedId: (id: string | null) => void;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  const genreData = useGenre(nodePageTitle(node));
  const strippedDescription = useMemo(() => {
    if (!genreData?.description) return null;
    return stripGenreNamePrefixFromDescription(
      node.label,
      genreData.description
    );
  }, [node.label, genreData]);

  return (
    <div
      className={`p-2 rounded-lg ${colourStyles.search.item} transition-colors ${
        isSelected ? "ring-2 ring-blue-500" : ""
      }`}
      onMouseEnter={() => setFocusedId(node.id)}
      onMouseLeave={() => setFocusedId(null)}
      onClick={(e) => {
        // Prevent the GenreLink's href from also triggering hash navigation
        e.preventDefault();
        onClick?.();
      }}
    >
      <GenreLink node={node} hoverPreview={false}>
        {node.label}
      </GenreLink>
      <small className="block">
        {genreData ? (
          strippedDescription ? (
            <WikitextTruncateAtLength
              wikitext={strippedDescription}
              length={100}
            />
          ) : (
            "No description available."
          )
        ) : (
          "Loading..."
        )}
      </small>
    </div>
  );
}

function GenreResultsList({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-2 p-1">
      {label && (
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

function getFormattedThroughLabels(visibleTypes: VisibleTypes) {
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
  selectedId: string | null
): [SearchState, Dispatch<SearchAction>] {
  const [state, dispatch] = useReducer(
    (prevState: SearchState, action: SearchAction): SearchState => {
      const labelOf = (id: string) => nodes[nodeIdToInt(id)].label;

      const buildInitialState = (
        sourceQuery: string,
        focusTarget?: "source"
      ): SearchState => ({
        type: "initial",
        sourceQuery,
        sourceResults: getFilteredResults(sourceQuery, nodes, selectedId),
        focusTarget,
      });

      const buildSelectedState = (
        sourceId: string,
        sourceQuery: string,
        destinationQuery: string,
        focusTarget?: "source" | "destination"
      ): SearchState => ({
        type: "selected",
        sourceQuery,
        sourceId,
        destinationQuery,
        destinationResults: getFilteredResults(destinationQuery, nodes, null),
        focusTarget,
      });

      const buildPathState = (
        sourceId: string,
        sourceQuery: string,
        destinationId: string,
        destinationQuery: string
      ): SearchState => {
        // Self-path: collapse to selected
        if (sourceId === destinationId) {
          return buildSelectedState(sourceId, sourceQuery, "", undefined);
        }
        return {
          type: "path",
          sourceQuery,
          sourceId,
          destinationQuery,
          destinationId,
          path: computePath(
            nodes,
            edges,
            visibleTypes,
            sourceId,
            destinationId
          ),
        };
      };

      switch (action.type) {
        case "set-source-query":
          return buildInitialState(action.sourceQuery, "source");
        case "select-node":
          if (prevState.type === "initial" || prevState.type === "selected") {
            return buildSelectedState(
              action.nodeId,
              labelOf(action.nodeId),
              "",
              undefined
            );
          } else {
            // In path state: don't modify the path, just let selectedId update
            return prevState;
          }
        case "selected|path:set-source-query":
          if (prevState.type !== "selected" && prevState.type !== "path") {
            return prevState;
          }
          return { ...prevState, sourceQuery: action.sourceQuery };
        case "selected:clear-source":
          if (prevState.type === "initial") return prevState;
          return buildInitialState("");
        case "selected|path:set-destination-query":
          if (prevState.type !== "selected" && prevState.type !== "path") {
            throw new Error(
              `selected|path:set-destination-query from non-selected/path state (${prevState.type})`
            );
          }

          return {
            type: "selected",
            sourceQuery: prevState.sourceQuery,
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

          return buildPathState(
            prevState.sourceId,
            prevState.sourceQuery,
            action.destinationId,
            labelOf(action.destinationId)
          );
        case "path:swap-source-and-destination":
          if (prevState.type !== "path") {
            throw new Error(
              `path:swap-source-and-destination from non-path state (${prevState.type})`
            );
          }

          return buildPathState(
            prevState.destinationId,
            labelOf(prevState.destinationId),
            prevState.sourceId,
            labelOf(prevState.sourceId)
          );
        case "path:clear":
          if (prevState.type !== "path") {
            throw new Error(
              `path:clear from non-path state (${prevState.type})`
            );
          }

          return buildSelectedState(
            action.newSourceId,
            labelOf(action.newSourceId),
            ""
          );
        case "path:return-to-selected":
          if (prevState.type !== "path") {
            throw new Error(
              `path:return-to-selected from non-path state (${prevState.type})`
            );
          }

          return buildSelectedState(
            prevState.sourceId,
            prevState.sourceQuery,
            labelOf(prevState.sourceId)
          );
        case "path:rebuild":
          if (prevState.type !== "path") {
            // Called by the app, so gracefully ignore rebuild requests in the wrong state
            return prevState;
          }
          return buildPathState(
            prevState.sourceId,
            prevState.sourceQuery,
            prevState.destinationId,
            prevState.destinationQuery
          );
        case "hash-navigate":
          if (prevState.type === "initial") {
            // No source yet — treat as selecting a source
            return buildSelectedState(
              action.nodeId,
              labelOf(action.nodeId),
              "",
              undefined
            );
          } else if (prevState.type === "selected") {
            if (prevState.sourceId === action.nodeId) {
              return prevState;
            }
            // Source exists — set as destination, transition to path
            return buildPathState(
              prevState.sourceId,
              prevState.sourceQuery,
              action.nodeId,
              labelOf(action.nodeId)
            );
          } else {
            if (prevState.sourceId === action.nodeId) {
              return prevState;
            }
            // In path state — rebuild path with same source, new destination
            return buildPathState(
              prevState.sourceId,
              prevState.sourceQuery,
              action.nodeId,
              labelOf(action.nodeId)
            );
          }
        case "restore-path":
          return buildPathState(
            action.sourceId,
            labelOf(action.sourceId),
            action.destinationId,
            labelOf(action.destinationId)
          );
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
    });
}

function computePath(
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
