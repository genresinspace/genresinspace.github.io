/**
 * Genre search service: a thin wrapper around the WASM `GenreSearcher`.
 *
 * The searcher is built once per node array and cached by identity; every
 * query is ranked in Rust with the (overridable) weights below.
 */
import { GenreSearcher, SearchParams, SearchResult } from "frontend_wasm";

import { NodeData } from "../data";

/** Re-exported WASM searcher types (ranking weights, search hits). */
export type { SearchParams, SearchResult };

/**
 * Ranking weight overrides. Empty by default — the Rust defaults apply; tweak
 * here (or via `window.__searchParams` in dev) to tune ranking without
 * recompiling the WASM module.
 */
export const DEFAULT_SEARCH_PARAMS: SearchParams = {};

/** Cache of the searcher, keyed by the nodes array identity. */
let searcherCache: { nodes: NodeData[]; searcher: GenreSearcher } | null = null;

function getSearcher(nodes: NodeData[]): GenreSearcher {
  if (searcherCache && searcherCache.nodes === nodes) {
    return searcherCache.searcher;
  }
  searcherCache?.searcher.free();
  const searcher = new GenreSearcher(
    nodes.map((node) => ({
      label: node.label,
      aliases: node.aliases ?? [],
      links: node.links ?? 0,
    }))
  );
  searcherCache = { nodes, searcher };
  return searcher;
}

/** Search genres by name/alias, ranked by match quality and popularity. */
export function searchGenres(
  nodes: NodeData[],
  query: string,
  params: SearchParams = DEFAULT_SEARCH_PARAMS
): SearchResult[] {
  if (nodes.length === 0) return [];
  const devOverrides = import.meta.env.DEV
    ? (window as { __searchParams?: SearchParams }).__searchParams
    : undefined;
  return getSearcher(nodes).search(query, { ...params, ...devOverrides });
}
