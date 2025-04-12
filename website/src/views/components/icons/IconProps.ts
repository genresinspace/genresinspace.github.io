export type IconProps = {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
};

export type FillIconProps = IconProps & {
  fill?: string;
};

export type StrokeIconProps = IconProps & {
  stroke?: string;
};
