import {
  nodeColourReadable,
  useNodeColourLightness,
  NodeData,
  nodePageTitle,
  useDataContext,
} from "../../../data";
import { colourStyles } from "../../colours";
import { useGenre } from "../../../services/dataCache";
import { Tooltip, useTooltip } from "../Tooltip";
import { WikitextTooltipContent } from "../Tooltip";
import { NoteIcon } from "../icons";

/**
 * A link to a genre.
 *
 * Will navigate to the genre in the graph.
 */
export function GenreLink({
  node,
  hoverPreview = true,
  noIcon = false,
  onMouseEnter: onMouseEnterProp,
  onMouseLeave: onMouseLeaveProp,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & {
  node: NodeData;
  hoverPreview?: boolean;
  /** Skip the built-in NoteIcon (e.g. when the icon is supplied by the surrounding component). */
  noIcon?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const { max_degree: maxDegree } = useDataContext();
  const genreData = useGenre(nodePageTitle(node));
  const nodeColourLightness = useNodeColourLightness();

  const {
    showPreview,
    anchorRect,
    handleMouseEnter,
    handleMouseLeave,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  } = useTooltip({
    hoverPreview,
    onMouseEnter: onMouseEnterProp,
    onMouseLeave: onMouseLeaveProp,
  });

  // Readable variants: hue is preserved but lightness is lifted until the
  // link clears a minimum contrast against the navy sidebar plates, so dark
  // blues/violets don't sink into the background.
  const [genreColour, genreColourHover] = [
    [nodeColourLightness.LinkText, 6] as const,
    [nodeColourLightness.LinkTextHover, 7.5] as const,
  ].map(([lightness, minContrast]) =>
    nodeColourReadable(node, maxDegree, lightness, 30, minContrast)
  );

  return (
    <>
      <a
        {...props}
        href={`#${node.id}`}
        className={`${colourStyles.genreLink.text} ${props.className ?? ""}`}
        style={{
          ["--node-color" as string]: genreColour,
          ["--node-color-hover" as string]: genreColourHover,
          ...(props.style ?? {}),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {noIcon ? (
          props.children
        ) : (
          <span className="whitespace-nowrap">
            {/* Small and translucent: a quiet wayfinding mark, not a glyph
                competing with the link text itself. */}
            <NoteIcon
              width={11}
              height={11}
              className="inline-block align-[-0.05em] opacity-55"
            />{" "}
            {props.children}
          </span>
        )}
      </a>

      {genreData?.description && showPreview && (
        <Tooltip
          anchorRect={anchorRect}
          isOpen={showPreview}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <WikitextTooltipContent
            description={genreData.description}
            last_revision_date={genreData.last_revision_date}
          />
        </Tooltip>
      )}
    </>
  );
}
