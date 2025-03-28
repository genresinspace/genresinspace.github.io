import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  style?: React.CSSProperties;
}

/**
 * Fusion Genre icon - document copy
 *
 * Used to represent fusion relationships between genres.
 */
export const FusionGenreIcon: React.FC<IconProps> = ({
  width = 16,
  height = 16,
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
        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
      />
    </svg>
  );
};
