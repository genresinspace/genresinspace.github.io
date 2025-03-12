export function Notice({
  children,
  colour = "yellow",
}: {
  children: React.ReactNode;
  colour?: "yellow" | "red" | "blue" | "green";
}) {
  const colourClasses = {
    yellow: {
      bg: "bg-yellow-100",
      border: "border-yellow-400",
      text: "text-yellow-900",
    },
    red: {
      bg: "bg-red-100",
      border: "border-red-400",
      text: "text-red-900",
    },
    blue: {
      bg: "bg-blue-100",
      border: "border-blue-400",
      text: "text-blue-900",
    },
    green: {
      bg: "bg-green-100",
      border: "border-green-400",
      text: "text-green-900",
    },
  };

  const classes = colourClasses[colour];

  return (
    <div className={`${classes.bg} border-l-4 ${classes.border} p-2 my-1`}>
      <p className={classes.text}>{children}</p>
    </div>
  );
}
