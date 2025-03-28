import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}

/**
 * Search icon - a magnifying glass
 *
 * Used to represent search functionality.
 * Common use cases: search bars, search buttons, find features, zoom functionality.
 */
export const SearchIcon: React.FC<IconProps> = ({
  width = 14,
  height = 14,
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
};
