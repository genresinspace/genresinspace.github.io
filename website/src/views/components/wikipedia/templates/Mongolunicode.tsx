import { WikitextSimplifiedNode } from "frontend_wasm";
import { Wikitext } from "../wikitexts/Wikitext";
import { templateToObject } from "./util";

/**
 * Renders the mongolunicode template.
 */
export function Mongolunicode({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);

  const text = params["1"];
  if (!text) return null;

  const direction = params["2"] === "h" ? "horizontal-tb" : "vertical-rl";
  // We don't currently do anything to handle fonts, but we could in the future
  // const lang = params["lang"] || "mn";
  const style = params["style"] || "";
  const fontSize = params["font-size"];
  const lineHeight = params["line-height"];
  const display = params["display"];

  return (
    <span
      style={{
        writingMode: direction,
        ...(fontSize && { fontSize }),
        ...(lineHeight && { lineHeight }),
        ...(display && { display }),
        ...(style && { style }),
      }}
    >
      <Wikitext wikitext={text} />
    </span>
  );
}
