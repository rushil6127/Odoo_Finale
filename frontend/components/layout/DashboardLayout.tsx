/**
 * Champions Club — Dashboard Layout
 *
 * Per design.md §9: Sidebar + Topbar + Main Content.
 * Role-Protected: Only accessible by OWNER, ADMIN, and authorized STAFF roles.
 * Normal Members are prevented from viewing or modifying staff consoles.
 */

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeft, Crown } from "lucide-react";
import Link from "next/link";
import { useCurrentUser, isStaffOrAdmin } from "@/lib/auth";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Verifying Staff & Administrative Credentials...</p>
        </div>
      </div>
    );
  }

  const hasAccess = isStaffOrAdmin(user);

  if (mounted && !hasAccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
              Staff Console Access Restricted
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your account (<span className="font-mono text-sky-400">{user?.email || "Member"}</span>) is registered as a <strong className="text-amber-300">Club Member</strong>. Operational management and POS consoles are reserved for Administrators, Owners, and Assigned Department Staff.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Need Staff or Department Access?</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Please contact the Super Owner (<strong className="text-slate-200">pushplamba104@gmail.com</strong>) to have your Gmail provisioned with custom role permissions.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/profile"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs shadow-lg shadow-sky-600/25 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Member Portal & Pass</span>
            </Link>
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
