import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Swap icon - represents a swap action
 *
 * Used to represent swapping or exchanging items.
 * Common use cases: swap buttons, exchange actions, reordering.
 */
export const SwapIcon: React.FC<StrokeIconProps> = ({
  width = 18,
  height = 18,
  className = "",
  stroke = "#9ca3af",
  style = {},
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
    </svg>
  );
};
