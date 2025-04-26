import { WikitextSimplifiedNode } from "frontend_wasm";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { templateToObject } from "./util";

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
  const params = templateToObject(node);
  const abbr = params["1"];
  const phrase = params["2"];
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
