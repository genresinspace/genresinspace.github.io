import { WikipediaLink } from "./WikipediaLink";
import { GenreLink } from "../../links/GenreLink";
import { nodeIdToInt, useDataContext } from "../../../../data";

/**
 * A link to a Wikipedia page, or a genre link if the page title is a genre.
 */
export function WikipediaMaybeGenreLink({
  pageTitle,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: React.ComponentProps<typeof WikipediaLink> & {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { links_to_page_ids: linksToPageId, nodes } = useDataContext();
  const nodeId = nodeIdToInt(linksToPageId[pageTitle.toLowerCase()]);
  const node = nodes[nodeId];
  if (node) {
    return (
      <GenreLink
        node={node}
        {...rest}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
    );
  } else {
    return (
      <WikipediaLink
        {...rest}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        pageTitle={pageTitle}
      />
    );
  }
}
