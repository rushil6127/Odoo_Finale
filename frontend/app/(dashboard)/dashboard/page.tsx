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
  Flame,
  Layers,
  Waves,
  Target,
  CircleDot,
  Trophy
} from "lucide-react";
import { getStoredUser, AuthUser } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";

interface CourtStat {
  sport: string;
  name: string;
  totalCourts: number;
  activeBookings: number;
  status: "OPTIMAL" | "PEAK" | "MAINTENANCE";
}

const getSportIcon = (sport: string) => {
  switch (sport) {
    case "BADMINTON":
      return <Activity className="w-4 h-4 text-emerald-600" />;
    case "LAWN_TENNIS":
      return <CircleDot className="w-4 h-4 text-sky-600" />;
    case "SWIMMING":
      return <Waves className="w-4 h-4 text-cyan-600" />;
    case "BOX_CRICKET":
      return <Target className="w-4 h-4 text-amber-600" />;
    case "TABLE_TENNIS":
      return <Layers className="w-4 h-4 text-indigo-600" />;
    case "VOLLEYBALL":
      return <Trophy className="w-4 h-4 text-rose-600" />;
    default:
      return <Activity className="w-4 h-4 text-slate-600" />;
  }
};

const LIVE_COURTS: CourtStat[] = [
  { sport: "BADMINTON", name: "Badminton Hall (6 Synthetic & Wood)", totalCourts: 6, activeBookings: 5, status: "PEAK" },
  { sport: "LAWN_TENNIS", name: "Lawn Tennis Arenas (Grass & Clay)", totalCourts: 4, activeBookings: 3, status: "OPTIMAL" },
  { sport: "SWIMMING", name: "Aquatic Pavilion (50M Olympic)", totalCourts: 8, activeBookings: 6, status: "OPTIMAL" },
  { sport: "BOX_CRICKET", name: "Box Cricket Astroturf Pitches", totalCourts: 2, activeBookings: 2, status: "PEAK" },
  { sport: "TABLE_TENNIS", name: "Table Tennis Pro Arena", totalCourts: 4, activeBookings: 2, status: "OPTIMAL" },
  { sport: "VOLLEYBALL", name: "Silica Sand Beach Volleyball", totalCourts: 2, activeBookings: 1, status: "OPTIMAL" },

];

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userCount, setUserCount] = useState<number>(18);
  const [activeStaffCount, setActiveStaffCount] = useState<number>(6);
  const [todayRevenue, setTodayRevenue] = useState<number>(84500);
  const [activeBookingsToday, setActiveBookingsToday] = useState<number>(24);
  const [courtOccupancyPct, setCourtOccupancyPct] = useState<number>(78);
  const [pendingApprovals, setPendingApprovals] = useState<number>(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    // Fetch live counts and report KPIs from backend
    const fetchDashboardData = async () => {
      try {
        const [usersRes, reportRes, courtsRes] = await Promise.allSettled([
          apiClient.get<any>("/auth/users"),
          apiClient.get<any>("/reports/overview?period=today"),
          apiClient.get<any>("/courts"),
        ]);

        if (usersRes.status === "fulfilled" && usersRes.value) {
          const list = usersRes.value?.users || usersRes.value?.data || (Array.isArray(usersRes.value) ? usersRes.value : []);
          if (list && list.length > 0) {
            setUserCount(list.length);
            const staff = list.filter((u: any) => u.role !== "MEMBER");
            setActiveStaffCount(staff.length || 6);
          }
        }

        if (reportRes.status === "fulfilled" && reportRes.value) {
          const rep = reportRes.value?.executive_kpis || reportRes.value?.data?.executive_kpis || reportRes.value;
          if (rep) {
            if (rep.total_revenue) setTodayRevenue(Number(rep.total_revenue));
            if (rep.active_bookings_today) setActiveBookingsToday(Number(rep.active_bookings_today));
            if (rep.court_occupancy_pct) setCourtOccupancyPct(Math.round(Number(rep.court_occupancy_pct)));
          }
        }
      } catch (err) {
        console.log("Using seeded fallback dashboard KPIs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const isOwner = currentUser?.role === "OWNER" || currentUser?.email === "pushplamba104@gmail.com";
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. EXECUTIVE WELCOME BANNER */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/90 text-amber-950 border border-amber-300/80">
                <Crown className="w-3.5 h-3.5 text-amber-950" />
                {isOwner ? "Owner Console" : `${currentUser?.role || "Admin"} Console`}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                All Systems Operational
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
              Operations &amp; Governance
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time monitoring of court bookings, staff rosters, membership queue, and club revenue.
            </p>
          </div>

          <div className="flex flex-wrap md:flex-col items-stretch gap-2.5 shrink-0">
            <Link
              href="/employees"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-amber-950 transition-all shadow-md shadow-amber-400/20"
            >
              <Crown className="w-4 h-4" />
              <span>Staff Governance</span>
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
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Today&apos;s Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {loading ? "…" : `₹${todayRevenue.toLocaleString("en-IN")}`}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-600">+14.2%</span>
              <span className="text-xs text-slate-400">vs daily avg</span>
            </div>
          </div>
        </div>

        {/* Active Members */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Active Members</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {loading ? "…" : userCount}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-600">{pendingApprovals} pending</span>
              <span className="text-xs text-slate-400">approvals</span>
            </div>
          </div>
        </div>

        {/* Court Occupancy */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Court Occupancy</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {loading ? "…" : `${courtOccupancyPct}%`}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <span className="font-bold text-slate-700">{activeBookingsToday}</span> slots booked today
            </div>
          </div>
        </div>

        {/* Staff on Duty */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Staff on Duty</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {loading ? "…" : activeStaffCount}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Active across <span className="font-bold text-slate-700">9 departments</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. OPERATIONAL MODULES GRID */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)] tracking-tight mb-4">
          Operational Consoles
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Staff & Role Delegator */}
          <Link
            href="/employees"
            className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-amber-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 tracking-wider">
                  Governance
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-4 group-hover:text-amber-600 transition-colors font-[family-name:var(--font-outfit)] leading-snug">
                Staff &amp; Role Governance
              </h3>
            </div>
            <div className="mt-6 py-2.5 px-4 rounded-xl bg-amber-50/70 group-hover:bg-amber-100/90 border border-amber-200/80 shadow-xs group-hover:shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold text-amber-800 transition-all">
              <span>Open Staff Console</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Bookings */}
          <Link
            href="/bookings"
            className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-sky-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 border border-sky-200/60 flex items-center justify-center">
                  <CalendarDays className="w-5 h-5 text-sky-600" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 tracking-wider">
                  Live Grid
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-4 group-hover:text-sky-600 transition-colors font-[family-name:var(--font-outfit)] leading-snug">
                Court Schedules &amp; Bookings
              </h3>
            </div>
            <div className="mt-6 py-2.5 px-4 rounded-xl bg-sky-50/70 group-hover:bg-sky-100/90 border border-sky-200/80 shadow-xs group-hover:shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold text-sky-700 transition-all">
              <span>Manage Courts &amp; Slots</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Memberships */}
          <Link
            href="/memberships"
            className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-emerald-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center">
                  <Award className="w-5 h-5 text-emerald-600" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 tracking-wider">
                  {pendingApprovals} Pending
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-4 group-hover:text-emerald-600 transition-colors font-[family-name:var(--font-outfit)] leading-snug">
                Membership Approvals &amp; Plans
              </h3>
            </div>
            <div className="mt-6 py-2.5 px-4 rounded-xl bg-emerald-50/70 group-hover:bg-emerald-100/90 border border-emerald-200/80 shadow-xs group-hover:shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold text-emerald-700 transition-all">
              <span>Review Membership Queue</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 4: POS & Sports Bar */}
          <Link
            href="/pos"
            className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-teal-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 border border-teal-200/60 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-teal-600" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200/80 tracking-wider">
                  POS
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-4 group-hover:text-teal-600 transition-colors font-[family-name:var(--font-outfit)] leading-snug">
                Sports Bar &amp; Café POS
              </h3>
            </div>
            <div className="mt-6 py-2.5 px-4 rounded-xl bg-teal-50/70 group-hover:bg-teal-100/90 border border-teal-200/80 shadow-xs group-hover:shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold text-teal-700 transition-all">
              <span>Launch POS Terminal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 5: Pro Shop & Inventory */}
          <Link
            href="/inventory"
            className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-indigo-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 tracking-wider">
                  Stock
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-4 group-hover:text-indigo-600 transition-colors font-[family-name:var(--font-outfit)] leading-snug">
                Equipment &amp; Pro Shop
              </h3>
            </div>
            <div className="mt-6 py-2.5 px-4 rounded-xl bg-indigo-50/70 group-hover:bg-indigo-100/90 border border-indigo-200/80 shadow-xs group-hover:shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold text-indigo-700 transition-all">
              <span>Open Inventory</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 6: Reports */}
          <Link
            href="/reports"
            className="group bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-purple-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 tracking-wider">
                  Reports
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 mt-4 group-hover:text-purple-600 transition-colors font-[family-name:var(--font-outfit)] leading-snug">
                Financial Reports &amp; Audits
              </h3>
            </div>
            <div className="mt-6 py-2.5 px-4 rounded-xl bg-purple-50/70 group-hover:bg-purple-100/90 border border-purple-200/80 shadow-xs group-hover:shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold text-purple-700 transition-all">
              <span>View Financial Reports</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* 4. LIVE COURT STATUS OVERVIEW */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Pavilion Occupancy</span>
            </h3>
            <p className="text-xs text-slate-500">Live arena availability across all sports</p>
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
              className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/70 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0 shadow-xs">
                  {getSportIcon(court.sport)}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">{court.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {court.activeBookings} / {court.totalCourts} arenas in play
                  </p>
                </div>
              </div>

              <div>
                {court.status === "PEAK" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    <Flame className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>Peak</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Active</span>
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
