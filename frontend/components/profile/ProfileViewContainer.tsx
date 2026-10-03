"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Crown,
  CreditCard,
  ShoppingBag,
  Calendar,
  Calendar as CalendarIcon,
  MessageSquare,
  LogOut,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  Phone,
  Mail,
  Receipt,
  ExternalLink,
  Plus,
  ArrowRight,
  QrCode,
  Download,
  Settings,
  MapPin,
  Coffee,
  Check,
  Wallet,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  Send,
  CalendarCheck,
  AlertCircle,
  AlertTriangle,
  Award,
  Flame,
  UserCheck,
  Building2,
  Key,
  Loader2,
  Trash2
} from "lucide-react";
import { useCurrentUser, setStoredUser, isStaffOrAdmin, isOwner, DEFAULT_COACH_EMPLOYEE_DATA, type AuthUserProfile } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";
import EmployeeProfileView from "@/components/profile/EmployeeProfileView";

type TabType = "overview" | "calendar" | "crm" | "orders" | "bookings" | "payments" | "settings";

interface ChatMessage {
  id: string;
  sender: "concierge" | "user" | "coach";
  name: string;
  avatar: string;
  text: string;
  time: string;
  roleTag?: string;
}

export interface ProfileViewContainerProps {
  forcedMode?: "owner" | "employee" | "member";
}

export default function ProfileViewContainer({ forcedMode }: ProfileViewContainerProps = {}) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real Database Member Data State
  const [memberBookings, setMemberBookings] = useState<any[]>([]);
  const [memberOrders, setMemberOrders] = useState<any[]>([]);
  const [memberProfileData, setMemberProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Cancellation State
  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelFeedback, setCancelFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchLiveMemberData = useCallback(async () => {
    try {
      setProfileLoading(true);
      const [meRes, bookingsRes, ordersRes] = await Promise.allSettled([
        apiClient.get<any>("/members/me"),
        apiClient.get<any>("/bookings/my-history"),
        apiClient.get<any>("/shop/orders/my-orders"),
      ]);

      if (meRes.status === "fulfilled" && meRes.value) {
        const mem = meRes.value?.member || meRes.value?.data || meRes.value;
        setMemberProfileData(mem);
      }

      if (bookingsRes.status === "fulfilled" && bookingsRes.value) {
        const bList = Array.isArray(bookingsRes.value)
          ? bookingsRes.value
          : bookingsRes.value?.bookings || bookingsRes.value?.data || [];
        setMemberBookings(
          bList.map((b: any) => ({
            id: b.id,
            numericId: b.id,
            bookingId: b.id,
            bookingCode: b.booking_reference || `BK-${b.id}`,
            courtName: b.court?.name || `Court #${b.court_id}`,
            sport: b.court?.sport_type || "Tennis",
            surface: b.court?.surface_type || "Standard Surface",
            date: b.start_time ? new Date(b.start_time).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Today",
            startTime: b.start_time,
            endTime: b.end_time,
            timeSlot: b.start_time
              ? `${new Date(b.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(b.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "05:00 PM – 06:00 PM",
            status: b.status || "CONFIRMED",
            participants: b.guest_name ? [b.guest_name] : ["Club Member"],
            amount: b.final_price !== undefined ? Number(b.final_price) : (b.price ? Number(b.price) : 0),
            cancellationReason: b.cancellation_reason,
            cancelledAt: b.cancelled_at,
          }))
        );
      }

      if (ordersRes.status === "fulfilled" && ordersRes.value) {
        const oList = Array.isArray(ordersRes.value)
          ? ordersRes.value
          : ordersRes.value?.orders || ordersRes.value?.data || [];
        setMemberOrders(
          oList.map((o: any) => ({
            id: o.order_number || `ORD-${o.id}`,
            orderNumber: o.order_number || `#CC-${o.id}`,
            type: o.order_type === "CAFE" ? "CAFE" : "PRO_SHOP",
            items: (o.items || []).map((i: any) => ({
              name: i.product?.name || i.menu_item?.name || i.name || "Club Item",
              quantity: i.quantity || 1,
              price: Number(i.unit_price || i.price || 0),
            })),
            totalAmount: Number(o.total_amount || 0),
            status: o.status || "COMPLETED",
            date: o.created_at ? new Date(o.created_at).toLocaleDateString() : "Today",
            paymentMethod: o.payment_method || "Online",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load live member profile data:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveMemberData();
  }, [fetchLiveMemberData, user?.id]);

  const activeUser: AuthUserProfile = {
    id: user?.id || 1,
    memberCode: memberProfileData?.membership_number || `CC-MEM-${user?.id || 101}`,
    name: user?.name || user?.full_name || (user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Club Member"),
    email: user?.email || "member@championsclub.in",
    phone: memberProfileData?.phone || user?.phone || "+91 98765 43210",
    role: user?.role || "MEMBER",
    membershipPlan: memberProfileData?.active_membership?.plan_code || user?.membershipPlan || "GOLD",
    membershipStatus: memberProfileData?.is_active ? "ACTIVE" : (user?.membershipStatus || "ACTIVE"),
    membershipExpiry: memberProfileData?.active_membership?.end_date ? new Date(memberProfileData.active_membership.end_date).toLocaleDateString() : "Active Member",
    joinDate: memberProfileData?.created_at ? new Date(memberProfileData.created_at).toLocaleDateString() : (user?.joinDate || "Jan 2024"),
    walletBalance: Number(memberProfileData?.wallet_balance ?? user?.walletBalance ?? 0),
    clubTabsOutstanding: Number(user?.clubTabsOutstanding ?? 0),
    orders: memberOrders.length > 0 ? memberOrders : (user?.orders || []),
    bookings: memberBookings.length > 0 ? memberBookings : (user?.bookings || []),
    payments: user?.payments || [],
    crmInquiries: user?.crmInquiries || [],
    employeeData: user?.employeeData || DEFAULT_COACH_EMPLOYEE_DATA,
  };

  const isEmployeeWithData = !!activeUser.employeeData || forcedMode === "employee" || isStaffOrAdmin(activeUser);
  const initialViewMode: "employee" | "member" =
    forcedMode === "employee"
      ? "employee"
      : "member";
  const [viewMode, setViewMode] = useState<"employee" | "member">(initialViewMode);

  // Forced mode role enforcement:
  const isSuperOwner = (forcedMode === "member" || forcedMode === "employee") ? false : (forcedMode === "owner" || isOwner(activeUser));
  const canAccessConsole = (forcedMode === "member" || forcedMode === "employee") ? false : (forcedMode === "owner" || isOwner(activeUser));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as TabType;
      if (tab && ["overview", "calendar", "crm", "orders", "bookings", "payments", "settings"].includes(tab)) {
        setActiveTab(tab);
      }
    }
  }, []);

  // Dynamic backend membership data
  const [liveMembershipData, setLiveMembershipData] = useState<any>(null);

  useEffect(() => {
    const fetchMembershipStatus = async () => {
      try {
        const res = await apiClient.get<any>("/membership-plans/my-status");
        if (res?.data?.active_membership) {
          setLiveMembershipData(res.data.active_membership);
          if (res.data.user) {
            setStoredUser(res.data.user);
          }
        }
      } catch {
        // Silently continue
      }
    };
    fetchMembershipStatus();
  }, []);

  const currentPlan = (
    liveMembershipData?.plan?.code ||
    activeUser.membership_plan ||
    activeUser.membershipPlan ||
    "GOLD"
  ).toUpperCase();

  const planDisplayName =
    liveMembershipData?.plan?.name ||
    (currentPlan === "GOLD"
      ? "Gold Champion"
      : currentPlan === "SILVER"
      ? "Silver Tier"
      : currentPlan === "JUNIOR"
      ? "Junior Academy"
      : `${currentPlan} Member`);

  const membershipStartDate =
    liveMembershipData?.start_date ||
    activeUser.membership_start_date ||
    activeUser.membershipStartDate ||
    activeUser.joinDate ||
    "October 3, 2026";

  const membershipEndDate =
    liveMembershipData?.end_date ||
    activeUser.membership_end_date ||
    activeUser.membershipExpiry ||
    "October 2, 2027";

  const formatProfileDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) return null;
    try {
      const end = new Date(endDateStr).getTime();
      const now = new Date().getTime();
      const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 0;
    } catch {
      return null;
    }
  };
  // Super Owner Role & Department Access Delegator State
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantRole, setGrantRole] = useState("STAFF");
  const [grantDepartment, setGrantDepartment] = useState("Badminton");
  const [grantName, setGrantName] = useState("");
  const [isGranting, setIsGranting] = useState(false);
  const [grantSuccessMsg, setGrantSuccessMsg] = useState("");
  const [grantErrorMsg, setGrantErrorMsg] = useState("");

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantEmail.trim()) return;
    setIsGranting(true);
    setGrantSuccessMsg("");
    setGrantErrorMsg("");

    try {
      const data = await apiClient.post<any>("/auth/assign-access", {
        email: grantEmail.trim().toLowerCase(),
        role: grantRole,
        department: grantDepartment,
        first_name: grantName.split(" ")[0] || "Staff",
        last_name: grantName.split(" ").slice(1).join(" ") || "Member",
      });

      setGrantSuccessMsg(`Access Granted: ${grantEmail} assigned role '${grantRole}' in '${grantDepartment}' department.`);
      setGrantEmail("");
      setGrantName("");
    } catch (err: any) {
      setGrantErrorMsg(err?.message || "Error assigning role");
    } finally {
      setIsGranting(false);
    }
  };

  // Calendar State (October 2026)
  const [selectedDate, setSelectedDate] = useState<number>(3); // Oct 3
  const currentMonth = "October, 2026";

  // Important Club Dates & Member Schedule
  const importantClubDates: Record<number, { title: string; type: "booking" | "tournament" | "renewal" | "training"; time?: string; location?: string }> = {
    3: { title: "Centre Grass Court #1 Session", type: "booking", time: "05:00 PM – 06:00 PM", location: "Wimbledon Lawn #1" },
    4: { title: "Panoramic Glass Padel Match", type: "booking", time: "07:00 AM – 08:00 AM", location: "Padel Supercourt #2" },
    7: { title: "Senior Coach David Masterclass", type: "training", time: "06:30 PM – 07:30 PM", location: "Roland-Garros Clay Arena" },
    11: { title: "Gujarat Open Club Doubles Championship", type: "tournament", time: "09:00 AM onwards", location: "Grandstand Center Court" },
    18: { title: "VIP Tennis Racket Demo & Stringing Clinic", type: "training", time: "04:00 PM – 06:00 PM", location: "Champions Lounge Pavilion" },
    25: { title: "Monthly Club Tab Auto-Settlement Cycle", type: "renewal", time: "11:59 PM", location: "Digital Accounts Desk" },
  };

  // Concierge Desk Chat State (Inspired by reference layout)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "m1",
      sender: "concierge",
      name: "Priya Sharma",
      avatar: "PS",
      text: "Good morning Alex! Your Babolat RPM Blast racket stringing (54 lbs) is completed and ready for pickup at the Pro Shop desk.",
      time: "10:15 AM",
      roleTag: "Concierge Desk",
    },
    {
      id: "m2",
      sender: "coach",
      name: "David Vance",
      avatar: "DV",
      text: "Court #1 lawn was freshly cut this morning. High bounce conditions for your 5 PM session today! Let me know if you need ball kids ready.",
      time: "11:30 AM",
      roleTag: "Head Coach",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // CRM inquiries state
  const [inquiries, setInquiries] = useState(activeUser.crmInquiries || []);
  const [newInquiryTitle, setNewInquiryTitle] = useState("");
  const [newInquiryCat, setNewInquiryCat] = useState("COACHING");
  const [newInquiryNotes, setNewInquiryNotes] = useState("");
  const [showInquirySuccess, setShowInquirySuccess] = useState(false);

  // Wallet top-up state
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(2000);
  const [topupSuccess, setTopupSuccess] = useState(false);

  // Pay active tab state
  const [showPayTabModal, setShowPayTabModal] = useState(false);
  const [payTabSuccess, setPayTabSuccess] = useState(false);

  // Settings form state
  const [editName, setEditName] = useState(activeUser.name);
  const [editPhone, setEditPhone] = useState(activeUser.phone);
  const [editEmail, setEditEmail] = useState(activeUser.email);
  const [preferredSport, setPreferredSport] = useState("Tennis");
  const [skillLevel, setSkillLevel] = useState("Advanced (NTRP 4.5)");
  const [dietaryPref, setDietaryPref] = useState("High-Protein / Keto Friendly");
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Filter states
  const [orderFilter, setOrderFilter] = useState<"ALL" | "PRO_SHOP" | "CAFE" | "STRINGING">("ALL");
  const [bookingFilter, setBookingFilter] = useState<"ALL" | "CONFIRMED" | "COMPLETED" | "CANCELLED">("ALL");

  const isEligibleForRefund = (startTime?: string) => {
    if (!startTime) return false;
    const slotDate = new Date(startTime).getTime();
    const now = new Date().getTime();
    const hoursDiff = (slotDate - now) / (1000 * 60 * 60);
    return hoursDiff >= 12;
  };

  const handleCancelBooking = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cancellingBooking) return;
    const bookingId =
      cancellingBooking.bookingId ||
      cancellingBooking.numericId ||
      (typeof cancellingBooking.id === "number"
        ? cancellingBooking.id
        : parseInt(String(cancellingBooking.id).replace(/\D/g, ""), 10));

    if (!bookingId) {
      setCancelFeedback({ type: "error", message: "Invalid booking identifier for cancellation." });
      return;
    }

    setCancelSubmitting(true);
    setCancelFeedback(null);
    try {
      const res = await apiClient.post<any>(`/bookings/${bookingId}/cancel`, {
        reason: cancelReason.trim() || "Customer requested cancellation",
      });
      const msg = (res as any)?.message || "Booking cancelled successfully.";
      setCancelFeedback({ type: "success", message: msg });
      setCancellingBooking(null);
      setCancelReason("");
      await fetchLiveMemberData();
    } catch (err: any) {
      setCancelFeedback({
        type: "error",
        message: err?.message || "Failed to cancel booking.",
      });
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      name: activeUser.name,
      avatar: activeUser.name.split(" ").map((n) => n[0]).join(""),
      text: chatInput.trim(),
      time: "Just now",
      roleTag: "Gold Member",
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");

    // Simulated instant reply from concierge desk
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          sender: "concierge",
          name: "Priya Sharma",
          avatar: "PS",
          text: "Received with priority, Alex! I have updated our desk logs and notified the coaching team right away.",
          time: "Just now",
          roleTag: "Concierge Desk",
        },
      ]);
    }, 1200);
  };

  const handleAddInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInquiryTitle.trim()) return;

    const newInq = {
      id: `CRM-${Math.floor(2000 + Math.random() * 8000)}`,
      title: newInquiryTitle.trim(),
      category: newInquiryCat as "MEMBERSHIP" | "TRIAL_PASS" | "COACHING" | "EVENT",
      status: "NEW" as const,
      date: "Just now",
      notes: newInquiryNotes.trim() || "Request logged. Concierge Desk will review within 2 hours.",
      assignedTo: "Priya Sharma (Concierge Lead)",
    };

    const updated = [newInq, ...inquiries];
    setInquiries(updated);

    if (user) {
      setStoredUser({
        ...user,
        crmInquiries: updated,
      });
    }

    setNewInquiryTitle("");
    setNewInquiryNotes("");
    setShowInquirySuccess(true);
    setTimeout(() => setShowInquirySuccess(false), 4000);
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupAmount || topupAmount <= 0) return;

    try {
      await apiClient.post<any>("/payments", {
        item_type: "WALLET_TOPUP",
        amount: Number(topupAmount),
        payment_method: "UPI",
        notes: `Wallet Auto-Topup via UPI`,
      });
      setTopupSuccess(true);
      setTimeout(() => {
        setTopupSuccess(false);
        setShowTopupModal(false);
      }, 1500);
    } catch (err: any) {
      alert(err?.message || "Payment topup failed.");
    }
  };

  const handlePayTab = async () => {
    if (activeUser.clubTabsOutstanding <= 0) return;

    try {
      await apiClient.post<any>("/payments", {
        item_type: "POS_BAR_CAFE",
        amount: activeUser.clubTabsOutstanding,
        payment_method: "CARD",
        notes: "Champions Lounge Café & Pro Shop Active Tab Settlement",
      });
      setPayTabSuccess(true);
      setTimeout(() => {
        setPayTabSuccess(false);
        setShowPayTabModal(false);
      }, 1500);
    } catch (err: any) {
      alert(err?.message || "Tab settlement failed.");
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser: AuthUserProfile = {
      ...activeUser,
      name: editName.trim() || activeUser.name,
      phone: editPhone.trim() || activeUser.phone,
      email: editEmail.trim() || activeUser.email,
    };
    setStoredUser(updatedUser);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const getTierColor = (plan: string) => {
    switch (plan?.toUpperCase()) {
      case "GOLD":
        return "from-amber-400 to-amber-600 text-amber-950 border-amber-300";
      case "SILVER":
        return "from-slate-200 to-slate-400 text-slate-900 border-slate-300";
      case "JUNIOR":
        return "from-emerald-400 to-teal-600 text-teal-950 border-emerald-300";
      default:
        return "from-sky-400 to-blue-600 text-white border-sky-300";
    }
  };

  const filteredOrders = (activeUser.orders || []).filter((o) => {
    if (orderFilter === "ALL") return true;
    return o.type === orderFilter;
  });

  const filteredBookings = (activeUser.bookings || []).filter((b) => {
    if (bookingFilter === "ALL") return true;
    return b.status === bookingFilter;
  });

  // Calendar Day Generation for October 2026 (starts on Thursday)
  const daysInMonth = 31;
  const startDayOffset = 4; // Thursday index (0=Sun, 1=Mon, ..., 4=Thu)
  const calendarCells = [];
  for (let i = 0; i < startDayOffset; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  if (viewMode === "employee" && activeUser.employeeData) {
    return (
      <EmployeeProfileView
        user={activeUser}
        onLogout={() => {
          logout("/login");
          router.push("/login");
        }}
        onSwitchToMemberView={() => setViewMode("member")}
      />
    );
  }

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
                  logout("/login");
                  router.push("/login");
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
                {isSuperOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowGrantModal(true);
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black bg-amber-400 text-amber-950 border border-amber-300 shadow-sm"
                  >
                    <Crown className="w-4 h-4 text-amber-900" />
                    <span>Owner Access Delegator</span>
                  </button>
                )}

                {canAccessConsole && (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-lime-100 text-lime-900 border border-lime-300"
                  >
                    <TrendingUp className="w-4 h-4 text-lime-800" />
                    <span>Open Staff & Admin Console</span>
                  </Link>
                )}

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
                    logout("/login");
                    router.push("/login");
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-20 w-full flex-1">

        {/* ============================================================ */}
        {/* TOP HERO PROFILE BANNER (Signature Champions Luxury Theme) */}
        {/* ============================================================ */}
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden">

          {/* Header Strip with Gradient & Member Identity */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">

              {/* User Identity */}
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-sky-400 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-xl border-2 border-white/40 shrink-0">
                  {activeUser.name.split(" ").map((n) => n[0]).join("")}
                </div>

                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
                      {activeUser.name}
                    </h1>
                    {isSuperOwner ? (
                      <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase border border-amber-300 shadow-sm bg-gradient-to-r from-amber-400 to-amber-600 text-amber-950">
                        <Crown className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                        CLUB OWNER & SOVEREIGN
                      </span>
                    ) : (
                      <span className={`px-3 py-0.5 rounded-full text-[11px] font-black uppercase border shadow-sm bg-gradient-to-r ${getTierColor(currentPlan)}`}>
                        <Crown className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                        {currentPlan} MEMBER
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      {isSuperOwner ? "PATRON ACCESS" : activeUser.membershipStatus}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-300 mt-2 flex-wrap font-medium">
                    <span className="flex items-center gap-1 font-mono text-sky-300 font-bold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                      {activeUser.memberCode}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {activeUser.email}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {activeUser.phone}
                    </span>
                  </div>
                </div>
              </div>

              {/* Executive Box for Owner vs Wallet Box for Standard Member */}
              {isSuperOwner ? (
                <div className="flex items-center gap-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 shrink-0 self-stretch sm:self-auto justify-around sm:justify-start">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                      Club Sovereignty
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                      Master Owner
                    </div>
                    <span className="text-[10px] font-bold text-emerald-300 block mt-0.5">
                      Full Root Access
                    </span>
                  </div>

                  <div className="w-px h-10 bg-white/20" />

                  <div className="text-left">
                    <div className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                      Arena Operations
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                      3 Arenas Live
                    </div>
                    <span className="text-[10px] font-bold text-sky-300 block mt-0.5">
                      Supervisors on Duty
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/15 shrink-0 self-stretch sm:self-auto justify-around sm:justify-start">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                      Wallet Balance
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                      ₹{activeUser.walletBalance.toLocaleString("en-IN")}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTopupModal(true)}
                      className="text-[10px] font-bold text-sky-300 hover:text-white underline mt-0.5 block ml-auto"
                    >
                      + Add Funds
                    </button>
                  </div>

                  <div className="w-px h-10 bg-white/20" />

                  <div className="text-left">
                    <div className="text-[10px] uppercase font-bold text-lime-300 tracking-wider">
                      Active Tab Due
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                      ₹{activeUser.clubTabsOutstanding.toLocaleString("en-IN")}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPayTabModal(true)}
                      disabled={activeUser.clubTabsOutstanding === 0}
                      className={`text-[10px] font-bold underline mt-0.5 block ${activeUser.clubTabsOutstanding > 0 ? "text-lime-300 hover:text-white cursor-pointer" : "text-slate-400 cursor-not-allowed"
                        }`}
                    >
                      {activeUser.clubTabsOutstanding > 0 ? "Pay Now" : "Settled"}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ============================================================ */}
        {/* TWO-COLUMN LAYOUT: LEFT SIDEBAR + RIGHT CONTENT               */}
        {/* ============================================================ */}
        <div className="flex gap-6 mt-6 items-start">

          {/* ======== LEFT VERTICAL NAV SIDEBAR ======== */}
          <aside className="hidden lg:flex flex-col w-64 shrink-0 sticky top-28">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden">
              {/* Sidebar header */}
              <div className="bg-gradient-to-br from-slate-900 to-blue-950 px-5 py-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">My Portal</div>
                <div className="text-sm font-extrabold text-white flex items-center justify-between">
                  <span>{activeUser.name.split(" ")[0]}'s Dashboard</span>
                  {isSuperOwner && (
                    <span className="text-[9px] font-black uppercase bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">
                      Owner
                    </span>
                  )}
                </div>
              </div>

              {/* Primary Nav Tabs */}
              <nav className="p-3 space-y-1">
                {[
                  { id: "overview", label: "Overview", icon: User },
                  { id: "calendar", label: "Club Calendar", icon: CalendarIcon },
                  { id: "crm", label: `CRM & Enquiries`, icon: MessageSquare, badge: inquiries.length },
                  { id: "orders", label: `Orders`, icon: ShoppingBag, badge: activeUser.orders.length },
                  { id: "bookings", label: `Bookings`, icon: CalendarCheck, badge: activeUser.bookings.length },
                  { id: "payments", label: `Payments & Tabs`, icon: CreditCard, badge: activeUser.payments.length },
                  { id: "settings", label: "Profile Settings", icon: Settings },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${isActive
                        ? "bg-slate-900 text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-sky-400" : "text-slate-400"
                          }`} />
                        <span>{tab.label}</span>
                      </span>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-600"
                          }`}>{tab.badge}</span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Sidebar Quick Actions & Management */}
              <div className="p-3 pt-2 border-t border-slate-100 space-y-2 bg-slate-50/50">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-1">
                  Actions & Controls
                </div>

                {/* Super Owner Master Access Control */}
                {isSuperOwner && (
                  <button
                    type="button"
                    onClick={() => setShowGrantModal(true)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-black text-xs shadow-md border border-amber-300 transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-900 group-hover:scale-110 transition-transform" />
                      <span>Owner Access Control</span>
                    </span>
                    <Key className="w-3.5 h-3.5 text-amber-900/70" />
                  </button>
                )}


                {/* Staff & Admin Console */}
                {canAccessConsole && (
                  <Link
                    href="/dashboard"
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-lime-100 hover:bg-lime-200 text-lime-950 font-extrabold text-xs border border-lime-300 shadow-sm transition-all"
                  >
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-lime-800" />
                      <span>Staff & Admin Console</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-lime-700" />
                  </Link>
                )}

                <Link
                  href="/"
                  className="w-full flex items-center gap-2 px-3.5 py-2 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs font-bold transition-all text-center justify-center mt-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back to Club Sanctuary</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* ======== MOBILE TAB STRIP (shown below lg) ======== */}
          <div className="lg:hidden w-full flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none mb-2">
            {[
              { id: "overview", label: "Overview", icon: User },
              { id: "calendar", label: "Calendar", icon: CalendarIcon },
              { id: "crm", label: `CRM (${inquiries.length})`, icon: MessageSquare },
              { id: "orders", label: `Orders (${activeUser.orders.length})`, icon: ShoppingBag },
              { id: "bookings", label: `Bookings (${activeUser.bookings.length})`, icon: CalendarCheck },
              { id: "payments", label: `Payments (${activeUser.payments.length})`, icon: CreditCard },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center gap-1.5 whitespace-nowrap ${isActive
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-400"}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ======== RIGHT CONTENT PANEL ======== */}
          <div className="flex-1 min-w-0 bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">

            {/* ============================================================ */}
            {/* TAB 1: OVERVIEW WITH NOTIFICATION BANNER & LIVE CONCIERGE CHAT */}
            {/* ============================================================ */}
            {activeTab === "overview" && (
              <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-200">

                {/* Top Section: Live Arena Utilization & Sovereign Status */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                  {/* Left: Active Club Membership Card */}
                  <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm flex flex-col gap-5">

                    {/* Tier label + Status badge */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">
                          {currentPlan} Membership
                        </p>
                        <h3 className="text-4xl font-black text-slate-900 font-[family-name:var(--font-outfit)] leading-none">
                          {planDisplayName}
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Active · Paid
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-slate-100" />

                    {/* Date range + Days left */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-lg sm:text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                          {formatProfileDate(membershipStartDate)}
                          <span className="text-slate-400 font-medium mx-2">–</span>
                          {formatProfileDate(membershipEndDate)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">12-month membership</p>
                      </div>
                      <p className="text-lg font-black text-emerald-600 whitespace-nowrap">
                        {getDaysRemaining(membershipEndDate) !== null
                          ? `${getDaysRemaining(membershipEndDate)} days left`
                          : "Active"}
                      </p>
                    </div>

                    {/* Benefits chips */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-2.5">Your Benefits</p>
                      <div className="flex flex-wrap gap-2">
                        {(currentPlan === "GOLD"
                          ? ["Court access", "20% Pro Shop discount", "4 guest passes / month"]
                          : currentPlan === "JUNIOR"
                          ? ["Court access", "15% junior equipment discount", "Youth clinic slots"]
                          : ["Court access", "10% Pro Shop discount", "Friday benefits"]
                        ).map((benefit) => (
                          <span
                            key={benefit}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            {benefit}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Full-width CTA button */}
                    <Link
                      href="/membership"
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-sm shadow-md shadow-sky-500/25 transition-all mt-auto"
                    >
                      <span>Change membership</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                  </div>


                </div>

                {/* Upcoming Fixtures — Minimal */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                        Upcoming Fixtures
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Tournaments, clinics &amp; court allocations</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("calendar")}
                      className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
                    >
                      View calendar <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {[
                      { date: "Oct 04", time: "07:00 AM", title: "Padel Match #2", location: "Padel Glass Arena", tag: "Booking", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                      { date: "Oct 07", time: "06:30 PM", title: "Clay Court Masterclass", location: "Red Clay Court 2", tag: "Coaching", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                      { date: "Oct 11", time: "09:00 AM", title: "Gujarat Open Championship", location: "Centre Grass Court", tag: "Tournament", color: "bg-amber-50 text-amber-700 border-amber-200" },
                      { date: "Oct 18", time: "04:00 PM", title: "VIP Racket Demo & Lounge", location: "Clubhouse Lounge", tag: "Special Event", color: "bg-purple-50 text-purple-700 border-purple-200" },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => { setSelectedDate(parseInt(item.date.split(" ")[1])); setActiveTab("calendar"); }}
                        className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[11px] font-black text-slate-500 font-mono w-12 shrink-0">{item.date}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 group-hover:text-sky-600 transition-colors truncate">{item.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.time} &middot; {item.location}</p>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.color} ml-3`}>{item.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

                {/* ============================================================ */}
                {/* TAB: CLUB CALENDAR (Full-Width Dedicated Tab from Sidebar)    */}
                {/* ============================================================ */}
                {activeTab === "calendar" && (
                  <div className="p-6 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in duration-200">
                    {/* Header Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                          <CalendarIcon className="w-5 h-5 text-sky-600" />
                          Club Calendar & Arena Fixtures
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          Comprehensive monthly schedule of court bookings, championship fixtures, and masterclasses.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Live Feed Synced
                        </span>
                      </div>
                    </div>

                    {/* Calendar Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                      {/* Left: Monthly Calendar (7 cols) */}
                      <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-50/80 border border-slate-200 space-y-4">
                        {/* Month Header */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-sky-600" />
                            {currentMonth}
                          </h3>
                          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Day of Week Headers */}
                        <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-slate-400 tracking-wider pb-2 border-b border-slate-200/80">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                            <div key={i}>{d}</div>
                          ))}
                        </div>

                        {/* Month Days Grid */}
                        <div className="grid grid-cols-7 gap-2 text-center">
                          {calendarCells.map((day, idx) => {
                            if (day === null) return <div key={`e-${idx}`} className="h-12 rounded-xl" />;
                            const hasEvent = importantClubDates[day];
                            const isSelected = selectedDate === day;
                            return (
                              <button
                                key={day}
                                onClick={() => setSelectedDate(day)}
                                className={`h-12 rounded-2xl text-xs font-bold transition-all relative flex flex-col items-center justify-center ${isSelected
                                  ? "bg-slate-900 text-white shadow-lg scale-105"
                                  : hasEvent
                                    ? "bg-white hover:bg-sky-50 text-slate-900 border border-sky-200 font-extrabold shadow-sm"
                                    : "hover:bg-slate-200/60 text-slate-600 bg-white/60"
                                  }`}
                              >
                                <span>{day}</span>
                                {hasEvent && (
                                  <span className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? "bg-lime-400" :
                                    hasEvent.type === "tournament" ? "bg-amber-500" :
                                      hasEvent.type === "training" ? "bg-indigo-500" : "bg-green-500"
                                    }`} />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Legend */}
                        <div className="pt-3 border-t border-slate-200/80 flex items-center gap-4 flex-wrap text-xs text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                            Member Booking
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            Championship Tournament
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            Coaching & Clinic
                          </span>
                        </div>
                      </div>

                      {/* Right: Selected Date & Upcoming Milestones (5 cols) */}
                      <div className="lg:col-span-5 space-y-4">

                        {/* Selected Date Detail */}
                        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
                              <CalendarCheck className="w-4 h-4 text-sky-600" />
                              October {selectedDate}, 2026
                            </h4>
                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                              Daily Schedule
                            </span>
                          </div>

                          {importantClubDates[selectedDate] ? (
                            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${importantClubDates[selectedDate].type === "tournament" ? "bg-amber-400 text-amber-950" :
                                  importantClubDates[selectedDate].type === "training" ? "bg-indigo-100 text-indigo-900" :
                                    "bg-green-100 text-green-900"
                                  }`}>
                                  {importantClubDates[selectedDate].type}
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-700">
                                  {importantClubDates[selectedDate].time}
                                </span>
                              </div>
                              <div className="text-sm font-black text-slate-900">
                                {importantClubDates[selectedDate].title}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-sky-500" />
                                {importantClubDates[selectedDate].location}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-6 text-xs text-slate-400">
                              No major events scheduled for October {selectedDate}. Regular open court practice sessions available.
                            </div>
                          )}
                        </div>

                        {/* All Key Fixtures */}
                        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                            October Milestones & Events
                          </h4>
                          <div className="space-y-2 text-xs">
                            {[
                              { date: "Oct 04", title: "Padel Match #2", time: "07:00 AM", tag: "Booking", color: "bg-green-100 text-green-800" },
                              { date: "Oct 07", title: "Clay Court Masterclass", time: "06:30 PM", tag: "Coaching", color: "bg-indigo-100 text-indigo-800" },
                              { date: "Oct 11", title: "Gujarat Open Championship", time: "09:00 AM", tag: "Tournament", color: "bg-amber-100 text-amber-800" },
                              { date: "Oct 18", title: "VIP Racket Demo", time: "04:00 PM", tag: "Pro Shop", color: "bg-slate-100 text-slate-700" },
                            ].map((item, i) => (
                              <div
                                key={i}
                                className="p-3 rounded-2xl bg-slate-50 hover:bg-sky-50 border border-slate-100 transition-all flex items-center justify-between cursor-pointer"
                                onClick={() => setSelectedDate(parseInt(item.date.split(" ")[1]))}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-black text-xs text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs">
                                    {item.date}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-800 text-xs">{item.title}</div>
                                    <div className="text-[11px] text-slate-400">{item.time}</div>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.color}`}>
                                  {item.tag}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
              )}



            {/* ============================================================ */}
            {/* TAB 3: CRM & CONCIERGE INQUIRIES */}
            {/* ============================================================ */}
            {activeTab === "crm" && (
              <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">

                {/* New Ticket Form */}
                <form
                  onSubmit={handleAddInquiry}
                  className="p-5 sm:p-6 rounded-2xl bg-sky-50/80 border border-sky-200/90 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-sky-600" />
                      <span>Create New CRM Request / Concierge Ticket</span>
                    </h3>
                    {showInquirySuccess && (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full border border-green-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ticket Submitted to Concierge Desk!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Subject / Requirement</label>
                      <input
                        type="text"
                        placeholder="e.g. Schedule racket demo or private coaching on grass..."
                        value={newInquiryTitle}
                        onChange={(e) => setNewInquiryTitle(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Category</label>
                      <select
                        value={newInquiryCat}
                        onChange={(e) => setNewInquiryCat(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500 shadow-sm"
                      >
                        <option value="COACHING">Private Coaching</option>
                        <option value="MEMBERSHIP">Membership Upgrade</option>
                        <option value="TRIAL_PASS">Guest Day Pass</option>
                        <option value="EVENT">Tournament Entry</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Details & Special Timing (Optional)</label>
                      <textarea
                        rows={2}
                        placeholder="Specify preferred timing or coach preferences..."
                        value={newInquiryNotes}
                        onChange={(e) => setNewInquiryNotes(e.target.value)}
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Submit Ticket</span>
                    </button>
                  </div>
                </form>

                {/* Inquiries History List */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Active & Past Concierge Inquiries
                  </h4>

                  {inquiries.map((inq, idx) => (
                    <div
                      key={`${inq.id || "inq"}-${idx}`}
                      className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-sky-300 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                              {inq.id}
                            </span>
                            <span className="text-[11px] font-extrabold text-slate-500 uppercase">
                              {inq.category}
                            </span>
                            <span className="text-xs text-slate-400">&bull; {inq.date}</span>
                          </div>
                          <h4 className="text-sm font-extrabold text-slate-900 mt-1.5">
                            {inq.title}
                          </h4>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${inq.status === "APPROVED"
                          ? "bg-green-100 text-green-800 border border-green-300"
                          : inq.status === "IN_REVIEW"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-sky-100 text-sky-800 border border-sky-300"
                          }`}>
                          {inq.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                        <strong className="text-slate-900">Desk Update:</strong> {inq.notes}
                      </div>

                      <div className="text-xs text-slate-500">
                        Assigned Concierge Agent: <strong className="text-slate-800">{inq.assignedTo}</strong>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 4: ORDERS & RECEIPTS */}
            {/* ============================================================ */}
{activeTab === "orders" && (
              <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                      Club orders
                    </h2>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-black">
                      {filteredOrders.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Filter pills */}
                    <div className="flex items-center gap-1.5">
                      {(["ALL", "PRO_SHOP", "CAFE", "STRINGING"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setOrderFilter(filter)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                            orderFilter === filter
                              ? "bg-slate-900 text-white"
                              : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {filter === "ALL" ? "All" : filter === "PRO_SHOP" ? "Pro shop" : filter.charAt(0) + filter.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>

                    <Link
                      href="/#shop"
                      className="text-sm font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
                    >
                      Order gear <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Order list */}
                <div className="space-y-3">
                  {filteredOrders.map((order, idx) => (
                    <div
                      key={`${order.id || "order"}-${idx}`}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4"
                    >
                      {/* Order header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-black text-slate-900">
                              {order.orderNumber}
                            </span>
                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              order.type === "PRO_SHOP"
                                ? "bg-sky-50 text-sky-700 border-sky-200"
                                : order.type === "CAFE"
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                            }`}>
                              {order.type === "PRO_SHOP" ? "Pro Shop" : order.type.charAt(0) + order.type.slice(1).toLowerCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{order.date}</p>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : order.status === "READY_FOR_PICKUP"
                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {order.status === "COMPLETED" && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {order.status === "READY_FOR_PICKUP" && <Clock className="w-3.5 h-3.5" />}
                          {order.status === "COMPLETED" ? "Completed" : order.status === "READY_FOR_PICKUP" ? "Ready for pickup" : order.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-slate-700">
                              <span className="font-bold text-slate-500 mr-2">{item.quantity}×</span>
                              {item.name}
                            </span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          Paid via {order.paymentMethod}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-xs">Total</span>
                          <span className="font-black text-slate-900 text-base font-[family-name:var(--font-outfit)]">
                            ₹{order.totalAmount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 5: BOOKINGS */}
            {/* ============================================================ */}
            {activeTab === "bookings" && (
              <div className="p-6 sm:p-8 space-y-5 animate-in fade-in duration-200">

                {/* Cancel Feedback Banner */}
                {cancelFeedback && (
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold transition-all ${
                      cancelFeedback.type === "success"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-red-50 border-red-300 text-red-900"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {cancelFeedback.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>{cancelFeedback.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCancelFeedback(null)}
                      className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Court Reservations & Practice Sessions ({filteredBookings.length})
                  </h4>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                      {(["ALL", "CONFIRMED", "COMPLETED", "CANCELLED"] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setBookingFilter(filter)}
                          className={`px-3 py-1 rounded-lg transition-all ${bookingFilter === filter
                            ? "bg-white text-slate-900 shadow-sm font-extrabold"
                            : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>

                    <Link
                      href="/#courts"
                      className="text-xs font-extrabold text-sky-600 hover:underline flex items-center gap-1"
                    >
                      <span>Book New Slot</span> &rarr;
                    </Link>
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="p-12 text-center bg-slate-50 rounded-3xl border border-slate-200/80 space-y-3">
                    <CalendarCheck className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="text-sm font-bold text-slate-700">No {bookingFilter === "ALL" ? "" : bookingFilter.toLowerCase()} bookings found.</div>
                    <Link
                      href="/#courts"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shadow-sm hover:bg-sky-700 transition-colors"
                    >
                      <span>Explore Arenas & Book a Slot</span> &rarr;
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBookings.map((booking, idx) => {
                      const isUpcoming = booking.status === "CONFIRMED";

                      return (
                        <div
                          key={`${booking.id || "booking"}-${idx}`}
                          className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                {booking.bookingCode}
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  booking.status === "CONFIRMED"
                                    ? "bg-green-100 text-green-800 border border-green-300"
                                    : booking.status === "CANCELLED"
                                    ? "bg-red-100 text-red-800 border border-red-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {booking.status}
                              </span>
                            </div>

                            <div className="text-[11px] font-bold text-slate-500 uppercase">
                              {booking.sport} &bull; {booking.surface}
                            </div>

                            <h4 className="text-sm font-black text-slate-900 leading-snug">
                              {booking.courtName}
                            </h4>

                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-sky-800">
                                <Clock className="w-3.5 h-3.5" /> {booking.timeSlot}
                              </div>
                              <div className="text-slate-500 font-medium">
                                {booking.date}
                              </div>
                              {booking.status === "CANCELLED" && booking.cancellationReason && (
                                <div className="text-[11px] text-red-600 font-medium pt-1 border-t border-slate-200/60">
                                  Reason: {booking.cancellationReason}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs flex-wrap">
                            <span className="font-extrabold text-slate-900">
                              ₹{booking.amount} {booking.status === "CANCELLED" ? "Snapshot" : "Paid"}
                            </span>

                            <div className="flex items-center gap-2">
                              {/* Cancel Booking Action - Only for upcoming CONFIRMED bookings */}
                              {isUpcoming ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancellingBooking(booking);
                                    setCancelReason("");
                                    setCancelFeedback(null);
                                  }}
                                  className="px-3 py-1.5 rounded-xl border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-bold text-xs transition-all flex items-center gap-1.5"
                                  title="Cancel this upcoming booking"
                                >
                                  <X className="w-3.5 h-3.5 text-red-600" />
                                  <span>Cancel Booking</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => alert(`Court entry QR & Directions sent to ${activeUser.phone}`)}
                                  className="text-sky-600 font-bold hover:underline"
                                >
                                  Digital Pass &rarr;
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Cancel Booking Confirmation Modal Dialog */}
                {cancellingBooking && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                      className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 p-6 sm:p-7 space-y-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                            <AlertTriangle className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                              Confirm Booking Cancellation
                            </h3>
                            <p className="text-xs text-slate-500">
                              Review refund eligibility and confirm cancellation
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCancellingBooking(null)}
                          disabled={cancelSubmitting}
                          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Booking Details Card */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                            {cancellingBooking.bookingCode}
                          </span>
                          <span className="font-extrabold text-slate-900">
                            ₹{cancellingBooking.amount} Paid
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-900">
                          {cancellingBooking.courtName} ({cancellingBooking.sport})
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>{cancellingBooking.date} &bull; {cancellingBooking.timeSlot}</span>
                        </div>
                      </div>

                      {/* Refund Rule Notification */}
                      {isEligibleForRefund(cancellingBooking.startTime) ? (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Full Refund Eligible (100%)</span>
                          </div>
                          <p className="text-emerald-700 leading-relaxed text-[11px]">
                            This slot is scheduled for 12+ hours from now. Cancelling will credit a full refund of{" "}
                            <strong>₹{cancellingBooking.amount}</strong> to your original payment method / club wallet.
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-amber-800">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Non-Refundable Cancellation Notice</span>
                          </div>
                          <p className="text-amber-700 leading-relaxed text-[11px]">
                            Cancellation is within 12 hours of the slot start time. According to club reservation rules, the booking fee of{" "}
                            <strong>₹{cancellingBooking.amount}</strong> is non-refundable. The court slot will be released for other members.
                          </p>
                        </div>
                      )}

                      {/* Cancellation Reason Selector & Input */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 block">
                          Reason for Cancellation (Optional)
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {["Schedule Conflict", "Injury / Illness", "Personal / Travel", "Weather Conditions"].map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setCancelReason(r)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                cancelReason === r
                                  ? "bg-slate-900 text-white border-slate-900"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Or specify custom reason..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => handleCancelBooking()}
                          disabled={cancelSubmitting}
                          className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {cancelSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Processing Cancellation...</span>
                            </>
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4" />
                              <span>Confirm Cancellation</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setCancellingBooking(null)}
                          disabled={cancelSubmitting}
                          className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                        >
                          Keep Booking
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 6: PAYMENTS & BILLING */}
            {/* ============================================================ */}
            {activeTab === "payments" && (
              <div className="p-6 sm:p-8 space-y-5 animate-in fade-in duration-200">

                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Transaction & Invoicing Records ({activeUser.payments.length})
                  </h4>
                  <div className="text-xs text-slate-500 font-medium">
                    Auto-settled via Club Digital POS
                  </div>
                </div>

                <div className="space-y-3">
                  {activeUser.payments.map((pay, idx) => (
                    <div
                      key={`${pay.id || "PAY"}-${pay.transactionId || idx}-${idx}`}
                      className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="text-xs font-black text-slate-900">
                            {pay.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          <span className="font-mono font-bold text-slate-700">{pay.transactionId}</span>
                          <span>&bull; {pay.date}</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full font-extrabold text-slate-700">
                            {pay.method}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <div className="text-right">
                          <div className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                            ₹{pay.amount.toLocaleString("en-IN")}
                          </div>
                          <span className="text-[10px] font-extrabold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                            {pay.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert(`Downloading official GST Tax invoice for ${pay.transactionId}`)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-colors"
                          title="Download Invoice"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}

            {/* ============================================================ */}
            {/* TAB 7: SETTINGS & PREFERENCES */}
            {/* ============================================================ */}
            {activeTab === "settings" && (
              <div className="p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">

                <form onSubmit={handleSaveSettings} className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Personal Information & Club Preferences
                    </h4>
                    {settingsSaved && (
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded-full border border-green-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Details Updated Successfully!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-extrabold text-slate-700 block mb-1">Primary Sport Arena</label>
                      <select
                        value={preferredSport}
                        onChange={(e) => setPreferredSport(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                      >
                        <option value="Tennis">Tennis (Natural Grass & Clay)</option>
                        <option value="Padel">Panoramic Glass Padel</option>
                        <option value="Pickleball">Pro Pickleball</option>
                        <option value="Aquatics">Heated Olympic Pool</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all"
                    >
                      Save Preferences
                    </button>
                  </div>
                </form>

              </div>
            )}

            {/* ============================================================ */}
            {/* BOTTOM FOOTER CONTROL BAR */}
            {/* ============================================================ */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              {canAccessConsole ? (
                <Link
                  href="/dashboard"
                  className="text-xs font-extrabold text-slate-700 hover:text-sky-600 flex items-center gap-1.5 transition-colors"
                >
                  <span>Open Staff & Admin Dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                  <span>Verified Club Member Digital Account</span>
                </div>
              )}

              <button
                onClick={() => {
                  logout("/login");
                  router.push("/login");
                }}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 transition-all flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* ============================================================ */}
      {/* MODAL: TOP-UP WALLET */}
      {/* ============================================================ */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  Add Funds to Wallet
                </h3>
              </div>
              <button
                onClick={() => setShowTopupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Instantly credit your member wallet to reserve grass & clay courts, pro shop gear, and café tabs without card swipes.
            </p>

            <form onSubmit={handleTopup} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-700">Top-up Amount (₹)</label>
                <div className="grid grid-cols-3 gap-2 my-2">
                  {[1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupAmount(amt)}
                      className={`py-2 rounded-xl text-xs font-extrabold border transition-all ${topupAmount === amt
                        ? "bg-sky-600 text-white border-sky-600 shadow-md"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                    >
                      ₹{amt.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  min={100}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900"
                  required
                />
              </div>

              {topupSuccess ? (
                <div className="p-3 rounded-xl bg-green-50 text-green-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-green-200">
                  <CheckCircle2 className="w-4 h-4" /> ₹{topupAmount.toLocaleString("en-IN")} Added Successfully!
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm shadow-md transition-all"
                >
                  Confirm Instant Top-Up (₹{topupAmount.toLocaleString("en-IN")})
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: PAY ACTIVE TAB */}
      {/* ============================================================ */}
      {showPayTabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-lime-50 text-lime-700">
                  <Coffee className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  Settle Active Tab
                </h3>
              </div>
              <button
                onClick={() => setShowPayTabModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <div className="text-xs text-slate-500 font-bold uppercase">Outstanding Amount Due</div>
              <div className="text-3xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                ₹{activeUser.clubTabsOutstanding.toLocaleString("en-IN")}
              </div>
              <p className="text-[11px] text-slate-500">Includes café smoothies & pro shop accessories tab</p>
            </div>

            {payTabSuccess ? (
              <div className="p-3 rounded-xl bg-green-50 text-green-700 text-xs font-bold flex items-center justify-center gap-1.5 border border-green-200">
                <CheckCircle2 className="w-4 h-4" /> Active Tab Settled in Full!
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handlePayTab}
                  className="w-full py-3 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm shadow-md transition-all"
                >
                  Pay ₹{activeUser.clubTabsOutstanding.toLocaleString("en-IN")} via Saved Card
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayTabModal(false)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: SUPER OWNER ACCESS DELEGATOR (pushplamba104@gmail.com) */}
      {/* ============================================================ */}
      {showGrantModal && isSuperOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-amber-300 space-y-5 animate-in zoom-in-95 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-900 border border-amber-400/30">
                  <Crown className="w-6 h-6 text-amber-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-1.5">
                    Master Access Delegator
                  </h3>
                  <p className="text-[11px] text-amber-800 font-bold">
                    Super Owner Sovereign Portal &bull; pushplamba104@gmail.com
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowGrantModal(false);
                  setGrantSuccessMsg("");
                  setGrantErrorMsg("");
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              As the <strong>Super Owner</strong>, you can grant custom access to anyone by entering their Gmail ID. The backend handles database provisioning, role enforcement, and department scoping automatically.
            </p>

            {grantSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-green-50 border border-green-200 text-green-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <span>{grantSuccessMsg}</span>
              </div>
            )}

            {grantErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{grantErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleGrantAccess} className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-800 block mb-1">
                  User / Staff Gmail ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    placeholder="e.g. employee@gmail.com or name@championsclub.in"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-800 block mb-1">
                  Employee Full Name (Optional)
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={grantName}
                    onChange={(e) => setGrantName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1">
                    System Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={grantRole}
                    onChange={(e) => setGrantRole(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 bg-white shadow-sm"
                  >
                    <option value="ADMIN">Admin (Full Control)</option>
                    <option value="STAFF">Department Staff</option>
                    <option value="FRONT_DESK">Front Desk Reception</option>
                    <option value="COACH">Head Coach / Trainer</option>
                    <option value="SHOP_STAFF">Pro Shop Manager</option>
                    <option value="BAR_STAFF">Café & Lounge Lead</option>
                    <option value="MAINTENANCE">Facility & Maintenance</option>
                    <option value="MEMBER">Club Member (Standard)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1">
                    Assigned Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={grantDepartment}
                    onChange={(e) => setGrantDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 bg-white shadow-sm"
                  >
                    <option value="Badminton">Badminton Department</option>
                    <option value="Tennis">Tennis & Lawn Courts</option>
                    <option value="Cricket">Box Cricket Arena</option>
                    <option value="Swimming">Olympic Aquatics</option>
                    <option value="Table Tennis">Table Tennis Wing</option>
                    <option value="Gym">Health Club & Fitness</option>
                    <option value="Dining">Dining & Café Lounge</option>
                    <option value="Accounts">Accounts & Billing</option>
                    <option value="Operations">Operations General</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGranting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Key className="w-4 h-4" />
                  <span>{isGranting ? "Delegating Access..." : "Grant & Delegate Access"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto py-8 bg-slate-950 text-white text-center text-xs text-slate-400 border-t border-slate-800">
        <p>&copy; {new Date().getFullYear()} The Champions Club. Elite Sports & Country Resort Member Portal.</p>
      </footer>
    </div>
  );
}
