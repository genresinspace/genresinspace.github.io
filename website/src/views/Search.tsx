import { useMemo, useState } from "react";

import { nodeIdToInt, useDataContext } from "../data";
import { stripGenreNamePrefixFromDescription } from "../util";

import { GenreLink } from "./components/links/GenreLink";
import { WikitextTruncateAtLength } from "./components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { SearchIcon } from "./components/icons/SearchIcon";
import { SwapIcon } from "./components/icons/SwapIcon";
import { CloseIcon } from "./components/icons/CloseIcon";

/** Search dropdown that searches over genres and shows results */
export function Search({
  selectedId,
  setFocusedId,
  filter,
  setFilter,
  destinationId,
  setDestinationId,
  path,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  filter: string;
  setFilter: (filter: string) => void;
  destinationId: string | null;
  setDestinationId: (id: string | null) => void;
  path: string[] | null;
}) {
  const { nodes } = useDataContext();
  const [destinationFilter, setDestinationFilter] = useState("");

  const isShowingDestination =
    selectedId && nodes[nodeIdToInt(selectedId)]?.label === filter;

  const sourceResults = useMemo(() => {
    return getFilteredResults(filter, nodes, selectedId);
  }, [filter, nodes, selectedId]);

  const destinationResults = useMemo(() => {
    if (!isShowingDestination) {
      return [];
    }
    return getFilteredResults(destinationFilter, nodes, destinationId);
  }, [destinationFilter, nodes, destinationId, isShowingDestination]);

  return (
    <div>
      <div className="flex flex-col">
        <div className="bg-neutral-700 flex gap-2">
          <div className="flex-1 flex flex-col gap-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                <SearchIcon width={16} height={16} stroke="#9ca3af" />
              </div>
              <input
                type="text"
                placeholder="Search for genre..."
                className="w-full p-2 pl-8 bg-neutral-700"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            {isShowingDestination && (
              <div className="relative">
                <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                  <SearchIcon width={16} height={16} stroke="#9ca3af" />
                </div>
                <input
                  type="text"
                  placeholder="Destination..."
                  className="w-full p-2 pl-8 bg-neutral-700 border-t border-neutral-600"
                  value={destinationFilter}
                  onChange={(e) => setDestinationFilter(e.target.value)}
                />
                {destinationId && (
                  <button
                    className="absolute inset-y-0 right-2 flex items-center hover:opacity-75 transition-opacity"
                    onClick={() => {
                      setDestinationId(null);
                      setDestinationFilter("");
                    }}
                    title="Clear destination"
                  >
                    <CloseIcon width={16} height={16} stroke="#9ca3af" />
                  </button>
                )}
              </div>
            )}
          </div>

          {isShowingDestination && (
            <button
              className="self-center px-2 py-1 bg-neutral-700 hover:bg-neutral-600 transition-colors"
              onClick={() => {
                if (selectedId && destinationId) {
                  const oldSourceLabel = nodes[nodeIdToInt(selectedId)].label;
                  const oldDestLabel = nodes[nodeIdToInt(destinationId)].label;
                  setDestinationId(selectedId);
                  setFilter(oldDestLabel);
                  setDestinationFilter(oldSourceLabel);
                }
              }}
              title="Swap source and destination"
            >
              <SwapIcon width={16} height={16} stroke="#9ca3af" />
            </button>
          )}
        </div>

        {destinationId && !path && (
          <div className="mt-2 text-sm text-neutral-400">
            No path found from {nodes[nodeIdToInt(selectedId!)].label} to{" "}
            {nodes[nodeIdToInt(destinationId)].label}.{" "}
            <button
              className="text-blue-400 hover:underline"
              onClick={() => {
                if (selectedId && destinationId) {
                  const oldSourceLabel = nodes[nodeIdToInt(selectedId)].label;
                  const oldDestLabel = nodes[nodeIdToInt(destinationId)].label;
                  setDestinationId(selectedId);
                  setFilter(oldDestLabel);
                  setDestinationFilter(oldSourceLabel);
                }
              }}
            >
              Try swapping direction?
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-2">
        {(isShowingDestination ? destinationResults : sourceResults).map(
          ({ node, strippedDescription }) => (
            <div
              key={node.id}
              className="p-2 bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors"
              onMouseEnter={() => setFocusedId(node.id)}
              onMouseLeave={() => setFocusedId(null)}
              onClick={() => {
                if (isShowingDestination) {
                  setDestinationId(node.id);
                  setDestinationFilter(node.label);
                } else {
                  setFilter(node.label);
                }
              }}
            >
              <GenreLink node={node} hoverPreview={false}>
                {node.label}
              </GenreLink>
              <small className="block">
                <WikitextTruncateAtLength
                  wikitext={strippedDescription}
                  length={100}
                />
              </small>
            </div>
          )
        )}
      </div>

      {path && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Path:</h3>
          <div className="flex flex-col gap-2">
            {path.map((nodeId) => {
              const node = nodes[nodeIdToInt(nodeId)];
              const isSelected = nodeId === selectedId;
              return (
                <div
                  key={nodeId}
                  className={`p-2 bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors ${
                    isSelected ? "ring-2 ring-blue-500" : ""
                  }`}
                  onMouseEnter={() => setFocusedId(nodeId)}
                  onMouseLeave={() => setFocusedId(null)}
                >
                  <GenreLink node={node} hoverPreview={false}>
                    {node.label}
                  </GenreLink>
                  {node.wikitext_description && (
                    <small className="block">
                      <WikitextTruncateAtLength
                        wikitext={stripGenreNamePrefixFromDescription(
                          node.label,
                          node.wikitext_description
                        )}
                        length={100}
                      />
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Shared function to filter and sort nodes based on a search string
function getFilteredResults(
  filter: string,
  nodes: any[],
  currentId: string | null
) {
  if (filter.length < 2) {
    return [];
  }

  // Check if current filter matches selected node before showing results
  const currentNode = currentId ? nodes[nodeIdToInt(currentId)] : null;
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
