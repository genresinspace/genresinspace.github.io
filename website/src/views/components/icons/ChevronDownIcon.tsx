import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Chevron Down icon - a downward-pointing chevron (^)
 *
 * Used to indicate expandable content or dropdown menus.
 * Common use cases: dropdown menus, expandable sections, accordion components, "show more" buttons.
 */
export const ChevronDownIcon: React.FC<StrokeIconProps> = ({
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
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
};
