import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}

/**
 * Chevron Right icon - a right-pointing chevron (>)
 *
 * Used to indicate forward navigation or expandable content.
 * Common use cases: navigation buttons, expandable sections, breadcrumbs, menu items.
 */
export const ChevronRightIcon: React.FC<IconProps> = ({
  width = 18,
  height = 18,
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
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
};
