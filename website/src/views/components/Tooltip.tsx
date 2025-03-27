import React from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  position: { x: number; y: number };
  isOpen: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}

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
  const tooltipWidth = 400;
  const tooltipHeight = 100; // Approximate height, can be adjusted
  const maxX = window.innerWidth - tooltipWidth - 10;
  const maxY = window.innerHeight - tooltipHeight - 10;

  // Adjust position if needed to keep tooltip on screen
  const adjustedX = Math.min(tooltipX, maxX);
  const adjustedY = Math.min(tooltipY, maxY);

  return createPortal(
    <div
      className="fixed z-[9999] bg-gray-800 text-white rounded p-3 shadow-lg"
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
