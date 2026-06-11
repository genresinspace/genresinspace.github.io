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
        {/* Kept small and translucent so rows of inline links stay calm */}
        <WikipediaIcon
          width="0.8em"
          height="0.8em"
          className="inline-block align-[-0.05em] opacity-55"
        />{" "}
        {children}
      </span>
    </ExternalLink>
  );
}
