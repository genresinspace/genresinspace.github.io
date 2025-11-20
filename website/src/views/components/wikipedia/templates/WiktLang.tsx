import { WikitextSimplifiedNode } from "frontend_wasm";
import { ExternalLink } from "../../links/ExternalLink";
import { templateToObject } from "./util";

/**
 * Renders a link to a Wiktionary entry.
 * {{Wikt-lang|lang|entry|display}}
 */
export function WiktLang({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const params = templateToObject(node);
  const lang = params["1"];
  const entry = params["2"];
  const display = params["3"] || entry;

  if (!lang || !entry) {
    return null;
  }

  const href = `https://en.wiktionary.org/wiki/${entry}#${lang}`;

  return <ExternalLink href={href}>{display}</ExternalLink>;
}
