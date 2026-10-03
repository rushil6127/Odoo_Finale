/**
 * Champions Club — Card Component
 *
 * Reusable card surface following design.md: subtle shadows, moderate radius.
 */

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function Card({
  children,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-white
        border border-cc-border
        rounded-[var(--cc-radius-lg)]
        shadow-[var(--cc-shadow-sm)]
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
