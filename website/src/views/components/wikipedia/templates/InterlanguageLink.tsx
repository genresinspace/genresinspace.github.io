import { WikitextSimplifiedNode } from "frontend_wasm";
import { Fragment } from "react";
import { ExternalLink } from "../../links/ExternalLink";
import { WikipediaMaybeGenreLink } from "../links/WikipediaMaybeGenreLink";
import { wikiPageUrl, wikiUrl } from "../urls";

/**
 * Renders a link to a Wikipedia article, with an optional link to a foreign-language Wikipedia article.
 * @param node The Wikitext template node.
 * @returns The rendered link.
 */
export function InterlanguageLink({
  node,
}: {
  node: Extract<WikitextSimplifiedNode, { type: "template" }>;
}) {
  const localTitle = node.parameters[0].value;
  const links = [];

  for (let i = 1; i < node.parameters.length; i += 2) {
    const lang = node.parameters[i].value;
    const page = node.parameters[i + 1]?.value ?? localTitle;
    links.push({ lang, page });
  }

  return (
    <>
      <WikipediaMaybeGenreLink pageTitle={localTitle}>
        {localTitle}
      </WikipediaMaybeGenreLink>
      <span className="text-sm">
        {" "}
        [
        {links.map(({ lang, page }, i) => (
          <Fragment key={lang}>
            {i > 0 && "; "}
            <ExternalLink
              href={wikiPageUrl(wikiUrl(`${lang}.wikipedia.org`), page)}
              className="text-gray-500"
            >
              {lang}
            </ExternalLink>
          </Fragment>
        ))}
        ]
      </span>
    </>
  );
}
