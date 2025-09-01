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
  const colourClasses = {
    yellow: {
      bg: colourStyles.notice.yellow,
      border: "border-yellow-400",
      text: "text-yellow-900",
    },
    red: {
      bg: colourStyles.notice.red,
      border: "border-red-400",
      text: "text-red-900",
    },
    blue: {
      bg: colourStyles.notice.blue,
      border: "border-blue-400",
      text: "text-blue-900",
    },
    green: {
      bg: colourStyles.notice.green,
      border: "border-green-400",
      text: "text-green-900",
    },
  };

  const classes = colourClasses[colour];

  return (
    <div className={`${classes.bg} border-l-4 ${classes.border} p-4`}>
      <div className={classes.text}>{children}</div>
    </div>
  );
}
