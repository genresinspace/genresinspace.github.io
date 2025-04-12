import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Information icon - a circle with the letter "i"
 *
 * Used to indicate additional information or help content.
 * Common use cases: informational sections, tooltips, help buttons.
 */
export const InfoIcon: React.FC<StrokeIconProps> = ({
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
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
};
