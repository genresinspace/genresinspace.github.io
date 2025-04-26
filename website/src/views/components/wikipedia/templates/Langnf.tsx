import { WikitextSimplifiedNode } from "frontend_wasm";

/**
 * Renders the langnf template.
 */
export function Langnf({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const langCode = node.parameters[0].value;
  const originalText = node.parameters[1].value;
  const translatedText = node.parameters[2].value;
  const langName = node.parameters.find((c) => c.name === "lang-name")?.value;
  return (
    <span>
      {originalText} ({langCode || langName} for '{translatedText}')
    </span>
  );
}
