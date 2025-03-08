import { ExternalLink } from "../../links/ExternalLink";
import { useWikiUrl, wikiPageUrl } from "../urls";

/**
 * A link to a Wikipedia page.
 */
export function WikipediaLink({
  pageTitle,
  ...rest
}: React.ComponentProps<"a"> & { pageTitle: string }) {
  const wikiUrl = useWikiUrl();
  if (!wikiUrl) {
    return null;
  }

  return <ExternalLink {...rest} href={wikiPageUrl(wikiUrl, pageTitle)} />;
}
