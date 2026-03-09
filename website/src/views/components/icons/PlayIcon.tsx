import React from "react";
import { FillIconProps } from "./IconProps";

/**
 * Play icon - a right-pointing triangle
 *
 * Used for play buttons in audio players.
 */
export const PlayIcon: React.FC<FillIconProps> = ({
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
      <path d="M8 5v14l11-7z" />
    </svg>
  );
};
