import { useEffect, useState } from "react";
import {
  parse_and_simplify_wikitext,
  WikitextSimplifiedNode,
} from "wikitext_simplified";
import { WikitextNodes } from "./WikitextNodes";

/**
 * Determines whether this node can be used to break a short description.
 */
export function isNewlineNode(node: WikitextSimplifiedNode): boolean {
  return node.type === "paragraph-break" || node.type === "newline";
}

/**
 * Like `Wikitext`, but only renders up to the first paragraph break or newline.
 */
export function WikitextTruncateAtNewline(props: {
  wikitext: string;
  expandable: boolean;
  className?: string;
}) {
  const nodes = parse_and_simplify_wikitext(props.wikitext);
  const index = nodes.findIndex(isNewlineNode);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [props.wikitext]);

  return props.expandable ? (
    <div className={`flex flex-col gap-2 ${props.className || ""}`}>
      <div>
        <WikitextNodes
          nodes={index !== -1 && !expanded ? nodes.slice(0, index) : nodes}
        />
      </div>
      {index !== -1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-2 text-sm text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md mx-auto block transition-colors"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  ) : (
    <WikitextNodes nodes={index !== -1 ? nodes.slice(0, index) : nodes} />
  );
}
