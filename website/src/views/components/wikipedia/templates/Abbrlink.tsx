import { WikitextSimplifiedNode } from "frontend_wasm";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";

/**
 * Renders the abbrlink template.
 */
export function Abbrlink({
  node,
  templateName,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
  templateName: string;
}) {
  const abbr = node.children[0].value;
  const phrase = node.children[1]?.value;
  const jsx = <abbr title={phrase}>{abbr}</abbr>;
  if (templateName === "abbrlink") {
    return (
      <WikipediaMaybeGenreLink pageTitle={phrase}>
        {jsx}
      </WikipediaMaybeGenreLink>
    );
  }
  return jsx;
}
