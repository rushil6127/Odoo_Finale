/**
 * Champions Club — Top Bar
 *
 * Header with dynamic title, real user profile dropdown, notifications, and navigation to /profile.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, CreditCard, ChevronDown, Bell, ShieldCheck, Crown } from "lucide-react";
import { getStoredUser, logout, AuthUser } from "@/lib/auth";

/** Derive a readable page title from the route path. */
function getPageTitle(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).pop();
  if (!segment) return "Dashboard";
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

  const isOwner = currentUser?.role === "OWNER" || currentUser?.email === "pushplamba104@gmail.com";
  const initials = currentUser?.first_name?.[0] || currentUser?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="h-16 bg-white border-b border-cc-border flex items-center justify-between px-6 shrink-0 relative z-30">
      {/* Page title */}
      <h1 className="text-lg font-semibold text-cc-text-primary">{title}</h1>

      {/* Right side — Profile & notifications */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button
          type="button"
          className="p-2 text-cc-text-muted hover:text-cc-text-primary rounded-[var(--cc-radius-md)] hover:bg-cc-white-warm transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>

        {/* User avatar & dropdown menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-zinc-100 transition-all border border-transparent hover:border-zinc-200"
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            <div className="w-8 h-8 rounded-full bg-cc-green-deep text-white text-xs font-bold flex items-center justify-center shadow">
              {initials}
            </div>
            {currentUser && (
              <span className="text-xs font-medium text-zinc-700 hidden md:inline">
                {currentUser.first_name || currentUser.email.split("@")[0]}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-zinc-200 shadow-xl py-2 text-sm text-zinc-700 animate-in fade-in slide-in-from-top-2 z-50">
              {/* User summary header */}
              <div className="px-4 py-3 border-b border-zinc-100">
                <p className="font-semibold text-zinc-900 truncate">
                  {currentUser?.full_name || currentUser?.first_name || "Club User"}
                </p>
                <p className="text-xs text-zinc-500 font-mono truncate">{currentUser?.email}</p>
                <div className="mt-2">
                  {isOwner ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Crown className="w-3 h-3 text-amber-600" />
                      Super Owner
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {currentUser?.role || "MEMBER"}
                    </span>
                  )}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition-colors"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  My Profile
                </Link>

                <Link
                  href="/memberships"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 transition-colors"
                >
                  <CreditCard className="w-4 h-4 text-zinc-400" />
                  Memberships & Perks
                </Link>
              </div>

              <div className="border-t border-zinc-100 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-xs font-medium"
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
