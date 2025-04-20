import { WikitextSimplifiedNode } from "frontend_wasm";
import { Wikitext } from "../wikitexts/Wikitext";

/**
 * Renders the mongolunicode template.
 */
export function Mongolunicode({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const text = node.children.find((p) => p.name === "1");
  if (!text) return null;

  const direction =
    node.children.find((p) => p.name === "2")?.value === "h"
      ? "horizontal-tb"
      : "vertical-rl";
  // We don't currently do anything to handle fonts, but we could in the future
  // const lang = node.children.find((p) => p.name === "lang")?.value || "mn";
  const style = node.children.find((p) => p.name === "style")?.value || "";
  const fontSize = node.children.find((p) => p.name === "font-size")?.value;
  const lineHeight = node.children.find((p) => p.name === "line-height")?.value;
  const display = node.children.find((p) => p.name === "display")?.value;

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
      <Wikitext wikitext={text.value} />
    </span>
  );
}
