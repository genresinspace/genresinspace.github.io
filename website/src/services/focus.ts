import { createContext, useContext } from "react";

/**
 * The graph's focus setter, exposed to the whole tree so that hovering a genre
 * link can reveal where that genre sits in the graph. A context rather than
 * props because links are rendered deep inside wikitext, where threading a
 * callback through every node type would be noise.
 */
export const FocusContext = createContext<((id: string | null) => void) | null>(
  null
);

/** The graph focus setter, or null when there is no provider above. */
export function useFocusNode() {
  return useContext(FocusContext);
}
