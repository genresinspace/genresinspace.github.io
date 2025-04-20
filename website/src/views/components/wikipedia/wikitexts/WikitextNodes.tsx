import { JSX } from "react";
import { WikitextSimplifiedNode } from "frontend_wasm";
import { WikitextNode } from "./WikitextNode";

/**
 * Renders a list of Wikitext nodes.
 */
export function WikitextNodes({
  nodes,
}: {
  nodes: WikitextSimplifiedNode[];
}): JSX.Element {
  return (
    <>
      {nodes.map((node, i) => (
        <WikitextNode key={i} node={node} />
      ))}
    </>
  );
}
