import {
  nodeColour,
  NodeColourLightness,
  NodeData,
  useDataContext,
} from "../../../data";
import { useState, useRef, createContext, useContext } from "react";
import { Tooltip } from "../../components/Tooltip";
import { WikitextTruncateAtLength } from "../wikipedia/wikitexts/WikitextTruncateAtLength";

/** A context to track tooltip nesting. */
export const TooltipContext = createContext(false);

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

  // Check if we're already inside a tooltip
  const insideTooltip = useContext(TooltipContext);

  const [genreColour, genreColourHover] = [
    NodeColourLightness.LinkText,
    NodeColourLightness.LinkTextHover,
  ].map((lightness) => nodeColour(node, maxDegree, lightness, 30));

  const handleMouseEnter = (e: React.MouseEvent) => {
    // Only show preview if we're not already inside a tooltip
    if (hoverPreview && !insideTooltip) {
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

      {node.wikitext_description && showPreview && (
        <Tooltip
          position={tooltipPosition}
          isOpen={showPreview}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {/* Provide context value for nested GenreLinks */}
          <TooltipContext.Provider value={true}>
            <WikitextTruncateAtLength
              wikitext={node.wikitext_description}
              length={100}
            />
          </TooltipContext.Provider>
        </Tooltip>
      )}
    </>
  );
}
