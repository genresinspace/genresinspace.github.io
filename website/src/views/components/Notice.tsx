import { colourStyles } from "../colours";

/**
 * A styled notice box component with different color themes
 * Used to display important information with visual emphasis
 */
export function Notice({
  children,
  colour = "yellow",
}: {
  children: React.ReactNode;
  colour?: "yellow" | "red" | "blue" | "green";
}) {
  return <div className={`${colourStyles.notice[colour]} p-4`}>{children}</div>;
}
