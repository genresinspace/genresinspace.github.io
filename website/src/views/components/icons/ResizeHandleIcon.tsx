import React from "react";
import { FillIconProps } from "./IconProps";

/**
 * Resize Handle icon - vertical drag handle
 *
 * Used to indicate a resizable area that can be dragged.
 * Common use cases: resizable panels, sidebars, or columns.
 */
export const ResizeHandleIcon: React.FC<FillIconProps> = ({
  width = 18,
  height = 18,
  className = "",
  fill = "currentColor",
  style = {},
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 8 16"
      fill={fill}
      className={className}
      style={style}
    >
      <path d="M2 0h1v16H2V0zM5 0h1v16H5V0z" />
    </svg>
  );
};
