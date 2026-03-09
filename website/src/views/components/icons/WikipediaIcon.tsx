import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Wikipedia icon - a circled W
 *
 * Used as a prefix for Wikipedia links.
 */
export const WikipediaIcon: React.FC<StrokeIconProps> = ({
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
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 8l2.5 8L12 11l2.5 5L17 8"
      />
    </svg>
  );
};
