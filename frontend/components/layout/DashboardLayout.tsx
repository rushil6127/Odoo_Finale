/**
 * Champions Club — Dashboard Layout
 *
 * Per design.md §9: Sidebar + Topbar + Main Content.
 * Role-Protected: Only accessible by OWNER, ADMIN, and authorized STAFF roles.
 * Normal Members are prevented from viewing or modifying staff consoles.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Crown } from "lucide-react";
import Link from "next/link";
import { useCurrentUser, isOwner, getRoleProfilePath } from "@/lib/auth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading) {
      if (!isAuthenticated) {
        router.replace("/login");
      } else if (!isOwner(user)) {
        // Automatically redirect non-owners out of the console dashboard
        router.replace(getRoleProfilePath(user));
      }
    }
  }, [mounted, isLoading, user, isAuthenticated, router]);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Verifying Owner Credentials...</p>
        </div>
      </div>
    );
  }

  const hasAccess = isOwner(user);

  if (mounted && !hasAccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
              Console Dashboard Restricted to Owner
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The Console Dashboard and master operational schedule are strictly and exclusively reserved for the <strong className="text-amber-300">Club Owner</strong>. Redirecting you to your personal portal...
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={getRoleProfilePath(user)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-extrabold text-xs shadow-md shadow-sky-500/20 text-center"
            >
              Go to My Portal
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs text-center border border-slate-700"
            >
              Return to Club Home
            </Link>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Owner Access Policy</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Administrative console dashboards are restricted strictly to authenticated Club Owners.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-cc-white-soft">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
