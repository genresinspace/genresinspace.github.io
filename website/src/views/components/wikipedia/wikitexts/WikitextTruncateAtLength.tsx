import {
  parse_and_simplify_wikitext,
  WikitextSimplifiedNode,
} from "wikitext_simplified";
import {
  isNewlineNode,
  WikitextTruncateAtNewline,
} from "./WikitextTruncateAtNewline";
import { WikitextNodes } from "./WikitextNodes";
import { useState, useMemo } from "react";

/**
 * Like `Wikitext`, but renders up to a character limit before truncating with a `...` suffix.
 */
export function WikitextTruncateAtLength(props: {
  wikitext: string;
  length: number;
  expandable?: boolean;
}) {
  const expandable = props.expandable ?? true;
  const [expanded, setExpanded] = useState(false);

  // Memoize the original nodes to avoid recomputing on every render
  const originalNodes = useMemo(
    () => parse_and_simplify_wikitext(props.wikitext),
    [props.wikitext]
  );

  // Memoize the truncated nodes calculation
  const { nodes, isTruncated } = useMemo(() => {
    const truncatedNodes: WikitextSimplifiedNode[] = [];
    let length = 0;

    for (const node of originalNodes) {
      if (isNewlineNode(node)) {
        break;
      }
      const nodeLength = estimateNodeLength(node);
      if (length + nodeLength > props.length) {
        break;
      }
      truncatedNodes.push(node);
      length += nodeLength;
    }

    const isTruncated = truncatedNodes.length < originalNodes.length;

    // if the node after the truncated node is text, make an attempt to truncate it
    // to produce *some* output
    if (isTruncated) {
      const nextNode = originalNodes[truncatedNodes.length];
      if (nextNode && nextNode.type === "text") {
        truncatedNodes.push({
          type: "text",
          text: nextNode.text.slice(0, props.length - length).trimEnd(),
        });
      }
    }

    return { nodes: truncatedNodes, isTruncated };
  }, [originalNodes, props.length]);

  if (expanded) {
    return (
      <>
        <WikitextTruncateAtNewline
          wikitext={props.wikitext}
          expandable={false}
        />
        <button
          onClick={() => setExpanded(false)}
          className="inline-block ml-1 text-xs text-neutral-400 hover:text-white px-0.5 rounded-sm bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
        >
          Show less
        </button>
      </>
    );
  }

  return (
    <>
      <WikitextNodes nodes={nodes} />
      {isTruncated && (
        <>
          {expandable ? (
            <span
              onClick={() => setExpanded(true)}
              className="inline-block text-blue-400 hover:text-blue-300 cursor-pointer transition-colors"
              title="Show more"
            >
              ...
            </span>
          ) : (
            <span>...</span>
          )}
        </>
      )}
    </>
  );
}

function estimateNodeLength(node: WikitextSimplifiedNode): number {
  switch (node.type) {
    case "template":
      // this is so bad
      return (
        node.children.map((p) => p.value.length).reduce((a, b) => a + b, 0) /
        Math.max(node.children.length, 1)
      );
    case "link":
      return node.text.length;
    case "ext-link":
      return (node.text ?? node.link).length;
    case "fragment":
    case "bold":
    case "italic":
    case "blockquote":
    case "superscript":
    case "subscript":
    case "small":
    case "preformatted":
      return node.children.map(estimateNodeLength).reduce((a, b) => a + b, 0);
    case "text":
      return node.text.length;
    default:
      return 0;
  }
}
