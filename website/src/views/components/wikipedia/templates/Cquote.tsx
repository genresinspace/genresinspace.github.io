import { WikitextSimplifiedNode } from "frontend_wasm";
import { Blockquote } from "../../Blockquote";
import { templateToObject } from "./util";

/**
 * Renders the cquote template.
 */
export function Cquote({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);
  const text = params.text || params["1"];
  if (!text) {
    return null;
  }

  const author = params.author || params["2"];
  const title = params.title || params["3"];
  const source = params.source || params["4"];
  const citation = [author, title, source]
    .filter((s) => s !== undefined)
    .join(" ");

  return (
    <figure>
      <Blockquote>{text}</Blockquote>
      {citation && <figcaption>{citation}</figcaption>}
    </figure>
  );
}
