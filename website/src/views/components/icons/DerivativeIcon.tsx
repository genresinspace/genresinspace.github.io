import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  style?: React.CSSProperties;
}

/**
 * Derivative icon - double chevron
 *
 * Used to represent derivative relationships between genres.
 */
export const DerivativeIcon: React.FC<IconProps> = ({
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
        d="M13 5l7 7-7 7M5 5l7 7-7 7"
      />
    </svg>
  );
};
