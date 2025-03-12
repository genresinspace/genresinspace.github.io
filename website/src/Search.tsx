import { useMemo } from "react";

import { NodeData } from "./Data";

import { GenreLink } from "./components/links/GenreLink";
import { WikitextTruncateAtLength } from "./components/wikipedia/wikitexts/WikitextTruncateAtLength";

export function Search({
  selectedId,
  setFocusedId,
  nodes,
  filter,
  setFilter,
}: {
  selectedId: string | null;
  setFocusedId: (id: string | null) => void;
  nodes: NodeData[];
  filter: string;
  setFilter: (filter: string) => void;
}) {
  const results = useMemo(() => {
    if (filter.length < 2) {
      return [];
    }

    // Check if current filter matches selected node before showing results
    const selectedNode = selectedId ? nodes[parseInt(selectedId, 10)] : null;
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
      });
  }, [filter, nodes, selectedId]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search for genre..."
        className="w-full p-2 bg-neutral-800 rounded-md mb-2"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {results.map((node) => (
          <div
            key={node.id}
            className="p-2 bg-neutral-900 rounded-lg hover:bg-neutral-700 transition-colors"
            onMouseEnter={() => setFocusedId(node.id)}
            onMouseLeave={() => setFocusedId(null)}
          >
            <GenreLink genreId={node.id} pageTitle={node.page_title}>
              {node.label}
            </GenreLink>
            <small className="block">
              <WikitextTruncateAtLength
                wikitext={node.wikitext_description ?? ""}
                length={100}
              />
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}
