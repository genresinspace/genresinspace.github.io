import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  style?: React.CSSProperties;
}

/**
 * Subgenre icon - document
 *
 * Used to represent subgenre relationships between genres.
 */
export const SubgenreIcon: React.FC<IconProps> = ({
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
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
};
