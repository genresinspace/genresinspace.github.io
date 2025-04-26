import { WikitextSimplifiedNode } from "frontend_wasm";
import { templateToObject } from "./util";

/**
 * Renders the langnf template.
 */
export function Langnf({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);
  const langCode = params["1"];
  const originalText = params["2"];
  const translatedText = params["3"];
  const langName = params["lang-name"];
  return (
    <span>
      {originalText} ({langCode || langName} for '{translatedText}')
    </span>
  );
}
