import { ExternalLink } from "../../links/ExternalLink";
import { useWikiUrl, wikiPageUrl } from "../urls";
import { WikipediaIcon } from "../../icons";

/**
 * A link to a Wikipedia page.
 */
export function WikipediaLink({
  pageTitle,
  children,
  ...rest
}: React.ComponentProps<typeof ExternalLink> & { pageTitle: string }) {
  const wikiUrl = useWikiUrl();
  if (!wikiUrl) {
    return null;
  }

  return (
    <ExternalLink {...rest} href={wikiPageUrl(wikiUrl, pageTitle)}>
      <span className="whitespace-nowrap">
        <WikipediaIcon
          width={14}
          height={14}
          className="inline-block align-[-0.1em]"
        />{" "}
        {children}
      </span>
    </ExternalLink>
  );
}
