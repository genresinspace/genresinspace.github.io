import { WikitextSimplifiedNode } from "frontend_wasm";

/**
 * Renders the langnf template.
 */
export function Langnf({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const langCode = node.children[0].value;
  const originalText = node.children[1].value;
  const translatedText = node.children[2].value;
  const langName = node.children.find((c) => c.name === "lang-name")?.value;
  return (
    <span>
      {originalText} ({langCode || langName} for '{translatedText}')
    </span>
  );
}
