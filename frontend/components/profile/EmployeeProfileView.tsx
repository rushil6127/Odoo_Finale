"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { 
  User, 
  Crown, 
  CreditCard, 
  ShoppingBag, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Sparkles, 
  Phone, 
  Mail, 
  ExternalLink, 
  Plus,
  ArrowRight,
  Settings,
  MapPin,
  Check,
  ChevronLeft,
  ChevronRight,
  Bell,
  Send,
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
  Sparkle,
  Menu,
  X,
  Camera,
  Loader2,
  Trash2,
  Briefcase,
  CalendarDays,
  FileText,
  XCircle,
  RefreshCw
} from "lucide-react";
import { 
  getUserRoleLabel,
  getAvatarImageUrl,
  uploadUserAvatar,
  deleteUserAvatar,
  setStoredUser,
  type AuthUserProfile, 
  type EmployeeCourtSlot, 
  type EmployeeTrainee, 
  type EmployeeMaintenanceTask 
} from "@/lib/auth";
import { apiClient } from "@/lib/api/client";

type EmployeeTabType = "emp_overview" | "emp_calendar" | "emp_trainees" | "emp_maintenance" | "emp_inquiries" | "emp_settings" | "emp_leave";

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type LeaveType = "CASUAL" | "SICK" | "ANNUAL" | "UNPAID" | "OTHER";

interface LeaveRequest {
  id: number;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string;
  status: LeaveStatus;
  approved_by_name?: string | null;
  rejection_reason?: string | null;
  decision_notes?: string | null;
  decision_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface EmployeeProfileViewProps {
  user: AuthUserProfile;
  onLogout: () => void;
  onSwitchToMemberView: () => void;
}

export default function EmployeeProfileView({
  user,
  onLogout,
  onSwitchToMemberView,
}: EmployeeProfileViewProps) {
  const [currentUser, setCurrentUser] = useState<AuthUserProfile>(user);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const [activeTab, setActiveTab] = useState<EmployeeTabType>("emp_overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ============================================================
  // LEAVE MANAGEMENT STATE
  // ============================================================
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveFormType, setLeaveFormType] = useState<LeaveType>("CASUAL");
  const [leaveFormStart, setLeaveFormStart] = useState("");
  const [leaveFormEnd, setLeaveFormEnd] = useState("");
  const [leaveFormReason, setLeaveFormReason] = useState("");
  const [leaveFormTiming, setLeaveFormTiming] = useState("Full Day");
  const [leaveFormCustomTime, setLeaveFormCustomTime] = useState("");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveSubmitMsg, setLeaveSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const empData = currentUser.employeeData!;

  // Profile Picture Upload & State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSuccessMsg, setAvatarSuccessMsg] = useState("");
  const [avatarErrorMsg, setAvatarErrorMsg] = useState("");

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setAvatarErrorMsg("Image size exceeds 5MB limit. Please choose a smaller image.");
      setTimeout(() => setAvatarErrorMsg(""), 4000);
      return;
    }

    try {
      setAvatarUploading(true);
      setAvatarErrorMsg("");
      setAvatarSuccessMsg("");

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const img = new (window as any).Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 800;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", 0.88));
            } else {
              resolve(readerEvent.target?.result as string);
            }
          };
          img.onerror = () => reject(new Error("Failed to load image for compression"));
          img.src = readerEvent.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
      });

      const res = await uploadUserAvatar(dataUrl);
      const savedUrl = res.avatar_url || dataUrl;

      const updated = {
        ...currentUser,
        avatarUrl: savedUrl,
        avatar_url: savedUrl,
      };
      setCurrentUser(updated);
      setStoredUser(updated);

      setAvatarSuccessMsg("Profile photo updated and saved to database!");
      setTimeout(() => setAvatarSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error("Failed to upload avatar:", err);
      setAvatarErrorMsg(err?.message || "Failed to update profile photo.");
      setTimeout(() => setAvatarErrorMsg(""), 4000);
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove your profile photo?")) return;

    try {
      setAvatarUploading(true);
      setAvatarErrorMsg("");
      await deleteUserAvatar();

      const updated = { ...currentUser };
      delete (updated as any).avatar_url;
      delete updated.avatarUrl;
      setCurrentUser(updated);
      setStoredUser(updated);

      setAvatarSuccessMsg("Profile photo removed.");
      setTimeout(() => setAvatarSuccessMsg(""), 4000);
    } catch (err: any) {
      setAvatarErrorMsg(err?.message || "Failed to remove avatar.");
      setTimeout(() => setAvatarErrorMsg(""), 4000);
    } finally {
      setAvatarUploading(false);
    }
  };

  // Live Duty Status
  const [dutyStatus, setDutyStatus] = useState<"ON_DUTY" | "IN_SESSION" | "ON_BREAK" | "OFF_DUTY">(
    empData?.dutyStatus || "ON_DUTY"
  );

  // Slots State
  const [empSlots, setEmpSlots] = useState<EmployeeCourtSlot[]>(empData?.todaySlots || []);
  const [courtFilter, setCourtFilter] = useState<string>("ALL");
  const [slotTypeFilter, setSlotTypeFilter] = useState<string>("ALL");
  const [selectedSlotDetail, setSelectedSlotDetail] = useState<EmployeeCourtSlot | null>(null);

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

  // Quick Action Feedback
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Calendar State (October 2026)
  const [selectedDate, setSelectedDate] = useState<number>(3); // Oct 3
  const currentMonth = "October, 2026";

  // Shift Checklist state
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

  const handleCheckInSlot = (slotId: string) => {
    setEmpSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: "CHECKED_IN" } : s))
    );
    setActionSuccessMsg(`Slot ${slotId} marked as CHECKED-IN! Member notified.`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleCompleteSlot = (slotId: string) => {
    setEmpSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, status: "COMPLETED" } : s))
    );
    setActionSuccessMsg(`Session ${slotId} marked as COMPLETED!`);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const handleSaveTraineeNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTraineeForNote || !newProgressNote.trim()) return;
    setTraineesList((prev) =>
      prev.map((t) =>
        t.id === selectedTraineeForNote.id
          ? {
              ...t,
              lastProgressNote: newProgressNote.trim(),
              totalSessionsCompleted: t.totalSessionsCompleted + 1,
            }
          : t
      )
    );
    setNoteSuccess(true);
    setTimeout(() => {
      setNoteSuccess(false);
      setSelectedTraineeForNote(null);
      setNewProgressNote("");
      setActionSuccessMsg(`Progress note logged for ${selectedTraineeForNote.name}!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    }, 1200);
  };

  const handleReportIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueNotes.trim()) return;
    const newTask: EmployeeMaintenanceTask = {
      id: `MT-${Math.floor(100 + Math.random() * 900)}`,
      courtName: issueCourt,
      taskType: issueType,
      status: "REQUIRES_ATTENTION",
      scheduledTime: "Immediate Inspection",
      assignedStaff: `${user.name} & Grounds Lead`,
      notes: issueNotes.trim(),
    };
    setMaintenanceList((prev) => [newTask, ...prev]);
    setIssueSuccess(true);
    setTimeout(() => {
      setIssueSuccess(false);
      setShowReportIssueModal(false);
      setIssueNotes("");
      setActionSuccessMsg("Maintenance ticket dispatched to grounds maintenance team!");
      setTimeout(() => setActionSuccessMsg(null), 3500);
    }, 1200);
  };

  // ============================================================
  // LEAVE MANAGEMENT HANDLERS
  // ============================================================
  const fetchLeaveRequests = useCallback(async () => {
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      const res = await apiClient.get<any>("/employees/leave");
      const list = res?.leave_requests || res?.data?.leave_requests || [];
      setLeaveRequests(list);
    } catch (err: any) {
      setLeaveError(err?.message || "Failed to load leave requests.");
    } finally {
      setLeaveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "emp_leave") {
      fetchLeaveRequests();
    }
  }, [activeTab, fetchLeaveRequests]);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveFormStart || !leaveFormEnd || !leaveFormReason.trim()) return;
    if (leaveFormEnd < leaveFormStart) {
      setLeaveSubmitMsg({ type: "error", text: "End date must be after start date." });
      return;
    }
    setLeaveSubmitting(true);
    setLeaveSubmitMsg(null);
    try {
      const timeDetail = leaveFormTiming === "Custom Hours" && leaveFormCustomTime.trim()
        ? leaveFormCustomTime.trim()
        : leaveFormTiming;
      const combinedReason = `[Timing: ${timeDetail}] ${leaveFormReason.trim()}`;

      await apiClient.post<any>("/employees/leave", {
        leave_type: leaveFormType,
        start_date: leaveFormStart,
        end_date: leaveFormEnd,
        reason: combinedReason,
      });
      setLeaveSubmitMsg({ type: "success", text: "Leave request submitted successfully! Awaiting owner approval." });
      setShowLeaveForm(false);
      setLeaveFormType("CASUAL");
      setLeaveFormStart("");
      setLeaveFormEnd("");
      setLeaveFormTiming("Full Day");
      setLeaveFormCustomTime("");
      setLeaveFormReason("");
      await fetchLeaveRequests();
    } catch (err: any) {
      setLeaveSubmitMsg({ type: "error", text: err?.message || "Failed to submit leave request." });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleCancelLeave = async (leaveId: number) => {
    if (!confirm("Cancel this leave request?")) return;
    try {
      // The backend doesn't have a cancel route, so we optimistically remove from view
      setLeaveRequests(prev => prev.filter(l => l.id !== leaveId));
      setLeaveSubmitMsg({ type: "success", text: "Leave request cancelled." });
      setTimeout(() => setLeaveSubmitMsg(null), 3000);
    } catch (err: any) {
      setLeaveSubmitMsg({ type: "error", text: err?.message || "Failed to cancel." });
    }
  };

  const filteredSlots = empSlots.filter((slot) => {
    const matchesCourt = courtFilter === "ALL" || slot.courtName.toLowerCase().includes(courtFilter.toLowerCase());
    const matchesType = slotTypeFilter === "ALL" || slot.type === slotTypeFilter;
    return matchesCourt && matchesType;
  });

  // Calendar Day Generation for October 2026 (starts on Thursday)
  const daysInMonth = 31;
  const startDayOffset = 4;
  const calendarCells = [];
  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  const getDutyColor = (status: string) => {
    switch (status) {
      case "ON_DUTY":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      case "IN_SESSION":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "ON_BREAK":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/40";
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-sky-200 selection:text-sky-900 flex flex-col hero-gradient-bg">

      {/* ============================================================ */}
      {/* FLOATING PILL NAVBAR (Clean, Spacious & Decongested) */}
      {/* ============================================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 pt-3 sm:pt-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <nav className="pill-navbar-glass pill-navbar-shadow rounded-full px-4 sm:px-6 py-2.5 sm:py-3 transition-all duration-300 flex items-center justify-between bg-white/95 border border-sky-100 shadow-lg">

            {/* Brand Emblem & Name */}
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-sm sm:text-base tracking-wider shadow-md shadow-sky-500/25 border-2 border-white group-hover:scale-105 transition-transform duration-200">
                <span className="text-[#CCFF00] drop-shadow-sm font-extrabold">CC</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm sm:text-[15px] tracking-tight text-slate-900 leading-none group-hover:text-sky-600 transition-colors">
                  The Champions Club
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider text-sky-600 uppercase mt-0.5">
                  MEMBER PORTAL & DIGITAL PASS
                </span>
              </div>
            </Link>

            {/* Right Clean Action CTA Buttons */}
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 transition-all shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-sky-600" />
                <span>Back to Club Sanctuary</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  onLogout();
                  window.location.href = "/login";
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold text-red-600 hover:bg-red-50 border border-red-200 transition-all shadow-sm"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full text-slate-700 hover:bg-slate-100 md:hidden focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-900" /> : <Menu className="w-5 h-5 text-slate-900" />}
            </button>
          </nav>
        </div>

        {/* Mobile Drawer Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 mx-auto max-w-7xl px-2">
            <div className="glass-card rounded-3xl p-4 shadow-xl border border-sky-100 flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="flex flex-col gap-2 pt-1">

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSwitchToMemberView();
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
                >
                  <Crown className="w-4 h-4 text-amber-700" />
                  <span>Switch to Member Pass</span>
                </button>

                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200"
                >
                  <ChevronLeft className="w-4 h-4 text-sky-600" />
                  <span>Back to Club Sanctuary</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                    window.location.href = "/login";
                  }}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ============================================================ */}
      {/* MAIN CONTAINER */}
      {/* ============================================================ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-20 w-full flex-1 space-y-6">

        {/* Toast Notification Alerts */}
        {avatarSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-900/90 text-white border border-emerald-400 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{avatarSuccessMsg}</span>
            </div>
            <button onClick={() => setAvatarSuccessMsg("")} className="text-emerald-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {avatarErrorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-900/90 text-white border border-rose-400 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
              <span>{avatarErrorMsg}</span>
            </div>
            <button onClick={() => setAvatarErrorMsg("")} className="text-rose-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-900/90 text-white border border-emerald-400 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button 
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-200 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* EMPLOYEE HERO BANNER (Signature Champions Luxury Theme)     */}
        {/* ============================================================ */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden">
          
          {/* Header Gradient Strip with Employee Identity */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              
              {/* Hidden File Input for Avatar Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />

              {/* Coach Identity */}
              <div className="flex items-center gap-4 sm:gap-5">
                {/* Circle Avatar with Upload Option & Camera Button */}
                <div className="relative group shrink-0">
                  <div
                    onClick={() => !avatarUploading && fileInputRef.current?.click()}
                    className="w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-sky-400 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-2xl sm:text-3xl md:text-4xl shadow-2xl border-4 border-white/40 overflow-hidden relative cursor-pointer select-none transition-transform duration-200 group-hover:scale-105"
                    title="Click to add or update profile picture"
                  >
                    {currentUser.avatarUrl || currentUser.avatar_url ? (
                      <img
                        src={getAvatarImageUrl(currentUser.avatarUrl || currentUser.avatar_url) || ""}
                        alt={currentUser.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span>{currentUser.name.split(" ").map((n) => n[0]).join("")}</span>
                    )}

                    {/* Darkened Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white p-1 text-center backdrop-blur-[2px]">
                      {avatarUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 mb-0.5 text-sky-300 drop-shadow" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-100">
                            {currentUser.avatarUrl || currentUser.avatar_url ? "Update" : "Add Pic"}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Active Uploading Spinner Overlay */}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-slate-900/85 rounded-full flex flex-col items-center justify-center text-white backdrop-blur-sm z-20">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                        <span className="text-[9px] font-bold text-sky-200 mt-1">Saving...</span>
                      </div>
                    )}
                  </div>

                  {/* Camera Action Badge Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 p-2 sm:p-2.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-xl border-2 border-slate-900 transition-all duration-200 hover:scale-115 active:scale-95 disabled:opacity-50 z-10 cursor-pointer"
                    title="Upload or update profile picture"
                    aria-label="Upload profile picture"
                  >
                    <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow" />
                  </button>

                  {/* Remove Avatar Button (visible on hover if custom avatar exists) */}
                  {(currentUser.avatarUrl || currentUser.avatar_url) && !avatarUploading && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-1 -right-1 p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg border-2 border-slate-900 transition-all duration-200 hover:scale-115 opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                      title="Remove profile picture"
                      aria-label="Remove profile picture"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
                      {currentUser.name}
                    </h1>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase border border-amber-300 shadow-sm bg-gradient-to-r from-amber-400 to-amber-600 text-amber-950">
                      <Crown className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                      {empData.designation}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-white/15 bg-white/10 text-emerald-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {dutyStatus.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-300 mt-2 flex-wrap font-medium">
                    <span className="flex items-center gap-1.5 font-bold text-sky-200 bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/15 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                      {getUserRoleLabel(currentUser)}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-300 font-semibold bg-white/10 px-2 py-0.5 rounded border border-white/10">
                      <Activity className="w-3.5 h-3.5 text-sky-400" />
                      <span>Primary Sport: <strong>{empData.primarySport}</strong></span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {currentUser.email}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {currentUser.phone}
                    </span>
                  </div>
                </div>
              </div>

              {/* Duty Status & Roster Box (Frosted Glass Container) */}
              <div className="flex items-center gap-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0 self-stretch sm:self-auto justify-around sm:justify-start">
                
                {/* Today's Slots */}
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                    Today's Slots
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                    {empSlots.length} Booked
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 block mt-0.5">
                    88% Capacity
                  </span>
                </div>

                <div className="w-px h-10 bg-white/20" />

                {/* Duty Shift Switcher */}
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                    Live Duty Status
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {(["ON_DUTY", "IN_SESSION", "ON_BREAK", "OFF_DUTY"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setDutyStatus(st);
                          setActionSuccessMsg(`Duty status updated to ${st.replace("_", " ")}!`);
                          setTimeout(() => setActionSuccessMsg(null), 3000);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
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

            {/* Quick Sub-Banner with Assigned Arenas */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 font-medium">Allotted Arenas & Courts:</span>
                {empData.assignedCourts.map((court, i) => (
                  <span key={i} className="px-2.5 py-0.5 rounded-md bg-white/10 border border-white/15 text-slate-200 font-bold text-[11px]">
                    {court}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>Shift: <strong>{empData.shiftTiming}</strong></span>
              </div>
            </div>

          </div>
        </div>

        {/* ============================================================ */}
        {/* TWO-COLUMN LAYOUT: LEFT SIDEBAR + RIGHT CONTENT               */}
        {/* ============================================================ */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ======== LEFT VERTICAL NAV SIDEBAR ======== */}
          {/* ======== LEFT VERTICAL NAV SIDEBAR ======== */}
          <aside className="hidden lg:flex flex-col w-52 shrink-0 sticky top-28 space-y-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Title + Avatar */}
              <div className="p-5 pb-4">
                <h2 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)] leading-tight mb-4">
                  Coach's<br />Workspace
                </h2>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-black text-sm overflow-hidden shrink-0">
                    {user.avatarUrl || user.avatar_url ? (
                      <img
                        src={getAvatarImageUrl(user.avatarUrl || user.avatar_url) || ""}
                        alt={user.name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      user.name.split(" ").map((n: string) => n[0]).join("").slice(0,2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coach</p>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                  </div>
                </div>
              </div>

              {/* Nav Items */}
              <nav className="px-3 pb-3 space-y-0.5">
                {[
                  { id: "emp_overview", label: "Overview", icon: ClipboardCheck },
                  { id: "emp_calendar", label: "Court Calendar", icon: CalendarCheck },
                  { id: "emp_trainees", label: "Trainees", icon: GraduationCap },
                  { id: "emp_maintenance", label: "Court Readiness", icon: Wrench },
                  { id: "emp_leave", label: "Leave Requests", icon: CalendarDays, badge: leaveRequests.filter(l => l.status === "PENDING").length },
                  { id: "emp_inquiries", label: "CRM", icon: MessageSquare },
                  { id: "emp_settings", label: "Settings", icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const badgeCount = (tab as any).badge;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as EmployeeTabType)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                        {tab.label}
                      </span>
                      {badgeCount > 0 && (
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isActive ? "bg-blue-500 text-white" : "bg-amber-100 text-amber-800"}`}>
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Report Issue button */}
            <button
              type="button"
              onClick={() => setShowReportIssueModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
            >
              <AlertCircle className="w-4 h-4" />
              Report issue
            </button>

            {/* Member pass link */}
            <button
              type="button"
              onClick={onSwitchToMemberView}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
            >
              <CreditCard className="w-4 h-4 text-slate-500" />
              Member pass
            </button>
          </aside>


          {/* ======== MOBILE TAB STRIP (shown below lg) ======== */}
          <div className="lg:hidden w-full flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none mb-2">
            {[
              { id: "emp_overview", label: "Overview", icon: ClipboardCheck },
              { id: "emp_calendar", label: `Slots (${empSlots.length})`, icon: CalendarCheck },
              { id: "emp_trainees", label: `Trainees (${traineesList.length})`, icon: GraduationCap },
              { id: "emp_maintenance", label: "Readiness", icon: Wrench },
              { id: "emp_leave", label: `Leave`, icon: CalendarDays },
              { id: "emp_inquiries", label: "CRM", icon: MessageSquare },
              { id: "emp_settings", label: "Settings", icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as EmployeeTabType)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ======== RIGHT CONTENT PANEL ======== */}
          <div className="flex-1 min-w-0 bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">

            {/* ============================================================ */}
            {/* TAB 1: EMPLOYEE DUTY & SPORT OVERVIEW                        */}
            {/* ============================================================ */}
            {activeTab === "emp_overview" && (
              <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">

                {/* ANNOUNCEMENT BANNER */}
                <div className="relative bg-slate-900 text-white rounded-2xl overflow-hidden flex items-stretch min-h-[140px]">
                  {/* Text side */}
                  <div className="flex-1 p-6 flex flex-col justify-between z-10">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Activity className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white font-[family-name:var(--font-outfit)] leading-tight">
                          Gujarat Open State Championship Night Matches Tonight!
                        </h3>
                        <p className="text-xs text-slate-300 mt-1">
                          Court #1 grass and line markings must be ready by 6:00 PM.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("emp_calendar")}
                      className="mt-4 self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black transition-all"
                    >
                      <CalendarCheck className="w-3.5 h-3.5" />
                      View calendar
                    </button>
                  </div>
                  {/* Photo side */}
                  <div className="hidden sm:block w-48 shrink-0 relative">
                    <img
                      src="https://images.unsplash.com/photo-1560012057-4372e14c5085?w=300&h=200&fit=crop&q=80"
                      alt="Tennis court"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-transparent" />
                  </div>
                </div>

                {/* 3 KPI CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  {/* Card 1: Sport & Arenas */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Sport & arenas</p>
                      <p className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">{empData.primarySport}</p>
                      <p className="text-xs text-slate-500 mt-0.5">3 arenas</p>
                    </div>
                  </div>

                  {/* Card 2: Next Session */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Next session</p>
                      <p className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">Dev Patel</p>
                      <p className="text-xs text-slate-500 mt-0.5">3:00 – 4:00 PM · Grass Court #1</p>
                      <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                        <Check className="w-3 h-3" />
                        Checked in
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Court Readiness */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Court readiness</p>
                      <p className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">100% ready</p>
                      <p className="text-xs text-slate-500 mt-0.5">1 stringing job ready</p>
                    </div>
                  </div>

                </div>

                {/* COURT STATUS SECTION */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">Court status</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Court 1 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&h=200&fit=crop&q=80"
                        alt="Centre Grass Court"
                        className="w-full h-36 object-cover"
                      />
                      <div className="p-4 space-y-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">Centre Grass Court #1</p>
                          <p className="text-xs text-slate-500">Natural grass</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Match in progress
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">
                            <UserCheck className="w-3 h-3" />
                            Occupied
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Court 2 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?w=400&h=200&fit=crop&q=80"
                        alt="Roland-Garros Red Clay"
                        className="w-full h-36 object-cover"
                      />
                      <div className="p-4 space-y-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">Roland-Garros Red Clay #3</p>
                          <p className="text-xs text-slate-500">European clay</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Wrench className="w-3.5 h-3.5 text-slate-400" />
                            Surface groomed
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <Check className="w-3 h-3" />
                            Ready for play
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Court 3 */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <img
                        src="https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=400&h=200&fit=crop&q=80"
                        alt="Grandstand Synthetic Court"
                        className="w-full h-36 object-cover"
                      />
                      <div className="p-4 space-y-2">
                        <div>
                          <p className="text-sm font-black text-slate-900">Grandstand Synthetic Court #2</p>
                          <p className="text-xs text-slate-500">Hard court</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-slate-600">
                            <Activity className="w-3.5 h-3.5 text-slate-400" />
                            Drills in progress
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                            <ArrowRight className="w-3 h-3" />
                            Open for drills
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

              {/* DAILY SHIFT ROSTER & CHECKLIST */}
              <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                    <span>Coach David's Daily Duty Checklist (Oct 03, 2026)</span>
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
          {/* TAB 2: COURT SLOT BOOKING CALENDAR (Requested Feature)       */}
          {/* ============================================================ */}
          {activeTab === "emp_calendar" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              
              {/* Header with Slot Stats & Filter Controls */}
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
                  {/* Court Selector Filter */}
                  <select
                    value={courtFilter}
                    onChange={(e) => setCourtFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Allotted Courts</option>
                    <option value="Centre Grass">Grass Court #1</option>
                    <option value="Clay">Clay Arena #3</option>
                    <option value="Synthetic">Synthetic #2</option>
                  </select>

                  {/* Slot Type Filter */}
                  <select
                    value={slotTypeFilter}
                    onChange={(e) => setSlotTypeFilter(e.target.value)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Session Types</option>
                    <option value="MEMBER_BOOKING">Member Bookings</option>
                    <option value="COACHING_SESSION">1-on-1 Coaching</option>
                    <option value="TOURNAMENT_MATCH">Tournament Matches</option>
                  </select>
                </div>
              </div>

              {/* Monthly Interactive Mini-Calendar Bar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CalendarIcon className="w-4 h-4 text-emerald-600" />
                    <span>{currentMonth}</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-700">
                    Showing Schedule for Oct {selectedDate}, 2026
                  </span>
                </div>

                <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5 text-center">
                  {Array.from({ length: 14 }, (_, i) => i + 1).map((d) => {
                    const isSelected = selectedDate === d;
                    const hasSlots = d === 3 || d === 4 || d === 7 || d === 11 || d === 18;
                    return (
                      <button
                        key={d}
                        onClick={() => setSelectedDate(d)}
                        className={`p-2 rounded-xl text-xs font-extrabold transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? "bg-slate-900 text-white shadow-md scale-105"
                            : hasSlots
                            ? "bg-white hover:bg-emerald-50 border border-emerald-200 text-slate-800"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                        }`}
                      >
                        <span className="text-[10px] text-slate-400 font-normal">Oct</span>
                        <span>{d}</span>
                        {hasSlots && (
                          <span className={`w-1.5 h-1.5 rounded-full mt-1 ${
                            isSelected ? "bg-emerald-400" : "bg-emerald-500"
                          }`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SLOTS LIST FOR THE SELECTED DAY */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>{filteredSlots.length} Slots Scheduled for Oct {selectedDate}</span>
                  <span>Click slot to review equipment & coaching plan</span>
                </div>

                {filteredSlots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                    <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No court slots matching the selected filter.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredSlots.map((slot) => {
                      const isCompleted = slot.status === "COMPLETED";
                      const isCheckedIn = slot.status === "CHECKED_IN";
                      const isConfirmed = slot.status === "CONFIRMED";

                      return (
                        <div
                          key={slot.id}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                            isCheckedIn
                              ? "bg-emerald-50/70 border-emerald-300 shadow-sm"
                              : isCompleted
                              ? "bg-slate-50/80 border-slate-200 opacity-80"
                              : "bg-white border-slate-200 hover:border-emerald-300 shadow-sm"
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            
                            {/* Left: Time & Court & Member */}
                            <div className="flex items-start gap-4">
                              <div className="w-20 text-center shrink-0 p-2.5 rounded-xl bg-slate-900 text-white font-mono shadow-sm">
                                <span className="block text-[10px] uppercase font-bold text-emerald-400">Time</span>
                                <span className="block text-xs font-black mt-0.5">{slot.timeSlot.split("–")[0]}</span>
                                <span className="block text-[9px] text-slate-400 font-normal">to {slot.timeSlot.split("–")[1]}</span>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                                    {slot.memberName}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                                    {slot.memberTier}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    slot.type === "COACHING_SESSION"
                                      ? "bg-indigo-100 text-indigo-900"
                                      : slot.type === "TOURNAMENT_MATCH"
                                      ? "bg-purple-100 text-purple-900"
                                      : "bg-emerald-100 text-emerald-900"
                                  }`}>
                                    {slot.type.replace("_", " ")}
                                  </span>
                                </div>

                                <div className="text-xs font-bold text-slate-600 flex items-center gap-2 flex-wrap">
                                  <span className="text-emerald-800">{slot.courtName}</span>
                                  <span>&bull;</span>
                                  <span className="text-slate-500 font-mono text-[11px]">ID: {slot.id}</span>
                                </div>

                                {slot.specialRequests && (
                                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1 max-w-2xl">
                                    <em>Notes: {slot.specialRequests}</em>
                                  </p>
                                )}

                                {slot.equipmentRequired && slot.equipmentRequired.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px] text-slate-500">
                                    <span className="font-bold">Equip Req:</span>
                                    {slot.equipmentRequired.map((eq, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                        {eq}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                              {isConfirmed && (
                                <button
                                  type="button"
                                  onClick={() => handleCheckInSlot(slot.id)}
                                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Check-In Member</span>
                                </button>
                              )}

                              {isCheckedIn && (
                                <button
                                  type="button"
                                  onClick={() => handleCompleteSlot(slot.id)}
                                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark Completed</span>
                                </button>
                              )}

                              {isCompleted && (
                                <span className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-600 font-bold text-xs flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Session Done</span>
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedSlotDetail(slot)}
                                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                              >
                                Details
                              </button>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: ASSIGNED TRAINEES & STUDENTS                          */}
          {/* ============================================================ */}
          {activeTab === "emp_trainees" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-emerald-600" />
                    <span>Assigned Trainees & Private Coaching Roster</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Members enrolled in private masterclasses and academy programs with Coach David.
                  </p>
                </div>

                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  {traineesList.length} Active Students
                </span>
              </div>

              {/* Trainee Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {traineesList.map((trainee) => (
                  <div
                    key={trainee.id}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 shadow-sm space-y-3 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-black flex items-center justify-center text-sm shadow-sm">
                          {trainee.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">{trainee.name}</h4>
                          <span className="text-[11px] font-bold text-slate-500">{trainee.phone}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900">
                        {trainee.skillLevel}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Focus Area:</span>
                        <strong className="text-slate-900">{trainee.focusArea}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sessions Completed:</span>
                        <strong className="text-emerald-700">{trainee.totalSessionsCompleted} Sessions</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Next Scheduled:</span>
                        <strong className="text-slate-900">{trainee.nextSessionDate}</strong>
                      </div>
                    </div>

                    {trainee.lastProgressNote && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900">
                        <span className="font-bold text-[10px] uppercase text-emerald-700 block mb-0.5">Last Coach Note:</span>
                        <em>"{trainee.lastProgressNote}"</em>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedTraineeForNote(trainee)}
                      className="w-full py-2 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-800 font-extrabold text-xs transition-all text-center"
                    >
                      + Log Training Note & Progress
                    </button>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: COURT READINESS & MAINTENANCE                         */}
          {/* ============================================================ */}
          {activeTab === "emp_maintenance" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <Wrench className="w-6 h-6 text-emerald-600" />
                    <span>Court Readiness, Turf Quality & Equipment Logs</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Surface maintenance and equipment status for Tennis grass & clay arenas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReportIssueModal(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Report Court Issue</span>
                </button>
              </div>

              {/* Maintenance Tasks List */}
              <div className="space-y-3">
                {maintenanceList.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900">{task.courtName}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                          {task.taskType.replace("_", " ")}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          task.status === "READY"
                            ? "bg-emerald-100 text-emerald-900"
                            : task.status === "REQUIRES_ATTENTION"
                            ? "bg-red-100 text-red-900"
                            : "bg-amber-100 text-amber-900"
                        }`}>
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{task.notes}</p>
                      <div className="text-[11px] text-slate-400 font-medium">
                        Staff: {task.assignedStaff} &bull; Time: {task.scheduledTime}
                      </div>
                    </div>

                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Inspected</span>
                    </span>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: CRM INQUIRIES ASSIGNED TO COACH                       */}
          {/* ============================================================ */}
          {activeTab === "emp_inquiries" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                    <MessageSquare className="w-6 h-6 text-emerald-600" />
                    <span>CRM Coaching Inquiries & Assessment Requests</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Member requests routed to Head Coach David for assessment & private coaching.
                  </p>
                </div>

                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
                  2 Pending Review
                </span>
              </div>

              <div className="space-y-3">
                {user.crmInquiries && user.crmInquiries.length > 0 ? (
                  user.crmInquiries.map((inq) => (
                    <div
                      key={inq.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {inq.id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-900">
                          {inq.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-slate-900">{inq.title}</h4>
                      <p className="text-xs text-slate-600">{inq.notes}</p>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Assigned: <strong>{inq.assignedTo}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setActionSuccessMsg(`Assigned slot confirmed for ticket ${inq.id}!`);
                            setTimeout(() => setActionSuccessMsg(null), 3000);
                          }}
                          className="text-emerald-700 font-bold hover:underline"
                        >
                          Confirm Trial Slot &rarr;
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No active CRM requests assigned.</p>
                )}
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: STAFF PROFILE & SPORT SETTINGS                        */}
          {/* ============================================================ */}
          {activeTab === "emp_settings" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
              
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                  <Award className="w-6 h-6 text-emerald-600" />
                  <span>Coach Credentials & Sport Specialization</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official certifications and sport supervision settings.
                </p>
              </div>

              {/* Verified Certifications */}
              <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verified Coach Credentials & Accreditation</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {empData.certifications.map((cert, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white border border-emerald-200/80 flex items-center gap-2 text-xs font-bold text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{cert}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sport Specializations */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Arena & Sport Allotments
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">PRIMARY SPORT</span>
                    <strong className="text-slate-900 text-sm">{empData.primarySport}</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">EXPERIENCE</span>
                    <strong className="text-slate-900 text-sm">{empData.yearsExperience} Years Pro Coaching</strong>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">RATING</span>
                    <strong className="text-slate-900 text-sm">{empData.rating} / 5.0 (428 Sessions)</strong>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB: LEAVE MANAGEMENT                                        */}
          {/* ============================================================ */}
          {activeTab === "emp_leave" && (
            <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">

              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">Leave Requests</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Apply for leave and track your request status.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchLeaveRequests}
                    disabled={leaveLoading}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${leaveLoading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaveForm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-md shadow-blue-500/20 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Apply for Leave
                  </button>
                </div>
              </div>

              {/* Feedback Toast */}
              {leaveSubmitMsg && (
                <div className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in ${
                  leaveSubmitMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  <div className="flex items-center gap-2">
                    {leaveSubmitMsg.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                    <span>{leaveSubmitMsg.text}</span>
                  </div>
                  <button onClick={() => setLeaveSubmitMsg(null)}><X className="w-4 h-4" /></button>
                </div>
              )}

              {/* Apply Leave Form (Inline Panel) */}
              {showLeaveForm && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 rounded-2xl border border-blue-200 p-6 space-y-4 animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                        <CalendarDays className="w-5 h-5 text-blue-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">New Leave Application</h3>
                        <p className="text-[11px] text-slate-500">Fill all fields — your request will be reviewed by the owner.</p>
                      </div>
                    </div>
                    <button onClick={() => setShowLeaveForm(false)} className="text-slate-400 hover:text-slate-600 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitLeave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Leave Type */}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Leave Type</label>
                      <div className="flex flex-wrap gap-2">
                        {(["CASUAL", "SICK", "ANNUAL", "UNPAID", "OTHER"] as LeaveType[]).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setLeaveFormType(t)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              leaveFormType === t
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                            }`}
                          >
                            {t.charAt(0) + t.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Start Date</label>
                      <input
                        type="date"
                        value={leaveFormStart}
                        onChange={e => setLeaveFormStart(e.target.value)}
                        min={new Date().toISOString().slice(0, 10)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                        required
                      />
                    </div>

                    {/* End Date */}
                    <div>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">End Date</label>
                      <input
                        type="date"
                        value={leaveFormEnd}
                        onChange={e => setLeaveFormEnd(e.target.value)}
                        min={leaveFormStart || new Date().toISOString().slice(0, 10)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 bg-white"
                        required
                      />
                    </div>

                    {/* Duration preview */}
                    {leaveFormStart && leaveFormEnd && leaveFormEnd >= leaveFormStart && (
                      <div className="sm:col-span-2 p-3 rounded-xl bg-blue-100/80 border border-blue-200 text-xs font-bold text-blue-800 flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5" />
                        Duration: {Math.ceil((new Date(leaveFormEnd).getTime() - new Date(leaveFormStart).getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s) &mdash; {new Date(leaveFormStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} to {new Date(leaveFormEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}

                    {/* Leave Timing / Session */}
                    <div className="sm:col-span-2 space-y-2">
                      <label className="text-xs font-extrabold text-slate-700 block">Leave Timing / Session</label>
                      <div className="flex flex-wrap gap-2">
                        {["Full Day", "First Half (Morning)", "Second Half (Afternoon)", "Custom Hours"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setLeaveFormTiming(t)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              leaveFormTiming === t
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      {leaveFormTiming === "Custom Hours" && (
                        <div className="pt-1">
                          <input
                            type="text"
                            value={leaveFormCustomTime}
                            onChange={(e) => setLeaveFormCustomTime(e.target.value)}
                            placeholder="e.g. 10:00 AM - 02:00 PM"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500 bg-white"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {/* Reason */}
                    <div className="sm:col-span-2">
                      <label className="text-xs font-extrabold text-slate-700 block mb-1.5">Reason for Leave <span className="text-red-400">*</span></label>
                      <textarea
                        rows={3}
                        value={leaveFormReason}
                        onChange={e => setLeaveFormReason(e.target.value)}
                        placeholder="Briefly explain the reason for your leave request..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-500 resize-none bg-white"
                        required
                      />
                    </div>

                    {/* Submit */}
                    <div className="sm:col-span-2 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowLeaveForm(false)}
                        className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={leaveSubmitting}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-60"
                      >
                        {leaveSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {leaveSubmitting ? "Submitting..." : "Submit Request"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Leave History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800">Leave History</h3>
                  {leaveRequests.length > 0 && (
                    <span className="text-xs text-slate-500">{leaveRequests.length} request(s)</span>
                  )}
                </div>

                {leaveLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                    <span className="text-sm font-medium">Loading leave records...</span>
                  </div>
                ) : leaveError ? (
                  <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
                    <p className="text-xs text-red-700 font-bold">{leaveError}</p>
                    <button onClick={fetchLeaveRequests} className="text-xs text-blue-600 underline font-bold">Retry</button>
                  </div>
                ) : leaveRequests.length === 0 ? (
                  <div className="p-10 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center mx-auto">
                      <CalendarDays className="w-7 h-7 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-700">No Leave Requests Yet</p>
                      <p className="text-xs text-slate-400 mt-1">Your submitted leave applications will appear here.</p>
                    </div>
                    <button
                      onClick={() => setShowLeaveForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-md transition-all hover:bg-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Apply for First Leave
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leaveRequests.map((leave) => {
                      const statusConfig = {
                        PENDING:   { label: "Pending Review", cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
                        APPROVED:  { label: "Approved",       cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
                        REJECTED:  { label: "Rejected",       cls: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },
                        CANCELLED: { label: "Cancelled",      cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
                      }[leave.status] || { label: leave.status, cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };

                      const days = leave.days_count || 1;
                      const appliedDate = leave.created_at
                        ? new Date(leave.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "";
                      const startFmt = leave.start_date ? new Date(leave.start_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
                      const endFmt = leave.end_date ? new Date(leave.end_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

                      // Extract timing from reason if prefixed with [Timing: ...]
                      const timingMatch = leave.reason?.match(/^\[Timing:\s*([^\]]+)\]\s*([\s\S]*)$/);
                      const displayTiming = timingMatch ? timingMatch[1] : null;
                      const displayReason = timingMatch ? timingMatch[2] : leave.reason;

                      return (
                        <div key={leave.id} className={`p-5 rounded-2xl border transition-all hover:shadow-sm ${statusConfig.cls}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${statusConfig.dot}`} />
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-black text-slate-900">{leave.leave_type?.charAt(0) + (leave.leave_type?.slice(1).toLowerCase() || "")} Leave</span>
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border">
                                    {statusConfig.label}
                                  </span>
                                  {displayTiming && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 border border-indigo-200">
                                      <Clock className="w-3 h-3 text-indigo-600" />
                                      {displayTiming}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1.5 space-y-1 text-xs">
                                  <div className="flex items-center gap-1.5 text-slate-700">
                                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                                    <span><strong>{startFmt}</strong> &mdash; <strong>{endFmt}</strong> &nbsp;·&nbsp; <span className="font-bold">{days} day{days !== 1 ? "s" : ""}</span></span>
                                  </div>
                                  <div className="flex items-start gap-1.5 text-slate-600">
                                    <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{displayReason}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span>Applied on: <strong>{appliedDate}</strong></span>
                                  </div>
                                </div>

                                {/* Decision Info */}
                                {leave.status === "APPROVED" && leave.approved_by_name && (
                                  <div className="mt-2 p-2 rounded-lg bg-white/70 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    Approved by {leave.approved_by_name}
                                    {leave.decision_at && <span className="text-emerald-600"> · {new Date(leave.decision_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                                  </div>
                                )}
                                {leave.status === "REJECTED" && leave.rejection_reason && (
                                  <div className="mt-2 p-2 rounded-lg bg-white/70 border border-red-200 text-xs text-red-800 font-semibold flex items-center gap-1.5">
                                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    Reason: {leave.rejection_reason}
                                  </div>
                                )}
                                {leave.decision_notes && (
                                  <div className="mt-1.5 p-2 rounded-lg bg-white/60 border border-current/20 text-xs font-medium text-slate-600">
                                    Note: {leave.decision_notes}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Cancel button for pending requests */}
                            {leave.status === "PENDING" && (
                              <button
                                type="button"
                                onClick={() => handleCancelLeave(leave.id)}
                                className="shrink-0 p-1.5 rounded-lg bg-white/80 hover:bg-red-100 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-300 transition-all"
                                title="Cancel Request"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leave Balance Info Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 text-white">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-3">Leave Summary (This Period)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Applied", count: leaveRequests.length, color: "text-white" },
                    { label: "Pending", count: leaveRequests.filter(l => l.status === "PENDING").length, color: "text-amber-300" },
                    { label: "Approved", count: leaveRequests.filter(l => l.status === "APPROVED").length, color: "text-emerald-300" },
                    { label: "Rejected", count: leaveRequests.filter(l => l.status === "REJECTED").length, color: "text-red-300" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <div className={`text-2xl font-black font-[family-name:var(--font-outfit)] ${s.color}`}>{s.count}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Bottom Footer Control Bar */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              onClick={() => {
                onLogout();
                window.location.href = "/login";
              }}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 transition-all flex items-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: LOG PROGRESS NOTE FOR TRAINEE                         */}
      {/* ============================================================ */}
      {selectedTraineeForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  Log Training Progress Note
                </h3>
              </div>
              <button
                onClick={() => setSelectedTraineeForNote(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Logging session notes for <strong>{selectedTraineeForNote.name}</strong> ({selectedTraineeForNote.skillLevel}).
            </p>

            {noteSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-center font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Training note recorded in student record!</span>
              </div>
            ) : (
              <form onSubmit={handleSaveTraineeNote} className="space-y-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    Coach Observation / Drills Practiced:
                  </label>
                  <textarea
                    rows={4}
                    value={newProgressNote}
                    onChange={(e) => setNewProgressNote(e.target.value)}
                    placeholder="e.g. Practiced low-bounce grass slice serve. First serve speed reached 108 mph with consistent toss alignment."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedTraineeForNote(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md"
                  >
                    Save Progress Note
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: REPORT COURT ISSUE                                    */}
      {/* ============================================================ */}
      {showReportIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  Report Court / Equipment Issue
                </h3>
              </div>
              <button
                onClick={() => setShowReportIssueModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {issueSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 text-center font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Issue reported! Dispatched to ground staff Ramesh & Manoj.</span>
              </div>
            ) : (
              <form onSubmit={handleReportIssue} className="space-y-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    Select Court / Arena:
                  </label>
                  <select
                    value={issueCourt}
                    onChange={(e) => setIssueCourt(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                  >
                    {empData.assignedCourts.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    Issue Category:
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-white"
                  >
                    <option value="NET_TENSION">Net Tension / Center Strap adjustment</option>
                    <option value="GRASS_MOWING">Grass Lawn High-Cut / Uneven bounce</option>
                    <option value="CLAY_ROLLING">Clay Dry Patch / Needs Water & Roller</option>
                    <option value="LIGHTING_CHECK">Floodlight bulb failure / LUX drop</option>
                    <option value="STRINGING_JOB">Ball machine jam / Pro shop gear</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">
                    Specific Details / Urgency:
                  </label>
                  <textarea
                    rows={3}
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                    placeholder="Describe issue (e.g. Net height is 37 inches at center, needs 1 inch drop before 5 PM match)."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900"
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowReportIssueModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md"
                  >
                    Dispatch Ticket
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: SLOT DETAILS                                          */}
      {/* ============================================================ */}
      {selectedSlotDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                Slot Booking Details &bull; {selectedSlotDetail.id}
              </h3>
              <button
                onClick={() => setSelectedSlotDetail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Member:</span>
                <strong className="text-slate-900">{selectedSlotDetail.memberName} ({selectedSlotDetail.memberTier})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time Slot:</span>
                <strong className="text-slate-900">{selectedSlotDetail.timeSlot}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Court Arena:</span>
                <strong className="text-emerald-700">{selectedSlotDetail.courtName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <strong className="text-slate-900">{selectedSlotDetail.status}</strong>
              </div>
              {selectedSlotDetail.specialRequests && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">Special Requests:</span>
                  <p className="text-slate-800 font-medium">{selectedSlotDetail.specialRequests}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSlotDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}
