/**
 * Champions Club — Staff & Admin Executive Sidebar Navigation
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Award,
  CalendarDays,
  ShoppingBag,
  Boxes,
  UtensilsCrossed,
  TrendingUp,
  Briefcase,
  FileSpreadsheet,
  Globe,
  User,
  ShieldCheck,
  Crown
} from "lucide-react";
import { getStoredUser } from "@/lib/auth";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: "Executive Overview",
    items: [
      { label: "Console Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Staff & Governance",
    items: [
      { label: "Staff & Roles Delegator", href: "/employees", icon: Briefcase, badge: "Delegator", badgeColor: "bg-amber-500 text-slate-950" },
      { label: "Executive Reports", href: "/reports", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Sports & Operations",
    items: [
      { label: "Court Bookings", href: "/bookings", icon: CalendarDays, badge: "Live Grid", badgeColor: "bg-emerald-500/20 text-emerald-400" },
      { label: "Memberships & Tiers", href: "/memberships", icon: Award },
      { label: "Member Directory", href: "/members", icon: Users },
    ],
  },
  {
    title: "Commerce & Hospitality",
    items: [
      { label: "Pro Shop", href: "/inventory", icon: ShoppingBag },
      { label: "Café Bar", href: "/pos", icon: UtensilsCrossed },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  const isOwner = currentUser?.role === "OWNER";

  return (
    <aside className="w-64 h-screen bg-slate-950 border-r border-slate-800 text-slate-200 flex flex-col shrink-0 overflow-y-auto z-40 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/40">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
            CC
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-white font-[family-name:var(--font-outfit)]">
                CHAMPIONS CLUB
              </span>
            </div>
            <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1">
              {isOwner ? (
                <>
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>Owner Console</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>Admin Console</span>
                </>
              )}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5" aria-label="Main navigation">
        {navigation.map((group) => (
          <div key={group.title || "root"}>
            {group.title && (
              <p className="px-3 mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                {group.title}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center justify-between
                        px-3 py-2.5
                        text-xs font-bold
                        rounded-xl
                        transition-all duration-150
                        ${
                          isActive
                            ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                            : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                        }
                      `}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComponent className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${item.badgeColor || "bg-slate-800 text-slate-300"}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer Navigation & Portal Return */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 space-y-1.5">
        <Link
          href="/profile"
          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-sky-400" />
            <span>My Profile & Pass</span>
          </div>
          <span className="text-[10px] text-slate-400">Exit Console</span>
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Club Sanctuary Website</span>
        </Link>
      </div>
    </aside>
  );
}
