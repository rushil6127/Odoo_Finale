/**
 * Champions Club — Sidebar Navigation
 *
 * Staff/Admin navigation per design.md §10.
 * Grouped: Dashboard, Club, Operations, Growth, Management.
 * No business logic — just structural navigation.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: "",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "📊" },
    ],
  },
  {
    title: "Club",
    items: [
      { label: "Members", href: "/members", icon: "👥" },
      { label: "Memberships", href: "/memberships", icon: "🏅" },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Bookings", href: "/bookings", icon: "🎾" },
      { label: "Shop", href: "/shop", icon: "🛍️" },
      { label: "Inventory", href: "/inventory", icon: "📦" },
      { label: "Bar / POS", href: "/pos", icon: "🍽️" },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "CRM", href: "/crm", icon: "📈" },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Employees", href: "/employees", icon: "🧑‍💼" },
      { label: "Reports", href: "/reports", icon: "📋" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-cc-green-deep text-white flex flex-col shrink-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cc-green-bright flex items-center justify-center">
            <span className="text-cc-green-deep font-bold text-sm">CC</span>
          </div>
          <span className="font-semibold text-base tracking-tight">
            Champions Club
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6" aria-label="Main navigation">
        {navigation.map((group) => (
          <div key={group.title || "root"}>
            {group.title && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3
                        px-3 py-2
                        text-sm font-medium
                        rounded-[var(--cc-radius-md)]
                        transition-colors duration-[var(--cc-transition-fast)]
                        ${
                          isActive
                            ? "bg-white/15 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white"
                        }
                      `}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="text-base" aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-white/40">Champions Club v0.1</p>
      </div>
    </aside>
  );
}
