import { useMemo } from "react";

import { nodeIdToInt, useDataContext } from "../data";
import { stripGenreNamePrefixFromDescription } from "../util";

import { GenreLink } from "./components/links/GenreLink";
import { WikitextTruncateAtLength } from "./components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { SearchIcon } from "./components/icons/SearchIcon";

/** Search dropdown that searches over genres and shows results */
export function Search({
  selectedId,
  setFocusedId,
  filter,
  setFilter,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  filter: string;
  setFilter: (filter: string) => void;
}) {
  const { nodes } = useDataContext();

  const results = useMemo(() => {
    if (filter.length < 2) {
      return [];
    }

    // Check if current filter matches selected node before showing results
    const selectedNode = selectedId ? nodes[nodeIdToInt(selectedId)] : null;
    if (selectedNode?.label.toLowerCase() === filter.toLowerCase()) {
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
  }, [filter, nodes, selectedId]);

  return (
    <div>
      <div className="relative mb-2">
        <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
          <SearchIcon width={16} height={16} stroke="#9ca3af" />
        </div>
        <input
          type="text"
          placeholder="Search for genre..."
          className="w-full p-2 pl-8 bg-neutral-800 rounded-md"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {results.map(({ node, strippedDescription }) => (
          <div
            key={node.id}
            className="p-2 bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors"
            onMouseEnter={() => setFocusedId(node.id)}
            onMouseLeave={() => setFocusedId(null)}
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
        ))}
      </div>
    </div>
  );
}
