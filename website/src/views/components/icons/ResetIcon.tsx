import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Reset icon - a counter-clockwise circular arrow
 *
 * Used for "reset to default" buttons.
 */
export const ResetIcon: React.FC<StrokeIconProps> = ({
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
        d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10"
      />
    </svg>
  );
};
