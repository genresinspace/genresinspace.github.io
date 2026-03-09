import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Arrow Right icon - a rightward-pointing arrow
 *
 * Used for navigation and directional indicators.
 */
export const ArrowRightIcon: React.FC<StrokeIconProps> = ({
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
        d="M5 12h14m0 0l-7-7m7 7l-7 7"
      />
    </svg>
  );
};
