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
 * Component that disables tooltips for all child components.
 * Useful for preventing recursive tooltips or simplifying UI in certain areas.
 */
export function DisableTooltips({ children }: { children: React.ReactNode }) {
  return (
    <TooltipContext.Provider value={true}>{children}</TooltipContext.Provider>
  );
}

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
    onMouseEnterProp?.();
  };

  const handleMouseLeave = () => {
    // Use setTimeout to allow checking if the cursor moved to the tooltip
    setTimeout(() => {
      if (!tooltipHoveredRef.current) {
        setShowPreview(false);
      }
      onMouseLeaveProp?.();
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
          <DisableTooltips>
            <WikitextTruncateAtLength
              wikitext={node.wikitext_description}
              length={100}
            />
            <small className="block mt-2 text-xs text-gray-500 dark:text-gray-400">
              Last updated: {new Date(node.last_revision_date).toLocaleString()}
            </small>
          </DisableTooltips>
        </Tooltip>
      )}
    </>
  );
}
