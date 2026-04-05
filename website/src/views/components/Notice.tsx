import { colourStyles } from "../colours";

/**
 * A styled notice box component with different color themes
 * Used to display important information with visual emphasis
 */
export function Notice({
  children,
  colour = "yellow",
  roundTop = true,
}: {
  children: React.ReactNode;
  colour?: "yellow" | "red" | "blue" | "green";
  roundTop?: boolean;
}) {
  return (
    <div
      className={`${colourStyles.notice[colour]} ${roundTop ? "rounded-xl" : "rounded-b-xl"} p-4`}
    >
      {children}
    </div>
  );
}
