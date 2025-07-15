import React from "react";
import { createPortal } from "react-dom";
import {
  useState,
  useRef,
  useContext,
  useCallback,
  createContext,
} from "react";
import { WikitextTruncateAtLength } from "./wikipedia/wikitexts/WikitextTruncateAtLength";

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

interface TooltipProps {
  position: { x: number; y: number };
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}

/** A tooltip that appears when hovering over a node. */
export function Tooltip({
  position,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  children,
}: TooltipProps) {
  if (!isOpen) return null;

  // Position tooltip slightly offset from initial mouse position
  const xOffset = 10;
  const yOffset = 10;
  const tooltipX = position.x + xOffset;
  const tooltipY = position.y + yOffset;

  // Calculate max coordinates to prevent tooltip from going off-screen
  const tooltipWidth = 250;
  const tooltipHeight = 200; // Approximate height, can be adjusted
  const maxX = window.innerWidth - tooltipWidth - 10;
  const maxY = window.innerHeight - tooltipHeight - 10;

  // Adjust position if needed to keep tooltip on screen
  const adjustedX = Math.min(tooltipX, maxX);
  const adjustedY = Math.min(tooltipY, maxY);

  return createPortal(
    <div
      className="fixed z-[9999] bg-neutral-950 border border-neutral-800 text-white rounded p-3 shadow-lg"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        width: `${tooltipWidth}px`,
        maxWidth: `${tooltipWidth}px`,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body
  );
}

/**
 * A standardized tooltip component for displaying wikitext descriptions.
 * Used by both ArtistLink and GenreLink components.
 */
export function WikitextTooltipContent({
  description,
  last_revision_date,
  length = 150,
}: {
  description: string;
  last_revision_date: string;
  length?: number;
}) {
  return (
    <DisableTooltips>
      <WikitextTruncateAtLength wikitext={description} length={length} />
      <small className="block mt-2 text-xs text-gray-500 dark:text-gray-400">
        Last updated: {new Date(last_revision_date).toLocaleString()}
      </small>
    </DisableTooltips>
  );
}

/**
 * Hook to manage tooltip state and behavior.
 *
 * @param hoverPreview - Whether to show tooltip on hover
 * @param onMouseEnter - Optional callback for mouse enter
 * @param onMouseLeave - Optional callback for mouse leave
 * @param onDataFetch - Optional async function to fetch data on hover
 * @returns Tooltip state and handlers
 */
export function useTooltip({
  hoverPreview = true,
  onMouseEnter: onMouseEnterProp,
  onMouseLeave: onMouseLeaveProp,
  onDataFetch,
}: {
  hoverPreview?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onDataFetch?: () => Promise<void>;
} = {}) {
  const [showPreview, setShowPreview] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipHoveredRef = useRef(false);

  // Check if we're already inside a tooltip
  const insideTooltip = useContext(TooltipContext);

  const handleMouseEnter = useCallback(
    async (e: React.MouseEvent) => {
      // Only show preview if we're not already inside a tooltip
      if (hoverPreview && !insideTooltip) {
        setTooltipPosition({ x: e.clientX, y: e.clientY });
        setShowPreview(true);

        // Fetch data if provided
        if (onDataFetch) {
          await onDataFetch();
        }
      }
      onMouseEnterProp?.();
    },
    [hoverPreview, insideTooltip, onDataFetch, onMouseEnterProp]
  );

  const handleMouseLeave = useCallback(() => {
    // Use setTimeout to allow checking if the cursor moved to the tooltip
    setTimeout(() => {
      if (!tooltipHoveredRef.current) {
        setShowPreview(false);
      }
      onMouseLeaveProp?.();
    }, 100);
  }, [onMouseLeaveProp]);

  const handleTooltipMouseEnter = useCallback(() => {
    tooltipHoveredRef.current = true;
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    tooltipHoveredRef.current = false;
    setShowPreview(false);
  }, []);

  return {
    showPreview,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  };
}
