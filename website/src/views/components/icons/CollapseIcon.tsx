import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}

/**
 * Collapse icon - a downward-pointing chevron
 *
 * Used to indicate collapsible content that is currently expanded.
 * Common use cases: accordions, expandable panels, dropdown menus that are currently open.
 */
export const CollapseIcon: React.FC<IconProps> = ({
  width = 16,
  height = 16,
  className = "",
  stroke = "currentColor",
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
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
};
