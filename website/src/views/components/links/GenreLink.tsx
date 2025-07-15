import {
  nodeColour,
  NodeColourLightness,
  NodeData,
  useDataContext,
} from "../../../data";
import { Tooltip, useTooltip } from "../Tooltip";
import { WikitextTooltipContent } from "../Tooltip";

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
  });

  const [genreColour, genreColourHover] = [
    NodeColourLightness.LinkText,
    NodeColourLightness.LinkTextHover,
  ].map((lightness) => nodeColour(node, maxDegree, lightness, 30));

  return (
    <>
      <a
        {...props}
        href={`#${node.id}`}
        className={`text-[var(--node-color)] hover:text-[var(--node-color-hover)] ${props.className ?? ""}`}
        style={{
          ["--node-color" as string]: genreColour,
          ["--node-color-hover" as string]: genreColourHover,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        ♪ {props.children}
      </a>

      {node.wikitext_description && showPreview && (
        <Tooltip
          position={tooltipPosition}
          isOpen={showPreview}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <WikitextTooltipContent
            description={node.wikitext_description}
            last_revision_date={node.last_revision_date}
          />
        </Tooltip>
      )}
    </>
  );
}
