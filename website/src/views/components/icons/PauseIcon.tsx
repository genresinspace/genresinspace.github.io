import React from "react";
import { FillIconProps } from "./IconProps";

/**
 * Pause icon - two vertical bars
 *
 * Used for pause buttons in audio players.
 */
export const PauseIcon: React.FC<FillIconProps> = ({
  width = 18,
  height = 18,
  className = "",
  fill = "currentColor",
  style = {},
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={fill}
      className={className}
      style={style}
    >
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
};
