import React from "react";
import { StrokeIconProps } from "./IconProps";

/**
 * Close icon - an X symbol
 *
 * Used to represent close, cancel, or dismiss actions.
 * Common use cases: close buttons for dialogs, modals, notifications, or panels.
 */
export const CloseIcon: React.FC<StrokeIconProps> = ({
  width = 18,
  height = 18,
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
};
