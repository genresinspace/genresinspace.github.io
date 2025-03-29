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
      bg: "bg-yellow-100/90",
      border: "border-yellow-400",
      text: "text-yellow-900",
    },
    red: {
      bg: "bg-red-100/90",
      border: "border-red-400",
      text: "text-red-900",
    },
    blue: {
      bg: "bg-blue-100/90",
      border: "border-blue-400",
      text: "text-blue-900",
    },
    green: {
      bg: "bg-green-100/90",
      border: "border-green-400",
      text: "text-green-900",
    },
  };

  const classes = colourClasses[colour];

  return (
    <div className={`${classes.bg} border-l-4 ${classes.border} p-3`}>
      <div className={classes.text}>{children}</div>
    </div>
  );
}
