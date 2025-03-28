import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  fill?: string;
}

/**
 * Resize Handle icon - vertical drag handle
 *
 * Used to indicate a resizable area that can be dragged.
 * Common use cases: resizable panels, sidebars, or columns.
 */
export const ResizeHandleIcon: React.FC<IconProps> = ({
  width = 8,
  height = 16,
  className = "",
  fill = "currentColor",
}) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 8 16"
      fill={fill}
      className={className}
    >
      <path d="M2 0h1v16H2V0zM5 0h1v16H5V0z" />
    </svg>
  );
};
