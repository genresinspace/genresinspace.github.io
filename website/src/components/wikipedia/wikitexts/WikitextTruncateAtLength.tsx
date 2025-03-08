import {
  parse_and_simplify_wikitext,
  WikitextSimplifiedNode,
} from "wikitext_simplified";
import { isNewlineNode } from "./WikitextTruncateAtNewline";
import { WikitextNodes } from "./WikitextNodes";

/**
 * Like `Wikitext`, but renders up to a character limit before truncating with a `...` suffix.
 */
export function WikitextTruncateAtLength(props: {
  wikitext: string;
  length: number;
}) {
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

  const originalNodes = parse_and_simplify_wikitext(props.wikitext);

  let nodes: WikitextSimplifiedNode[] = [];
  let length = 0;
  for (const node of originalNodes) {
    if (isNewlineNode(node)) {
      break;
    }
    const nodeLength = estimateNodeLength(node);
    if (length + nodeLength > props.length) {
      break;
    }
    nodes.push(node);
    length += nodeLength;
  }

  if (nodes.length < originalNodes.length) {
    // if the node after the truncated node is text, make an attempt to truncate it
    // to produce *some* output
    const nextNode = originalNodes[nodes.length];
    if (nextNode.type === "text") {
      nodes.push({
        type: "text",
        text: nextNode.text.slice(0, props.length - length),
      });
    }

    nodes.push({ type: "text", text: "..." });
  }

  return <WikitextNodes nodes={nodes} />;
}
