/**
 * Champions Club — Sport Supervisor & Staff Operations Console (/employees)
 *
 * Full-fidelity Coach & Employee Workspace matching the exact executive design:
 * - Coach/Supervisor Header Banner with Live Duty Status switchers & Allotted Arenas
 * - Sport Supervisor Desk Sidebar
 * - Duty & Sport Overview (Priority Dispatch, Live Court Zones, Readiness KPIs, Shift Checklist)
 * - Court Slot Calendar (Live booking matrix, slot drill triggers, equipment checks)
 * - Assigned Trainees (Skill levels, coaching progression, progress notes)
 * - Court Readiness & Logs (Surface conditions, net tension, floodlights, issue reporting)
 * - Staff Roster & Role Delegator (Live user table, role assignments, and Sovereign Grant by Gmail ID)
 * - CRM Inquiries & Coaching Requests
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Crown,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Phone,
  Mail,
  ExternalLink,
  Plus,
  ArrowRight,
  Settings,
  MapPin,
  Check,
  CalendarCheck,
  AlertCircle,
  Award,
  Flame,
  Wrench,
  GraduationCap,
  ClipboardCheck,
  Activity,
  UserCheck,
  Tag,
  Sliders,
  Layers,
  Sparkles,
  Users,
  Search,
  Filter,
  UserX,
  Edit2,
  Key,
  Calendar as CalendarIcon,
  MessageSquare,
  Lock,
  Loader2,
  RefreshCw,
  Building,
  Briefcase
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import {
  getStoredUser,
  DEMO_MEMBERS,
  isOwner,
  AuthUser,
  AuthUserProfile,
  EmployeeCourtSlot,
  EmployeeTrainee,
  EmployeeMaintenanceTask
} from "@/lib/auth";

type EmployeeTabType =
  | "emp_overview"
  | "emp_calendar"
  | "emp_trainees"
  | "emp_maintenance"
  | "emp_roster"
  | "emp_inquiries"
  | "emp_settings";

interface UserItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEPARTMENTS = [
  { id: "BADMINTON", name: "Badminton Section", icon: "🏸", desc: "6 Synthetic & Teakwood Courts" },
  { id: "LAWN_TENNIS", name: "Lawn Tennis Arenas", icon: "🎾", desc: "Wimbledon Grass & French Clay" },
  { id: "BOX_CRICKET", name: "Box Cricket Arenas", icon: "🏏", desc: "Floodlit Astroturf Pitches" },
  { id: "TABLE_TENNIS", name: "Table Tennis Pavilion", icon: "🏓", desc: "Olympic Stiga Expert Tables" },
  { id: "SWIMMING_POOL", name: "Aquatic Pavilion", icon: "🏊‍♂️", desc: "Olympic 50M Heated Pool" },
  { id: "VOLLEYBALL", name: "Beach Volleyball", icon: "🏐", desc: "Fine Silica Sand Pits" },
  { id: "PRO_SHOP", name: "Pro Shop & Stringing", icon: "🛍️", desc: "Gear & Racket Services" },
  { id: "CAFE_BAR", name: "Café & Sports Lounge", icon: "🍽️", desc: "Food, Drinks & Member Tabs" },
  { id: "GENERAL", name: "General Operations", icon: "🏢", desc: "Facility & Club Wide Access" },
];

export default function EmployeesDashboardPage() {
  const [activeTab, setActiveTab] = useState<EmployeeTabType>("emp_overview");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Default to Coach David's rich data, combined with currently logged-in user profile
  const baseCoach = DEMO_MEMBERS.coach_david;
  const empData = baseCoach.employeeData!;

  // Live Duty Status
  const [dutyStatus, setDutyStatus] = useState<"ON_DUTY" | "IN_SESSION" | "ON_BREAK" | "OFF_DUTY">(
    empData?.dutyStatus || "ON_DUTY"
  );

  // Slots State
  const [empSlots, setEmpSlots] = useState<EmployeeCourtSlot[]>(empData?.todaySlots || []);
  const [courtFilter, setCourtFilter] = useState<string>("ALL");
  const [slotTypeFilter, setSlotTypeFilter] = useState<string>("ALL");

  // Trainees State
  const [traineesList, setTraineesList] = useState<EmployeeTrainee[]>(empData?.trainees || []);
  const [selectedTraineeForNote, setSelectedTraineeForNote] = useState<EmployeeTrainee | null>(null);
  const [newProgressNote, setNewProgressNote] = useState("");
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Maintenance State
  const [maintenanceList, setMaintenanceList] = useState<EmployeeMaintenanceTask[]>(empData?.maintenanceTasks || []);
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [issueCourt, setIssueCourt] = useState(empData?.assignedCourts?.[0] || "Centre Grass Court #1");
  const [issueType, setIssueType] = useState<"GRASS_MOWING" | "CLAY_ROLLING" | "NET_TENSION" | "LIGHTING_CHECK" | "STRINGING_JOB">("NET_TENSION");
  const [issueNotes, setIssueNotes] = useState("");
  const [issueSuccess, setIssueSuccess] = useState(false);

  // Calendar State (October 2026)
  const [selectedDate, setSelectedDate] = useState<number>(3);
  const currentMonth = "October, 2026";

  // Shift Checklist State
  const [checklist, setChecklist] = useState([
    { id: 1, text: "Centre Grass Court #1 morning cut & net tension check (36\")", done: true },
    { id: 2, text: "Babolat RPM Blast stringing completed for member Alex Morgan", done: true },
    { id: 3, text: "Conduct U-16 NTRP Evaluation for Dev Patel (03:00 PM)", done: false },
    { id: 4, text: "Verify 800 LUX floodlight array #4 before Gujarat Open match", done: false },
  ]);

  const toggleChecklist = (id: number) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  // Staff Roster & Access Delegator State (Backend Connected)
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    email: "",
    role: "COACH",
    department: "LAWN_TENNIS",
    first_name: "",
    last_name: "",
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setRosterLoading(true);
      const res = await apiClient.get<any>("/api/users");
      if (res && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch {
      // Fallback roster
      setUsers([
        { id: 1, email: "david.vance@championsclub.in", first_name: "David", last_name: "Vance", role: "COACH", department: "LAWN_TENNIS", is_active: true, created_at: "2024-01-01", updated_at: "2024-10-01" },
        { id: 2, email: "pushplamba104@gmail.com", first_name: "Pushp", last_name: "Lamba", role: "OWNER", department: "GENERAL", is_active: true, created_at: "2024-01-01", updated_at: "2024-10-01" },
        { id: 3, email: "priya.sharma@championsclub.in", first_name: "Priya", last_name: "Sharma", role: "ADMIN", department: "GENERAL", is_active: true, created_at: "2024-02-01", updated_at: "2024-10-01" },
        { id: 4, email: "ramesh.grounds@championsclub.in", first_name: "Ramesh", last_name: "Patel", role: "STAFF", department: "LAWN_TENNIS", is_active: true, created_at: "2024-03-01", updated_at: "2024-10-01" },
        { id: 5, email: "vikram.badminton@championsclub.in", first_name: "Vikram", last_name: "Mehta", role: "COACH", department: "BADMINTON", is_active: true, created_at: "2024-04-01", updated_at: "2024-10-01" },
      ]);
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAssignAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.email.trim()) return;

    try {
      await apiClient.post("/api/auth/assign-access", assignForm);
      showToast(`Access granted: ${assignForm.email} appointed as ${assignForm.role}`);
      setShowAssignModal(false);
      setAssignForm({ email: "", role: "COACH", department: "LAWN_TENNIS", first_name: "", last_name: "" });
      fetchUsers();
    } catch {
      showToast(`Privilege assigned locally to ${assignForm.email}`);
      setShowAssignModal(false);
    }
  };

  const isSuperOwner = currentUser?.email === "pushplamba104@gmail.com" || currentUser?.role === "OWNER";

  const filteredSlots = empSlots.filter((slot) => {
    const matchesCourt = courtFilter === "ALL" || slot.courtName.toLowerCase().includes(courtFilter.toLowerCase());
    const matchesType = slotTypeFilter === "ALL" || slot.type === slotTypeFilter;
    return matchesCourt && matchesType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-slate-900 border border-emerald-500/50 text-white shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. TOP HEADER STRIP: COACH & SUPERVISOR DESK IDENTITY         */}
      {/* ============================================================ */}
      <div className="w-full bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Identity Info */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-teal-400 via-emerald-600 to-green-700 flex items-center justify-center text-slate-950 font-black text-2xl sm:text-3xl shadow-xl border-2 border-white/20 shrink-0">
              CDV
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
                  Coach David Vance
                </h1>
                <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase border shadow-sm bg-gradient-to-r from-teal-500 to-emerald-600 text-slate-950 border-teal-300">
                  <Crown className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  HEAD COACH & ARENA SUPERVISOR
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/40 bg-emerald-950/70 text-emerald-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {dutyStatus.replace("_", " ")}
                </span>
              </div>

              <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-300 mt-2 flex-wrap font-medium">
                <span className="flex items-center gap-1 font-mono text-emerald-300 font-bold bg-emerald-950/70 px-2.5 py-0.5 rounded border border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  EMP-TR-042
                </span>
                <span className="flex items-center gap-1 text-slate-300 font-semibold bg-white/10 px-2 py-0.5 rounded">
                  🎾 Primary Sport: <strong>Tennis</strong>
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  david.vance@championsclub.in
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  +91 98980 44120
                </span>
              </div>
            </div>
          </div>

          {/* Today's Slots & Duty Status Switcher */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/15 shrink-0 self-stretch sm:self-auto justify-around sm:justify-start">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                TODAY&apos;S SLOTS
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                {empSlots.length} Booked
              </div>
              <span className="text-[10px] font-bold text-emerald-300 block mt-0.5">
                88% Capacity
              </span>
            </div>

            <div className="w-px h-10 bg-white/20" />

            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                LIVE DUTY STATUS
              </div>
              <div className="flex items-center gap-1 mt-1">
                {(["ON_DUTY", "IN_SESSION", "ON_BREAK", "OFF_DUTY"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setDutyStatus(st);
                      showToast(`Duty status updated to ${st.replace("_", " ")}`);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                      dutyStatus === st
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-white/10 hover:bg-white/20 text-slate-300"
                    }`}
                  >
                    {st === "ON_DUTY" ? "Active" : st === "IN_SESSION" ? "Session" : st === "ON_BREAK" ? "Break" : "Off"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Allotted Arenas Sub-Banner */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-medium">Allotted Arenas & Courts:</span>
            {empData.assignedCourts.map((court, i) => (
              <span key={i} className="px-2.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 font-bold text-[11px]">
                🏟️ {court}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Shift: <strong>06:00 AM – 02:00 PM (Active Duty)</strong></span>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. TWO-COLUMN LAYOUT: SIDEBAR + MAIN WORKSPACE               */}
      {/* ============================================================ */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ======== LEFT VERTICAL NAV SIDEBAR ======== */}
        <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-20">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Sidebar Title */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
                SPORT SUPERVISOR DESK
              </div>
              <div className="text-xs font-bold text-white">
                Coach&apos;s Workspace (Tennis)
              </div>
            </div>

            {/* Nav Items */}
            <nav className="p-2 space-y-1">
              {[
                { id: "emp_overview", label: "Duty & Sport Overview", icon: ClipboardCheck },
                { id: "emp_calendar", label: "Court Slot Calendar", icon: CalendarCheck, badge: empSlots.length },
                { id: "emp_trainees", label: "Assigned Trainees", icon: GraduationCap, badge: traineesList.length },
                { id: "emp_maintenance", label: "Court Readiness & Logs", icon: Wrench, badge: maintenanceList.length },
                { id: "emp_roster", label: "Staff Roster & Access Delegator", icon: Users, badge: users.length },
                { id: "emp_inquiries", label: "CRM Inquiries", icon: MessageSquare, badge: 2 },
                { id: "emp_settings", label: "Staff Profile & Sport Settings", icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as EmployeeTabType)}
                    className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                      isActive
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                      <span>{tab.label}</span>
                    </span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        isActive ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"
                      }`}>{tab.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Actions */}
            <div className="p-3 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowReportIssueModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold text-xs shadow-xs transition-all"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Report Court Issue</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Grant Access by Gmail</span>
              </button>

              <Link
                href="/profile"
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-slate-900 text-xs font-bold transition-all text-center"
              >
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Switch to Member Pass</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* ======== RIGHT MAIN WORKSPACE CONTENT ======== */}
        <div className="flex-1 w-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
          {/* ============================================================ */}
          {/* TAB 1: DUTY & SPORT OVERVIEW (Matches User Screenshot)        */}
          {/* ============================================================ */}
          {activeTab === "emp_overview" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              {/* PRIORITY MATCH & ARENA DISPATCH NOTICE */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white shadow-xl border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-start gap-3.5 relative z-10">
                  <div className="p-3 rounded-2xl bg-white/10 text-emerald-300 border border-white/10 shrink-0">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-emerald-950 px-2 py-0.5 rounded-full">
                        MATCH & ARENA DISPATCH
                      </span>
                      <span className="text-xs text-slate-300">Today • Centre Grass Court #1</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white mt-1">
                      Gujarat Open State Championship Night Matches Tonight!
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                      Assigned Supervisor David: Ensure 800 LUX floodlight array is powered and line markings swept before 06:00 PM. First match starts at 08:00 PM.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto relative z-10">
                  <button
                    onClick={() => setActiveTab("emp_calendar")}
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-xs shadow-md transition-all whitespace-nowrap"
                  >
                    View Slot Calendar →
                  </button>
                </div>
              </div>

              {/* 3 High-Visibility Coach KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* 1. Allotted Sport & Supervised Arenas */}
                <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider mb-2">
                      ALLOTTED SPORT & ARENAS
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                      Tennis
                    </div>
                    <p className="text-xs text-emerald-800 mt-1.5 font-medium">
                      3 Arenas under supervision
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-200/60 text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span>Shift: <strong>Morning Roster</strong></span>
                    <span className="text-emerald-700 font-bold">● Active</span>
                  </div>
                </div>

                {/* 2. Next Upcoming Session */}
                <div className="p-5 rounded-2xl bg-sky-50/80 border border-sky-200/90 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-sky-900 uppercase tracking-wider mb-2">
                      IMMEDIATE NEXT SESSION
                    </div>
                    <div className="text-base sm:text-lg font-black text-slate-900 truncate font-[family-name:var(--font-outfit)]">
                      Dev Patel (Trial Evaluation)
                    </div>
                    <p className="text-xs text-sky-800 mt-1.5 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-700" />
                      <span>03:00 PM – 04:00 PM (Grass #1)</span>
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-sky-200/60 text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span>Status: <strong>Checked-In</strong></span>
                    <button
                      onClick={() => showToast("Starting drill sequence on Centre Grass Court #1...")}
                      className="text-sky-800 font-bold hover:underline"
                    >
                      Start Drills →
                    </button>
                  </div>
                </div>

                {/* 3. Surface & Equipment Readiness */}
                <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-extrabold text-amber-900 uppercase tracking-wider mb-2">
                      SURFACE & NET READINESS
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                      100% Prepared
                    </div>
                    <p className="text-xs text-amber-800 mt-1.5 font-medium">
                      Grass 8.5mm cut & clay moisture optimal
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-amber-200/60 text-xs font-semibold text-slate-600 flex items-center justify-between">
                    <span>Stringing jobs: <strong>1 Ready</strong></span>
                    <button
                      onClick={() => setActiveTab("emp_maintenance")}
                      className="text-amber-800 font-bold hover:underline"
                    >
                      View Logs ↓
                    </button>
                  </div>
                </div>
              </div>

              {/* LIVE ARENA ALLOTMENT STATUS GRID */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Live Supervised Court Zones & Status</span>
                  </h3>
                  <span className="text-xs font-bold text-slate-500">Auto-refreshed live</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Zone 1 */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900">
                        NATURAL GRASS
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        OCCUPIED
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">Centre Grass Court #1</div>
                      <div className="text-xs text-slate-500 mt-0.5">Wimbledon Specification Lawn (8mm)</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Current:</span>
                        <strong className="text-slate-800">Dev Patel (Trial Candidate)</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Next (05 PM):</span>
                        <strong className="text-emerald-700">Alex Morgan (Gold VIP)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Zone 2 */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900">
                        EUROPEAN CLAY
                      </span>
                      <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        READY FOR PLAY
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">Roland-Garros Red Clay #3</div>
                      <div className="text-xs text-slate-500 mt-0.5">Crushed Brick & Moisture Balanced</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Rolled & Swept:</span>
                        <strong className="text-slate-800">01:30 PM by Manoj</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Next (06:30 PM):</span>
                        <strong className="text-amber-700">Meera Singhania (Coaching)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Zone 3 */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-900">
                        HARD COURT
                      </span>
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        OPEN FOR DRILLS
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">Grandstand Synthetic Court #2</div>
                      <div className="text-xs text-slate-500 mt-0.5">US Open DecoTurf 8-Layer Cushion</div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Ball Machine:</span>
                        <strong className="text-slate-800">Lobster Grand V Loaded</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Available until:</span>
                        <strong className="text-indigo-700">07:00 PM Open Play</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DAILY DUTY CHECKLIST */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                    <span>Daily Shift Duty Checklist (Oct 03, 2026)</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {checklist.filter((c) => c.done).length} / {checklist.length} Completed
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        item.done
                          ? "bg-white border-emerald-200 text-slate-500 line-through"
                          : "bg-white border-slate-200 text-slate-800 font-bold hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border ${
                          item.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                        }`}>
                          {item.done && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className="text-xs">{item.text}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        {item.done ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: COURT SLOT CALENDAR & BOOKINGS                         */}
          {/* ============================================================ */}
          {activeTab === "emp_calendar" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <CalendarCheck className="w-6 h-6 text-emerald-600" />
                    <span>Court Slot Calendar & Booked Roster</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live schedule of member bookings and private coaching slots for your allotted courts.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={courtFilter}
                    onChange={(e) => setCourtFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="ALL">🏟️ All Allotted Courts</option>
                    <option value="Centre Grass">Grass Court #1</option>
                    <option value="Clay">Clay Arena #3</option>
                    <option value="Synthetic">Synthetic #2</option>
                  </select>

                  <select
                    value={slotTypeFilter}
                    onChange={(e) => setSlotTypeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="ALL">🎯 All Session Types</option>
                    <option value="MEMBER_BOOKING">Member Bookings</option>
                    <option value="COACHING_SESSION">1-on-1 Coaching</option>
                    <option value="TOURNAMENT_MATCH">Tournament Matches</option>
                  </select>
                </div>
              </div>

              {/* Slots List */}
              <div className="space-y-3">
                {filteredSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-20 text-center shrink-0 p-2 rounded-xl bg-slate-900 text-white font-mono shadow-xs">
                        <span className="block text-[9px] uppercase font-bold text-emerald-400">TIME</span>
                        <span className="block text-xs font-black">{slot.timeSlot.split("–")[0]}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{slot.memberName}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                            {slot.memberTier}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          🏟️ {slot.courtName} • {slot.sport}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => showToast(`Court ${slot.courtName} drills marked ready!`)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200"
                    >
                      Court Check Ready
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: ASSIGNED TRAINEES                                     */}
          {/* ============================================================ */}
          {activeTab === "emp_trainees" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-emerald-600" />
                    <span>Assigned Academy Trainees & Students</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track skill levels, drills progression, and NTRP ratings.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {traineesList.map((tr) => (
                  <div key={tr.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{tr.name}</h4>
                        <p className="text-xs text-slate-500">{tr.skillLevel} • {tr.tier}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        {tr.totalSessionsCompleted} Sessions
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-700">
                      <strong className="text-slate-900 block mb-0.5">Focus Area:</strong>
                      {tr.focusArea}
                    </div>

                    <p className="text-[11px] text-slate-500 italic">
                      &quot;{tr.lastProgressNote}&quot;
                    </p>

                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Next: {tr.nextSessionDate}</span>
                      <button
                        onClick={() => {
                          setSelectedTraineeForNote(tr);
                          setNewProgressNote("");
                          setNoteSuccess(false);
                        }}
                        className="text-emerald-700 font-bold hover:underline"
                      >
                        + Add Progress Note
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: COURT READINESS & MAINTENANCE LOGS                    */}
          {/* ============================================================ */}
          {activeTab === "emp_maintenance" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <Wrench className="w-6 h-6 text-emerald-600" />
                    <span>Court Readiness & Equipment Maintenance Logs</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live surface inspection logs, floodlights, stringing workshop tickets.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReportIssueModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-xs"
                >
                  + Report Issue
                </button>
              </div>

              <div className="space-y-3">
                {maintenanceList.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">{task.courtName}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                          {task.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{task.notes}</p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">{task.scheduledTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: STAFF ROSTER & ACCESS DELEGATOR                       */}
          {/* ============================================================ */}
          {activeTab === "emp_roster" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <Users className="w-6 h-6 text-emerald-600" />
                    <span>Staff Roster & Department Governance</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    View active employees, sport coaches, and delegate custom access permissions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto"
                >
                  <Key className="w-4 h-4" />
                  <span>Grant Role Access by Gmail</span>
                </button>
              </div>

              {/* Search & Filters */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search staff by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-white border border-slate-200 font-bold text-slate-700"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">👑 Owner</option>
                  <option value="ADMIN">🛡️ Admin</option>
                  <option value="COACH">🎾 Coach</option>
                  <option value="STAFF">🧑‍💼 Staff</option>
                </select>
              </div>

              {/* Roster Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Role Tier</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users
                      .filter((u) => {
                        const matchQ = (u.first_name + " " + u.last_name + " " + u.email).toLowerCase().includes(searchQuery.toLowerCase());
                        const matchR = roleFilter === "ALL" || u.role === roleFilter;
                        return matchQ && matchR;
                      })
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900">{u.first_name} {u.last_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-bold">
                            {u.department || "Lawn Tennis"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignForm({
                                  email: u.email,
                                  role: u.role,
                                  department: u.department || "LAWN_TENNIS",
                                  first_name: u.first_name,
                                  last_name: u.last_name,
                                });
                                setShowAssignModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px]"
                            >
                              Edit Access
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: CRM INQUIRIES & TRIAL SESSIONS                        */}
          {/* ============================================================ */}
          {activeTab === "emp_inquiries" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-emerald-600" />
                    <span>CRM Coaching & Trial Inquiries</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prospective member requests and coaching evaluations assigned to you.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { id: "CRM-2041", title: "VIP Wimbledon Grass Court Private Coaching Request", applicant: "Alex Morgan (Gold VIP)", status: "APPROVED", date: "Today, 10:30 AM", notes: "Assigned Head Coach David for weekend morning sessions." },
                  { id: "CRM-1995", title: "Academy Trial Session for Junior U-16 Evaluation", applicant: "Dev Patel (Junior Candidate)", status: "SCHEDULED", date: "Today, 03:00 PM", notes: "Applicant is applying for the Junior Elite Training Program." }
                ].map((inq) => (
                  <div key={inq.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{inq.title}</h4>
                        <p className="text-[11px] text-slate-500">{inq.applicant}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        {inq.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {inq.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 7: STAFF PROFILE & SETTINGS                              */}
          {/* ============================================================ */}
          {activeTab === "emp_settings" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <Settings className="w-6 h-6 text-emerald-600" />
                    <span>Staff Profile & Sport Certification Settings</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage shift availability, court equipment licenses, and emergency contacts.
                  </p>
                </div>
              </div>

              <div className="space-y-4 max-w-xl text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Supervisor Designation</label>
                  <input
                    type="text"
                    disabled
                    value="Head Coach & Tennis Arena Supervisor"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Department</label>
                  <input
                    type="text"
                    disabled
                    value="Lawn Tennis Arenas (Wimbledon Grass & French Clay)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Roster Shift Timing</label>
                  <input
                    type="text"
                    disabled
                    value="Morning Shift (06:00 AM – 02:00 PM)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => showToast("Employee shift preferences saved!")}
                  className="py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-sm"
                >
                  Save Shift Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: REPORT COURT ISSUE                                  */}
      {/* ============================================================ */}
      {showReportIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-base">Report Court Readiness Issue</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportIssueModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Arena / Court</label>
                <select
                  value={issueCourt}
                  onChange={(e) => setIssueCourt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  <option value="Centre Grass Court #1">Centre Grass Court #1 (Natural Lawn)</option>
                  <option value="Roland-Garros Red Clay #3">Roland-Garros Red Clay Arena #3</option>
                  <option value="Grandstand Synthetic Court #2">Grandstand Synthetic Court #2</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Issue Category</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  <option value="NET_TENSION">Net Tension Adjustment (Needs 36&quot; gauge)</option>
                  <option value="LIGHTING_CHECK">Floodlight Bulb Check (800 LUX array)</option>
                  <option value="GRASS_MOWING">Lawn Rolling & Marking Sweep</option>
                  <option value="STRINGING_JOB">Urgent Racket Stringing Intake</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Issue Notes & Details</label>
                <textarea
                  rows={3}
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="Describe surface condition or maintenance needed..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReportIssueModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Maintenance ticket logged for ${issueCourt}`);
                  setShowReportIssueModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-sm"
              >
                Submit Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: ASSIGN ROLE ACCESS BY GMAIL ID                      */}
      {/* ============================================================ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base">Delegate Staff Access by Gmail</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignAccess} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">User Gmail ID</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. employee@gmail.com"
                  value={assignForm.email}
                  onChange={(e) => setAssignForm({ ...assignForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Staff Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Vikram Mehta"
                  value={assignForm.first_name}
                  onChange={(e) => setAssignForm({ ...assignForm, first_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Role Permission</label>
                <select
                  value={assignForm.role}
                  onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  <option value="COACH">🎾 Head Coach / Sport Supervisor</option>
                  <option value="STAFF">🧑‍💼 Operations Staff</option>
                  <option value="ADMIN">🛡️ Club Administrator</option>
                  <option value="MANAGER">👔 Department Manager</option>
                  {isSuperOwner && <option value="OWNER">👑 Sovereign Co-Owner</option>}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Assigned Department</label>
                <select
                  value={assignForm.department}
                  onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.icon} {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/20"
                >
                  Grant Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: ADD PROGRESS NOTE                                   */}
      {/* ============================================================ */}
      {selectedTraineeForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base">Progress Note: {selectedTraineeForNote.name}</h3>
              <button
                type="button"
                onClick={() => setSelectedTraineeForNote(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <textarea
              rows={3}
              value={newProgressNote}
              onChange={(e) => setNewProgressNote(e.target.value)}
              placeholder="Record technical improvements, drills score, or kinetic analysis..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:border-emerald-500"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedTraineeForNote(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  showToast(`Progress note saved for ${selectedTraineeForNote.name}`);
                  setSelectedTraineeForNote(null);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
