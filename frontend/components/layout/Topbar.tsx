/**
 * Champions Club — Top Bar
 *
 * Per design.md §9: Top Bar with Profile / Bell.
 * Structural placeholder — auth/notifications come later.
 */

"use client";

import { usePathname } from "next/navigation";

/** Derive a readable page title from the route path. */
function getPageTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) return "Dashboard";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Topbar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="h-16 bg-white border-b border-cc-border flex items-center justify-between px-6 shrink-0">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-cc-text-primary">{title}</h1>

      {/* Right side — placeholder for profile & notifications */}
      <div className="flex items-center gap-4">
        {/* Notification bell placeholder */}
        <button
          type="button"
          className="p-2 text-cc-text-muted hover:text-cc-text-primary rounded-[var(--cc-radius-md)] hover:bg-cc-white-warm transition-colors"
          aria-label="Notifications"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
            />
          </svg>
        </button>

        {/* User avatar placeholder */}
        <button
          type="button"
          className="w-8 h-8 rounded-full bg-cc-green-deep text-white text-xs font-bold flex items-center justify-center hover:ring-2 hover:ring-cc-green-bright transition-all"
          aria-label="User menu"
        >
          U
        </button>
      </div>
    </header>
  );
}
