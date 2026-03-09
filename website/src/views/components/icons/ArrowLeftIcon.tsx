import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Arrow Left icon - a leftward-pointing arrow
 *
 * Used for navigation and directional indicators.
 */
export const ArrowLeftIcon: React.FC<StrokeIconProps> = ({
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
        d="M19 12H5m0 0l7 7m-7-7l7-7"
      />
    </svg>
  );
};
