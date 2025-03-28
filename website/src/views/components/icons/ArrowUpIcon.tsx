import React from "react";

interface IconProps {
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}

/**
 * Arrow Up icon - an upward-pointing arrow
 *
 * Used to represent upward movement, increasing values, or navigation.
 * Common use cases: scroll to top buttons, upload actions, sorting indicators, connections.
 */
export const ArrowUpIcon: React.FC<IconProps> = ({
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
        d="M7 11l5-5m0 0l5 5m-5-5v12"
      />
    </svg>
  );
};
