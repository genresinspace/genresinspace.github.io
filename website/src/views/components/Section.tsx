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
    <section className="rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900">
      <SectionHeading icon={icon}>{heading}</SectionHeading>
      <div>{children}</div>
    </section>
  );
}
