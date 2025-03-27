import {
  nodeColour,
  NodeColourLightness,
  NodeData,
  useDataContext,
} from "../../../data";
import { useState, useRef } from "react";
import { Tooltip } from "../../components/Tooltip";
import { WikitextTruncateAtLength } from "../wikipedia/wikitexts/WikitextTruncateAtLength";

/**
 * A link to a genre.
 *
 * Will navigate to the genre in the graph.
 */
export function GenreLink({
  node,
  hoverPreview = true,
  ...props
}: Omit<React.ComponentProps<"a">, "href"> & {
  node: NodeData;
  hoverPreview?: boolean;
}) {
  const { max_degree: maxDegree } = useDataContext();
  const [showPreview, setShowPreview] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipHoveredRef = useRef(false);

  const [genreColour, genreColourHover] = [
    NodeColourLightness.LinkText,
    NodeColourLightness.LinkTextHover,
  ].map((lightness) => nodeColour(node, maxDegree, lightness, 30));

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (hoverPreview) {
      // Set the tooltip position only when first entering the link
      setTooltipPosition({ x: e.clientX, y: e.clientY });
      setShowPreview(true);
    }
  };

  const handleMouseLeave = () => {
    // Use setTimeout to allow checking if the cursor moved to the tooltip
    setTimeout(() => {
      if (!tooltipHoveredRef.current) {
        setShowPreview(false);
      }
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    tooltipHoveredRef.current = true;
  };

  const handleTooltipMouseLeave = () => {
    tooltipHoveredRef.current = false;
    setShowPreview(false);
  };

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

      {node.wikitext_description && (
        <Tooltip
          position={tooltipPosition}
          isOpen={showPreview}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          <WikitextTruncateAtLength
            wikitext={node.wikitext_description}
            length={100}
          />
        </Tooltip>
      )}
    </>
  );
}
