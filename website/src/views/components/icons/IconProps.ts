/** Props for an icon component */
export type IconProps = {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
};

/** Props for an icon component that has a fill color */
export type FillIconProps = IconProps & {
  fill?: string;
};

/** Props for an icon component that has a stroke color */
export type StrokeIconProps = IconProps & {
  stroke?: string;
};
