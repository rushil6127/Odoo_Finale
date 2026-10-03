/**
 * Champions Club — Badge Component
 *
 * Used for status indicators, categories, membership tiers.
 * Per design.md: pill-shaped is OK for status/category/filter/tier.
 */

import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "gold" | "silver" | "junior";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-cc-white-warm text-cc-text-secondary",
  success: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  gold: "bg-cc-green-bright/20 text-cc-green-deep border-cc-green-bright/40",
  silver: "bg-gray-100 text-cc-blue-deep border-gray-300",
  junior: "bg-cc-lime/20 text-cc-green-olive border-cc-lime/40",
};

export default function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        text-xs font-medium
        rounded-full
        border
        ${variantStyles[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
