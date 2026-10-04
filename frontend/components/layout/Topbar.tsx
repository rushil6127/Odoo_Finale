/**
 * Champions Club — Top Bar
 *
 * Header with dynamic title, real user profile dropdown, notifications, and navigation to /profile.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, CreditCard, ChevronDown, Bell, ShieldCheck, Crown, ExternalLink } from "lucide-react";
import { getStoredUser, logout, AuthUser } from "@/lib/auth";

/** Derive a readable page title from the route path. */
function getPageTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment || segment === "dashboard") return "Operations Command Console";
  if (segment === "employees") return "Staff Roster & Role Governance";
  if (segment === "bookings") return "Live Court Schedule & Reservations";
  if (segment === "memberships") return "Membership Approvals & Tiers";
  if (segment === "members") return "Member Directory";
  if (segment === "pos") return "Sports Bar & Quick POS Terminal";
  if (segment === "shop") return "Pro Equipment & Gear Store";
  if (segment === "inventory") return "Club Inventory & Stock Audit";
  if (segment === "crm") return "Leads & Membership CRM Pipeline";
  if (segment === "reports") return "Executive Financial & Audit Reports";
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function Topbar() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isOwner = currentUser?.role === "OWNER";
  const initials = currentUser?.first_name?.[0] || currentUser?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 relative z-30 shadow-sm">
      {/* Page title & breadcrumb */}
      <div className="flex items-center gap-3">
        <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
          {title}
        </h1>
        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
          Live Operations
        </span>
      </div>

      {/* Right side — Profile, Quick Switch & Dropdown */}
      <div className="flex items-center gap-3">
        {/* Quick Back to Profile */}
        <Link
          href="/profile"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors"
        >
          <User className="w-3.5 h-3.5" />
          <span>My Profile & Pass</span>
        </Link>

        {/* User avatar & dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center shadow-sm">
              {initials}
            </div>
            {currentUser && (
              <div className="hidden lg:block text-left pr-1">
                <p className="text-xs font-black text-slate-900 leading-tight truncate max-w-[120px]">
                  {currentUser.first_name || currentUser.email.split("@")[0]}
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  {isOwner ? (
                    <>
                      <Crown className="w-2.5 h-2.5 text-amber-600 inline shrink-0" />
                      <span>Owner</span>
                    </>
                  ) : (
                    currentUser.role
                  )}
                </p>
              </div>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-slate-200 shadow-2xl py-2 text-sm text-slate-700 animate-in fade-in slide-in-from-top-2 z-50">
              {/* User summary header */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-black text-slate-900 truncate">
                  {currentUser?.full_name || currentUser?.first_name || "Staff Member"}
                </p>
                <p className="text-xs text-slate-500 font-mono truncate">{currentUser?.email}</p>
                <div className="mt-2">
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                      <Crown className="w-3 h-3 text-amber-700" />
                      Super Sovereign Owner
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      <ShieldCheck className="w-3 h-3 text-slate-600" />
                      Role: {currentUser?.role || "STAFF"}
                    </span>
                  )}
                </div>
              </div>

              {/* Menu items */}
              <div className="p-1 space-y-0.5">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                >
                  <User className="w-4 h-4 text-sky-600" />
                  My Member Pass & Profile
                </Link>

                <Link
                  href="/employees"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Staff Roster & Role Delegator
                </Link>

                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                  Club Website
                </Link>
              </div>

              <div className="border-t border-slate-100 p-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    window.location.href = "/login";
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
