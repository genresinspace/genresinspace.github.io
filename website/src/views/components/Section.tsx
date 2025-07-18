import React from "react";
import { SectionHeading } from "./SectionHeading";

/** Reusable component for sections with a heading and optional icon */
export function Section({
  heading,
  icon,
  children,
}: {
  heading: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHeading icon={icon}>{heading}</SectionHeading>
      <div>{children}</div>
    </section>
  );
}
