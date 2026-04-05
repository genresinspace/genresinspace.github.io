import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { WikitextTruncateAtLength } from "./wikipedia/wikitexts/WikitextTruncateAtLength";
import { colourStyles } from "../colours";

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
  anchorRect: { left: number; bottom: number; width: number };
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}

/** Gap between the anchor element and the tooltip, in pixels. */
const TOOLTIP_GAP = 4;
const TOOLTIP_WIDTH = 250;

/** A tooltip that appears when hovering over a node. */
export function Tooltip({
  anchorRect,
  isOpen,
  onMouseEnter,
  onMouseLeave,
  children,
}: TooltipProps) {
  if (!isOpen) return null;

  // Position at bottom-left of anchor element
  let tooltipX = anchorRect.left;
  const tooltipY = anchorRect.bottom + TOOLTIP_GAP;

  // Keep tooltip on screen horizontally
  const maxX = window.innerWidth - TOOLTIP_WIDTH - 10;
  tooltipX = Math.max(10, Math.min(tooltipX, maxX));

  return createPortal(
    <div
      className={`fixed z-[9999] ${colourStyles.tooltip.background} border ${colourStyles.border.dark} rounded-xl p-4 shadow-md`}
      style={{
        left: `${tooltipX}px`,
        top: `${tooltipY}px`,
        width: `${TOOLTIP_WIDTH}px`,
        maxWidth: `${TOOLTIP_WIDTH}px`,
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
      <small className={`block mt-2 text-xs ${colourStyles.text.meta}`}>
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
  const [anchorRect, setAnchorRect] = useState({
    left: 0,
    bottom: 0,
    width: 0,
  });
  const tooltipHoveredRef = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  // Check if we're already inside a tooltip
  const insideTooltip = useContext(TooltipContext);

  // Detect if the device is a touch device (disable tooltips on mobile)
  const isTouchDevice =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(
    async (e: React.MouseEvent) => {
      // Clear any pending timeout
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }

      // Only show preview if we're not already inside a tooltip and not on a touch device
      if (hoverPreview && !insideTooltip && !isTouchDevice) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setAnchorRect({
          left: rect.left,
          bottom: rect.bottom,
          width: rect.width,
        });
        setShowPreview(true);

        // Fetch data if provided
        if (onDataFetch) {
          await onDataFetch();
        }
      }
      onMouseEnterProp?.();
    },
    [hoverPreview, insideTooltip, isTouchDevice, onDataFetch, onMouseEnterProp]
  );

  const handleMouseLeave = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }

    // Use setTimeout to allow checking if the cursor moved to the tooltip
    timeoutRef.current = setTimeout(() => {
      if (!tooltipHoveredRef.current) {
        setShowPreview(false);
      }
      onMouseLeaveProp?.();
      timeoutRef.current = undefined;
    }, 100) as unknown as number;
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
    anchorRect,
    handleMouseEnter,
    handleMouseLeave,
    handleTooltipMouseEnter,
    handleTooltipMouseLeave,
  };
}
