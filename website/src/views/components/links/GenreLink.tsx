import {
  nodeColour,
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
  onMouseEnter: onMouseEnterProp,
  onMouseLeave: onMouseLeaveProp,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & {
  node: NodeData;
  hoverPreview?: boolean;
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

  const [genreColour, genreColourHover] = [
    nodeColourLightness.LinkText,
    nodeColourLightness.LinkTextHover,
  ].map((lightness) => nodeColour(node, maxDegree, lightness, 30));

  return (
    <>
      <a
        {...props}
        href={`#${node.id}`}
        className={`${colourStyles.genreLink.text} ${props.className ?? ""}`}
        style={{
          ["--node-color" as string]: genreColour,
          ["--node-color-hover" as string]: genreColourHover,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span className="whitespace-nowrap">
          <NoteIcon
            width={14}
            height={14}
            className="inline-block align-[-0.1em]"
          />{" "}
          {props.children}
        </span>
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
