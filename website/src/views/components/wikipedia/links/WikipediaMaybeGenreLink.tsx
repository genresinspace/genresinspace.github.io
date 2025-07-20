import { WikipediaLink } from "./WikipediaLink";
import { GenreLink } from "../../links/GenreLink";
import { useDataContext } from "../../../../data";
import { useLinksToPageIds } from "../../../../services/dataCache";

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
  const { nodes } = useDataContext();
  const linksToPageIds = useLinksToPageIds();

  const nodeId = linksToPageIds
    ? linksToPageIds[pageTitle.toLowerCase()]
    : null;
  const node = nodeId ? nodes[nodeId] : null;

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
