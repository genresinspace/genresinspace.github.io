import { useState, useCallback } from "react";
import { page_name_to_filename } from "frontend_wasm";
import { Tooltip, useTooltip } from "../Tooltip";
import { WikitextTooltipContent } from "../Tooltip";
import { WikipediaLink } from "../wikipedia/links/WikipediaLink";
import { ArtistData, useDataContext } from "../../../data";

/**
 * A link to an artist with a tooltip showing their description.
 */
export function ArtistLink({
  artistPage,
  hoverPreview = true,
  onMouseEnter: onMouseEnterProp,
  onMouseLeave: onMouseLeaveProp,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & {
  artistPage: string;
  hoverPreview?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { artist_page_to_name } = useDataContext();
  const [artistData, setArtistData] = useState<ArtistData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Derive artist name from page name
  const artistName = artist_page_to_name[artistPage] || artistPage;

  const fetchArtistData = useCallback(async () => {
    if (!artistData && !isLoading) {
      setIsLoading(true);
      try {
        const filename = page_name_to_filename(artistPage);
        const response = await fetch(`/artists/${filename}.json`);
        if (response.ok) {
          const data: ArtistData = await response.json();
          setArtistData(data);
        }
      } catch (error) {
        console.error("Failed to fetch artist data:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [artistPage, artistData, isLoading]);

  const {
    showPreview,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  } = useTooltip({
    hoverPreview,
    onMouseEnter: onMouseEnterProp,
    onMouseLeave: onMouseLeaveProp,
    onDataFetch: fetchArtistData,
  });

  return (
    <>
      <WikipediaLink
        pageTitle={artistPage}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {artistName}
      </WikipediaLink>

      {showPreview && (artistData?.description || isLoading) && (
        <Tooltip
          position={tooltipPosition}
          isOpen={showPreview}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {isLoading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : artistData?.description ? (
            <WikitextTooltipContent
              description={artistData.description}
              last_revision_date={artistData.last_revision_date}
            />
          ) : null}
        </Tooltip>
      )}
    </>
  );
}
