import { useMemo } from "react";

import {
  NodeData,
  nodeIdToInt,
  nodePageTitle,
  useDataContext,
} from "../../data";
import { useGenre } from "../../services/dataCache";
import { MatchSpan, SearchResult } from "frontend_wasm";
import { stripGenreNamePrefixFromDescription } from "../../util/stripGenreNamePrefixFromDescription";

import { GenreLink } from "../components/links/GenreLink";
import { WikitextTruncateAtLength } from "../components/wikipedia/wikitexts/WikitextTruncateAtLength";
import { colourStyles } from "../colours";

/** The one truncation length used for genre snippets everywhere in search. */
export const SNIPPET_LENGTH = 100;

/** Render `text` with the matched `spans` (UTF-16 offsets) emboldened. */
export function HighlightedText({
  text,
  spans,
}: {
  text: string;
  spans: MatchSpan[];
}) {
  const parts: React.ReactNode[] = [];
  let position = 0;
  for (const [index, { start, end }] of spans.entries()) {
    if (start > position) {
      parts.push(text.slice(position, start));
    }
    parts.push(
      <strong key={index} className="font-semibold text-[#f4eedd]">
        {text.slice(start, end)}
      </strong>
    );
    position = end;
  }
  if (position < text.length) {
    parts.push(text.slice(position));
  }
  return <>{parts}</>;
}

/** The genre's description, stripped of its name prefix and truncated. */
export function GenreSnippet({ node }: { node: NodeData }) {
  const genreData = useGenre(nodePageTitle(node));
  const strippedDescription = useMemo(() => {
    if (!genreData?.description) return null;
    return stripGenreNamePrefixFromDescription(
      node.label,
      genreData.description
    );
  }, [node.label, genreData]);

  return (
    <small className="block">
      {genreData ? (
        strippedDescription ? (
          <WikitextTruncateAtLength
            wikitext={strippedDescription}
            length={SNIPPET_LENGTH}
          />
        ) : (
          "No description available."
        )
      ) : (
        "Loading..."
      )}
    </small>
  );
}

/** Section label above a list of results or the path. Floats over the graph,
 *  so it gets a faint shadow to hold its own against bright star clusters. */
export function ListLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`text-base font-plate font-semibold uppercase tracking-[0.2em] ${colourStyles.text.brass} px-1 [text-shadow:0_1px_4px_rgba(4,6,15,0.95)]`}
    >
      {children}
    </div>
  );
}

function ResultRow({
  result,
  node,
  highlighted,
  onPick,
  setFocusedId,
}: {
  result: SearchResult;
  node: NodeData;
  highlighted: boolean;
  onPick: (id: string) => void;
  setFocusedId: (id: string | null) => void;
}) {
  return (
    <div
      // Scroll keyboard-highlighted rows into view
      ref={(el) => {
        if (highlighted) el?.scrollIntoView({ block: "nearest" });
      }}
      className={`p-2 ${colourStyles.search.item} border ${colourStyles.border.divider} transition-colors cursor-pointer ${
        highlighted ? `ring-2 ${colourStyles.border.selectedRing}` : ""
      }`}
      onMouseEnter={() => setFocusedId(node.id)}
      onMouseLeave={() => setFocusedId(null)}
      // Keep focus in the search input so the dropdown survives the click
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        // Prevent the GenreLink's href from also triggering hash navigation
        e.preventDefault();
        onPick(node.id);
      }}
    >
      <GenreLink node={node} hoverPreview={false}>
        {result.isAlias ? (
          node.label
        ) : (
          <HighlightedText text={result.matchedText} spans={result.spans} />
        )}
      </GenreLink>
      {result.isAlias && (
        <small className={`block italic ${colourStyles.text.secondary}`}>
          also known as{" "}
          <HighlightedText text={result.matchedText} spans={result.spans} />
        </small>
      )}
      <GenreSnippet node={node} />
    </div>
  );
}

/** Dropdown list of search results for the active slot. */
export function SearchResults({
  results,
  label,
  highlightedIndex,
  onPick,
  setFocusedId,
}: {
  results: SearchResult[];
  label?: string;
  highlightedIndex: number;
  onPick: (id: string) => void;
  setFocusedId: (id: string | null) => void;
}) {
  const { nodes } = useDataContext();
  return (
    <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto mt-2 p-1">
      {label && <ListLabel>{label}</ListLabel>}
      {results.map((result, index) => (
        <ResultRow
          key={result.id}
          result={result}
          node={nodes[nodeIdToInt(result.id)]}
          highlighted={index === highlightedIndex}
          onPick={onPick}
          setFocusedId={setFocusedId}
        />
      ))}
    </div>
  );
}
