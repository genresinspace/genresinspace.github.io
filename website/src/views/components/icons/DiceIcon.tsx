import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Dice icon - a game die
 *
 * Used for random/shuffle actions.
 */
export const DiceIcon: React.FC<StrokeIconProps> = ({
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
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="8.5" r="1" fill={stroke} stroke="none" />
      <circle cx="15.5" cy="8.5" r="1" fill={stroke} stroke="none" />
      <circle cx="8.5" cy="15.5" r="1" fill={stroke} stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill={stroke} stroke="none" />
      <circle cx="12" cy="12" r="1" fill={stroke} stroke="none" />
    </svg>
  );
};
