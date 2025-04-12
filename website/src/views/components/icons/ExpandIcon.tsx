import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Expand icon - a right-pointing chevron
 *
 * Used to indicate expandable content that is currently collapsed.
 * Common use cases: accordions, expandable panels, tree views, nested navigation.
 */
export const ExpandIcon: React.FC<StrokeIconProps> = ({
  width = 18,
  height = 18,
  className = "",
  stroke = "currentColor",
  style = {},
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      fill="none"
      viewBox="0 0 24 24"
      stroke={stroke}
      className={className}
      style={style}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
};
