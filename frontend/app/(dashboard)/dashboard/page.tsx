/**
 * Champions Club — Staff & Admin Executive Command Console
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Award,
  CalendarDays,
  ShoppingBag,
  Boxes,
  UtensilsCrossed,
  TrendingUp,
  Briefcase,
  FileSpreadsheet,
  Crown,
  ShieldCheck,
  ArrowRight,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  DollarSign,
  UserCheck,
  ChevronRight,
  Flame
} from "lucide-react";
import { getStoredUser, AuthUser } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";

interface CourtStat {
  sport: string;
  name: string;
  icon: string;
  totalCourts: number;
  activeBookings: number;
  status: "OPTIMAL" | "PEAK" | "MAINTENANCE";
}

const LIVE_COURTS: CourtStat[] = [
  { sport: "BADMINTON", name: "Badminton Hall (6 Synthetic & Wood)", icon: "🏸", totalCourts: 6, activeBookings: 5, status: "PEAK" },
  { sport: "LAWN_TENNIS", name: "Lawn Tennis Arenas (Grass & Clay)", icon: "🎾", totalCourts: 4, activeBookings: 3, status: "OPTIMAL" },
  { sport: "SWIMMING", name: "Aquatic Pavilion (50M Olympic)", icon: "🏊‍♂️", totalCourts: 8, activeBookings: 6, status: "OPTIMAL" },
  { sport: "BOX_CRICKET", name: "Box Cricket Astroturf Pitches", icon: "🏏", totalCourts: 2, activeBookings: 2, status: "PEAK" },
  { sport: "TABLE_TENNIS", name: "Table Tennis Pro Arena", icon: "🏓", totalCourts: 4, activeBookings: 2, status: "OPTIMAL" },
  { sport: "VOLLEYBALL", name: "Silica Sand Beach Volleyball", icon: "🏐", totalCourts: 2, activeBookings: 1, status: "OPTIMAL" },
];

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userCount, setUserCount] = useState<number>(14);
  const [activeStaffCount, setActiveStaffCount] = useState<number>(6);
  const [pendingApprovals, setPendingApprovals] = useState<number>(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    // Fetch live counts from backend if available
    const fetchCounts = async () => {
      try {
        const res = await apiClient.get<any>("/auth/users");
        if (res.data && Array.isArray(res.data)) {
          setUserCount(res.data.length);
          const staff = res.data.filter((u: any) => u.role !== "MEMBER");
          setActiveStaffCount(staff.length || 6);
        }
      } catch (err) {
        // Fallback to defaults
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  const isOwner = currentUser?.role === "OWNER" || currentUser?.email === "pushplamba104@gmail.com";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. EXECUTIVE WELCOME BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {isOwner ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-amber-950 border border-amber-300 shadow-sm">
                  <Crown className="w-3.5 h-3.5 text-amber-950" />
                  SUPER SOVEREIGN OWNER
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-400 text-emerald-950 border border-emerald-300 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-950" />
                  {currentUser?.role || "ADMINISTRATOR"} CONSOLE
                </span>
              )}
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All 6 Sports Pavilions & System Modules Online
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
              Operations & Governance Command Center
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time club orchestration: Manage staff rosters, court slot allocations, membership approvals, point-of-sale transactions, and sovereign privileges.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col items-stretch gap-2.5 shrink-0">
            <Link
              href="/employees"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-amber-950 transition-all shadow-lg shadow-amber-400/20"
            >
              <Crown className="w-4 h-4" />
              <span>Staff & Role Governance</span>
            </Link>

            <Link
              href="/bookings"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20"
            >
              <CalendarDays className="w-4 h-4" />
              <span>Court Booking Grid</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. LIVE KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Today&apos;s Club Turnout</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                ₹84,500
              </span>
              <span className="text-xs font-bold text-emerald-600 flex items-center">
                +14.2% vs avg
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">From Court bookings, POS tabs & Pro shop</p>
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Member Directory</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                {userCount} Registered
              </span>
              <span className="text-xs font-bold text-amber-600">
                {pendingApprovals} Pending Approvals
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Standard, Elite & Black Card Members</p>
          </div>
        </div>

        {/* Court Occupancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Court Slot Utilization</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                74% Occupied
              </span>
              <span className="text-xs font-bold text-sky-600">
                19 / 26 Slots Booked
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">High demand in Tennis & Badminton</p>
          </div>
        </div>

        {/* Active Staff Roster */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Staff On Duty</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                {activeStaffCount} On Shift
              </span>
              <span className="text-xs font-bold text-purple-600">
                9 Departments
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Coaches, Front Desk, POS & Managers</p>
          </div>
        </div>
      </div>

      {/* 3. CORE OPERATIONAL MODULES GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Administrative & Operational Consoles
            </h2>
            <p className="text-xs text-slate-500">
              Click any module to access its live administrative controls
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Staff & Role Delegator */}
          <Link
            href="/employees"
            className="group relative bg-white rounded-2xl p-5 border border-amber-200/80 hover:border-amber-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center text-lg">
                  👑
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  Core Sovereign Tool
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-3 group-hover:text-amber-600 transition-colors">
                Staff Roster & Role Delegator
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Appoint Admins, Coaches, Trainers, and POS staff. Super Owner can grant sovereign permissions by Gmail.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
              <span>Open Staff Console</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Bookings */}
          <Link
            href="/bookings"
            className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-sky-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center text-lg">
                  🎾
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                  Live Court Grid
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-3 group-hover:text-sky-600 transition-colors">
                Court Schedules & Reservations
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Schedule slots, manage maintenance locks, adjust peak pricing, and monitor court occupancy.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-sky-700">
              <span>Manage Courts & Slots</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Memberships */}
          <Link
            href="/memberships"
            className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-lg">
                  🏅
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {pendingApprovals} Pending
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-3 group-hover:text-emerald-600 transition-colors">
                Membership Approvals & Plans
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Review payment screenshots, approve tier upgrades (Gold, Platinum, Black Card), and configure perks.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>Review Membership Queue</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 4: POS & Sports Bar */}
          <Link
            href="/pos"
            className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-teal-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center text-lg">
                  🍽️
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                  Touch POS
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-3 group-hover:text-teal-600 transition-colors">
                Sports Bar & Café POS
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Quick order entry, member account charging, table tab management, and kitchen receipts.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-700">
              <span>Launch POS Terminal</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 5: Pro Shop & Inventory */}
          <Link
            href="/inventory"
            className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-lg">
                  📦
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                  Stock Control
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-3 group-hover:text-indigo-600 transition-colors">
                Equipment Inventory & Shop
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Track racket strings, Yonex shuttlecocks, balls, apparel stock, and low-inventory reorders.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
              <span>Open Stock Inventory</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 6: Reports */}
          <Link
            href="/reports"
            className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-purple-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-lg">
                  📋
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                  Analytics & Audit
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-3 group-hover:text-purple-600 transition-colors">
                Financial Reports & Audit Ledger
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Detailed day-end reconciliation, revenue by department, tax reports, and access audit logs.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
              <span>View Financial Reports</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* 4. LIVE COURT STATUS OVERVIEW */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Live Sports Pavilion Occupancy</span>
            </h3>
            <p className="text-xs text-slate-500">Real-time court availability across all 6 disciplines</p>
          </div>
          <Link
            href="/bookings"
            className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Full Booking Matrix</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {LIVE_COURTS.map((court) => (
            <div
              key={court.sport}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/80 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{court.icon}</span>
                <div>
                  <h4 className="text-xs font-black text-slate-900">{court.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {court.activeBookings} / {court.totalCourts} arenas in play
                  </p>
                </div>
              </div>

              <div>
                {court.status === "PEAK" ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    🔥 PEAK
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                    🟢 ACTIVE
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
