import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}

/**
 * Expand icon - a right-pointing chevron
 *
 * Used to indicate expandable content that is currently collapsed.
 * Common use cases: accordions, expandable panels, tree views, nested navigation.
 */
export const ExpandIcon: React.FC<IconProps> = ({
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
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
};
