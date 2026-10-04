/**
 * Champions Club — Authentication & User Session Services
 *
 * Connected directly with Flask JWT backend (/api/v1/auth & /api/v1/members)
 * with support for client-side Demo member sessions and reactive hooks.
 */

import { useSyncExternalStore, useMemo } from "react";
import { apiClient } from "@/lib/api/client";
import type { UserRole, MembershipPlan, MembershipStatus } from "@/types";

// ============================================================================
// BACKEND DATA TYPES & INTERFACES
// ============================================================================

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MemberProfile {
  id: number;
  user_id: number;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  user?: AuthUser;
  active_membership?: {
    id: number;
    plan_code: string;
    plan_name: string;
    status: string;
    start_date: string;
    end_date: string;
  } | null;
  created_at?: string;
}

export interface LoginResponseData {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

// ============================================================================
// RICH CLIENT-SIDE PROFILE & DEMO TYPES
// ============================================================================

export interface UserCRMInquiry {
  id: string;
  title: string;
  category: "MEMBERSHIP" | "TRIAL_PASS" | "COACHING" | "EVENT";
  status: "NEW" | "IN_REVIEW" | "APPROVED" | "CLOSED";
  date: string;
  notes: string;
  assignedTo: string;
}

export interface UserOrder {
  id: string;
  orderNumber: string;
  type: "PRO_SHOP" | "CAFE" | "STRINGING";
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  status: "COMPLETED" | "PREPARING" | "READY_FOR_PICKUP" | "CANCELLED";
  date: string;
  paymentMethod: string;
}

export interface UserBooking {
  id: string | number;
  numericId?: number;
  bookingId?: number;
  bookingCode: string;
  courtName: string;
  sport: string;
  surface: string;
  date: string;
  timeSlot: string;
  startTime?: string;
  endTime?: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  amount: number;
  title?: string;
  matchType?: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
}

export interface UserPayment {
  id: string;
  transactionId: string;
  description: string;
  amount: number;
  date: string;
  method: "UPI" | "CARD" | "WALLET" | "NET_BANKING";
  status: "PAID" | "PENDING" | "REFUNDED";
  invoiceUrl?: string;
}

export interface EmployeeCourtSlot {
  id: string;
  timeSlot: string;
  courtName: string;
  sport: string;
  memberId?: number;
  memberName: string;
  memberTier: string;
  memberAvatar?: string;
  type: "MEMBER_BOOKING" | "COACHING_SESSION" | "TOURNAMENT_MATCH" | "MAINTENANCE_BLOCK";
  status: "CONFIRMED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  specialRequests?: string;
  equipmentRequired?: string[];
  coachingPlan?: string;
}

export interface EmployeeTrainee {
  id: string;
  name: string;
  tier: string;
  phone: string;
  skillLevel: string;
  sport: string;
  totalSessionsCompleted: number;
  nextSessionDate: string;
  focusArea: string;
  lastProgressNote: string;
}

export interface EmployeeMaintenanceTask {
  id: string;
  courtName: string;
  taskType: "GRASS_MOWING" | "CLAY_ROLLING" | "NET_TENSION" | "LIGHTING_CHECK" | "STRINGING_JOB";
  status: "READY" | "IN_PROGRESS" | "SCHEDULED" | "REQUIRES_ATTENTION";
  scheduledTime: string;
  assignedStaff: string;
  notes: string;
}

export interface EmployeeData {
  employeeId: string;
  designation: string;
  primarySport: string;
  secondarySports: string[];
  assignedCourts: string[];
  shiftTiming: string;
  shiftName: string;
  dutyStatus: "ON_DUTY" | "IN_SESSION" | "ON_BREAK" | "OFF_DUTY";
  certifications: string[];
  yearsExperience: number;
  rating: number;
  totalSessionsConducted: number;
  todaySlots: EmployeeCourtSlot[];
  trainees: EmployeeTrainee[];
  maintenanceTasks: EmployeeMaintenanceTask[];
}

export interface AuthUserProfile {
  id: number;
  memberCode: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  membershipPlan: MembershipPlan;
  membershipStatus: MembershipStatus;
  membershipExpiry: string;
  joinDate: string;
  membershipStartDate?: string;
  membership_plan?: string;
  membership_status?: string;
  membership_start_date?: string;
  membership_end_date?: string;
  active_membership?: any;
  walletBalance: number;
  clubTabsOutstanding: number;
  avatarUrl?: string;
  avatar_url?: string;
  date_of_birth?: string;
  age?: number;
  crmInquiries: UserCRMInquiry[];
  orders: UserOrder[];
  bookings: UserBooking[];
  payments: UserPayment[];
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_active?: boolean;
  employeeData?: EmployeeData;
}

// ============================================================================
// DEMO ACCOUNTS
// ============================================================================

export const DEMO_MEMBERS: Record<string, AuthUserProfile> = {
  alex: {
    id: 101,
    memberCode: "CC-GOLD-8492",
    name: "Alex Morgan",
    email: "alex.morgan@championsclub.in",
    phone: "+91 98250 14820",
    role: "MEMBER",
    membershipPlan: "GOLD",
    membershipStatus: "ACTIVE",
    membershipExpiry: "March 31, 2027",
    joinDate: "January 15, 2024",
    walletBalance: 8500,
    clubTabsOutstanding: 1250,
    crmInquiries: [
      {
        id: "CRM-2041",
        title: "VIP Wimbledon Grass Court Private Coaching Request",
        category: "COACHING",
        status: "APPROVED",
        date: "Today, 10:30 AM",
        notes: "Assigned Head Coach David for weekend morning sessions.",
        assignedTo: "David Vance (Senior Coach)",
      },
      {
        id: "CRM-1980",
        title: "Family Membership Tier Upgrade Enquiry",
        category: "MEMBERSHIP",
        status: "IN_REVIEW",
        date: "Yesterday",
        notes: "Quote prepared for 4-member annual Gold package with pool access.",
        assignedTo: "Priya Sharma (Concierge Lead)",
      },
    ],
    orders: [
      {
        id: "ORD-9481",
        orderNumber: "#CC-SHOP-9481",
        type: "PRO_SHOP",
        items: [
          { name: "Wilson Pro Staff 97 v14 Racket", quantity: 1, price: 18500 },
          { name: "Slazenger Championship 4-Ball Can", quantity: 3, price: 850 },
        ],
        totalAmount: 21050,
        status: "COMPLETED",
        date: "Today, 11:15 AM",
        paymentMethod: "Club Wallet",
      },
      {
        id: "ORD-9430",
        orderNumber: "#CC-CAFE-9430",
        type: "CAFE",
        items: [
          { name: "Whey Protein Berry Blast Smoothie", quantity: 2, price: 320 },
          { name: "Artisan Double Espresso", quantity: 1, price: 210 },
        ],
        totalAmount: 850,
        status: "READY_FOR_PICKUP",
        date: "Today, 09:45 AM",
        paymentMethod: "Member Charge Tab",
      },
      {
        id: "ORD-9204",
        orderNumber: "#CC-SHOP-9204",
        type: "STRINGING",
        items: [
          { name: "Babolat RPM Blast 1.25mm Stringing (54 lbs)", quantity: 1, price: 1400 },
        ],
        totalAmount: 1400,
        status: "COMPLETED",
        date: "Oct 01, 2026",
        paymentMethod: "UPI",
      },
    ],
    bookings: [
      {
        id: "BK-7701",
        bookingCode: "RES-7701",
        courtName: "Centre Grass Court #1 (Natural Lawn)",
        sport: "Tennis",
        surface: "Championship Natural Grass",
        date: "Today, Oct 03",
        timeSlot: "05:00 PM – 06:00 PM",
        status: "CONFIRMED",
        amount: 1200,
      },
      {
        id: "BK-7688",
        bookingCode: "RES-7688",
        courtName: "Panoramic Glass Padel Court #2",
        sport: "Padel",
        surface: "Supercourt Mondo Turf",
        date: "Tomorrow, Oct 04",
        timeSlot: "07:00 AM – 08:00 AM",
        status: "CONFIRMED",
        amount: 800,
      },
      {
        id: "BK-7502",
        bookingCode: "RES-7502",
        courtName: "Roland-Garros Red Clay Arena #3",
        sport: "Tennis",
        surface: "European Red Clay",
        date: "Sep 30, 2026",
        timeSlot: "06:00 PM – 07:00 PM",
        status: "COMPLETED",
        amount: 900,
      },
    ],
    payments: [
      {
        id: "PAY-501",
        transactionId: "TXN_CC_98372019",
        description: "Gold Annual Membership Renewal 2026-27",
        amount: 75000,
        date: "Jan 15, 2026",
        method: "CARD",
        status: "PAID",
        invoiceUrl: "#",
      },
      {
        id: "PAY-502",
        transactionId: "TXN_CC_98450123",
        description: "Pro Shop Order #CC-SHOP-9481 (Racket & Balls)",
        amount: 21050,
        date: "Today, 11:15 AM",
        method: "WALLET",
        status: "PAID",
        invoiceUrl: "#",
      },
      {
        id: "PAY-503",
        transactionId: "TXN_CC_98421008",
        description: "Wallet Auto-Topup via HDFC Bank UPI",
        amount: 10000,
        date: "Oct 01, 2026",
        method: "UPI",
        status: "PAID",
        invoiceUrl: "#",
      },
    ],
  },
  admin: {
    id: 1,
    memberCode: "CC-STAFF-001",
    name: "Priya Sharma",
    email: "priya.sharma@championsclub.in",
    phone: "+91 99090 88210",
    role: "ADMIN",
    membershipPlan: "GOLD",
    membershipStatus: "ACTIVE",
    membershipExpiry: "Lifetime Staff Access",
    joinDate: "June 01, 2023",
    walletBalance: 15000,
    clubTabsOutstanding: 0,
    crmInquiries: [],
    orders: [],
    bookings: [],
    payments: [],
  },
  coach_david: {
    id: 42,
    memberCode: "CC-COACH-042",
    name: "Coach David Vance",
    email: "david.vance@championsclub.in",
    phone: "+91 98980 44120",
    role: "COACH",
    membershipPlan: "GOLD",
    membershipStatus: "ACTIVE",
    membershipExpiry: "Staff Lifetime Contract",
    joinDate: "August 10, 2022",
    walletBalance: 24500,
    clubTabsOutstanding: 0,
    crmInquiries: [
      {
        id: "CRM-2041",
        title: "VIP Wimbledon Grass Court Private Coaching Request (Alex Morgan)",
        category: "COACHING",
        status: "APPROVED",
        date: "Today, 10:30 AM",
        notes: "Focusing on low-bounce slice service & grass court baseline defense.",
        assignedTo: "David Vance (Senior Coach)",
      },
      {
        id: "CRM-2105",
        title: "Junior High-Performance Academy Trial Assessment (Dev Patel)",
        category: "TRIAL_PASS",
        status: "NEW",
        date: "Today, 12:15 PM",
        notes: "NTRP assessment required for U-16 Gujarat State championship entry.",
        assignedTo: "David Vance (Senior Coach)",
      },
    ],
    orders: [],
    bookings: [],
    payments: [],
    employeeData: {
      employeeId: "EMP-TR-042",
      designation: "Head Coach & Arena Supervisor",
      primarySport: "Tennis",
      secondarySports: ["Padel", "Pickleball"],
      assignedCourts: [
        "Centre Grass Court #1 (Natural Lawn)",
        "Roland-Garros Red Clay Arena #3",
        "Grandstand Synthetic Court #2"
      ],
      shiftName: "Morning & Afternoon Shift",
      shiftTiming: "06:00 AM – 02:00 PM (Active Duty)",
      dutyStatus: "ON_DUTY",
      certifications: [
        "ITF Level 3 High Performance Certified Coach",
        "USPTA Elite Professional (Tennis)",
        "PTR Certified Tennis & Padel Director",
        "CPR / AED Emergency Sports First Responder"
      ],
      yearsExperience: 12,
      rating: 4.95,
      totalSessionsConducted: 428,
      todaySlots: [
        {
          id: "SLOT-101",
          timeSlot: "06:00 AM – 07:00 AM",
          courtName: "Roland-Garros Red Clay Arena #3",
          sport: "Tennis",
          memberName: "Rohan Gupta",
          memberTier: "Gold Member",
          type: "COACHING_SESSION",
          status: "COMPLETED",
          specialRequests: "Heavy top-spin drills from baseline & endurance",
          equipmentRequired: ["72 Slazenger Clay Balls", "Agility Cones"],
          coachingPlan: "Crosscourt forehand heavy spin repetition",
        },
        {
          id: "SLOT-102",
          timeSlot: "07:30 AM – 08:30 AM",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          sport: "Tennis",
          memberName: "Ananya Deshmukh",
          memberTier: "Silver Member",
          type: "MEMBER_BOOKING",
          status: "COMPLETED",
          specialRequests: "Court booking with ball boy assistance",
          equipmentRequired: ["Slazenger Match Balls (Can of 4)"],
        },
        {
          id: "SLOT-103",
          timeSlot: "09:00 AM – 10:30 AM",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          sport: "Tennis",
          memberName: "Junior High Performance Squad",
          memberTier: "Academy Trainees",
          type: "COACHING_SESSION",
          status: "COMPLETED",
          specialRequests: "Group footwork and net volley approach drill",
          equipmentRequired: ["Lobster Grand Series Ball Machine", "Target Markers"],
          coachingPlan: "Grass court short-hop volley reaction training",
        },
        {
          id: "SLOT-104",
          timeSlot: "11:00 AM – 12:00 PM",
          courtName: "Roland-Garros Red Clay Arena #3",
          sport: "Tennis",
          memberName: "Vikram & Sameer (Doubles Match)",
          memberTier: "Platinum VIP",
          type: "MEMBER_BOOKING",
          status: "COMPLETED",
          specialRequests: "Court watered & rolled prior to start",
        },
        {
          id: "SLOT-105",
          timeSlot: "03:00 PM – 04:00 PM",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          sport: "Tennis",
          memberName: "Dev Patel (Trial Pass Candidate)",
          memberTier: "Trial Guest",
          type: "COACHING_SESSION",
          status: "CHECKED_IN",
          specialRequests: "NTRP assessment & trial evaluation for Academy admission",
          equipmentRequired: ["Assessment Evaluation Sheet", "Speed Radar Gun"],
          coachingPlan: "Serve velocity & baseline consistency testing",
        },
        {
          id: "SLOT-106",
          timeSlot: "05:00 PM – 06:00 PM",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          sport: "Tennis",
          memberName: "Alex Morgan",
          memberTier: "Gold VIP Member",
          type: "MEMBER_BOOKING",
          status: "CONFIRMED",
          specialRequests: "Lawn freshly cut, Babolat RPM stringing ready at shop",
          equipmentRequired: ["Match Balls", "Towel Service"],
        },
        {
          id: "SLOT-107",
          timeSlot: "06:30 PM – 07:30 PM",
          courtName: "Roland-Garros Red Clay Arena #3",
          sport: "Tennis",
          memberName: "Meera Singhania",
          memberTier: "Gold Member",
          type: "COACHING_SESSION",
          status: "CONFIRMED",
          specialRequests: "Serve toss alignment and second serve kick practice",
          equipmentRequired: ["Basket of 60 Balls", "Video Analysis iPad"],
          coachingPlan: "Second serve kick bounce mechanics",
        },
        {
          id: "SLOT-108",
          timeSlot: "08:00 PM – 09:30 PM",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          sport: "Tennis",
          memberName: "Gujarat Open Club Doubles Quarterfinals",
          memberTier: "Club Tournament",
          type: "TOURNAMENT_MATCH",
          status: "CONFIRMED",
          specialRequests: "Floodlights on (800 LUX), Head Umpire Chair prepared",
          equipmentRequired: ["Tournament Slazenger Hydroguard Cans", "Scoreboard Flipchart"],
        },
      ],
      trainees: [
        {
          id: "TR-01",
          name: "Alex Morgan",
          tier: "Gold VIP",
          phone: "+91 98250 14820",
          skillLevel: "NTRP 4.5 (Advanced)",
          sport: "Tennis",
          totalSessionsCompleted: 28,
          nextSessionDate: "Today, 05:00 PM",
          focusArea: "Grass Court Serve & Volley transition",
          lastProgressNote: "Backhand slice is staying low consistently. Ready for upcoming club championship.",
        },
        {
          id: "TR-02",
          name: "Rohan Gupta",
          tier: "Gold Member",
          phone: "+91 98110 55219",
          skillLevel: "NTRP 4.0 (Intermediate-High)",
          sport: "Tennis",
          totalSessionsCompleted: 19,
          nextSessionDate: "Oct 06, 06:00 AM",
          focusArea: "Heavy Clay baseline topspin & foot recovery",
          lastProgressNote: "Forehand RPM increased by 15%. Stamina in 3rd set drills improved significantly.",
        },
        {
          id: "TR-03",
          name: "Ananya Deshmukh",
          tier: "Silver Member",
          phone: "+91 97240 88910",
          skillLevel: "NTRP 3.5 (Intermediate)",
          sport: "Tennis",
          totalSessionsCompleted: 12,
          nextSessionDate: "Oct 07, 05:30 PM",
          focusArea: "First serve consistency & Continental grip adjustment",
          lastProgressNote: "First serve percentage reached 62% in practice set. Good foot placement.",
        },
        {
          id: "TR-04",
          name: "Dev Patel",
          tier: "Academy Trial",
          phone: "+91 99040 33211",
          skillLevel: "NTRP 4.0 (Junior U-16)",
          sport: "Tennis",
          totalSessionsCompleted: 0,
          nextSessionDate: "Today, 03:00 PM",
          focusArea: "Academy Entrance Assessment & Kinetic Chain Analysis",
          lastProgressNote: "First evaluation session today. Candidate shows excellent natural athleticism.",
        },
      ],
      maintenanceTasks: [
        {
          id: "MT-01",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          taskType: "GRASS_MOWING",
          status: "READY",
          scheduledTime: "05:30 AM (Completed)",
          assignedStaff: "Groundsman Ramesh",
          notes: "Cut to 8.5mm tournament height. Net height verified 36 inches center.",
        },
        {
          id: "MT-02",
          courtName: "Roland-Garros Red Clay Arena #3",
          taskType: "CLAY_ROLLING",
          status: "READY",
          scheduledTime: "01:30 PM (Completed)",
          assignedStaff: "Groundsman Manoj",
          notes: "Moisture level optimal. Line tape swept and cleaned.",
        },
        {
          id: "MT-03",
          courtName: "Centre Grass Court #1 (Natural Lawn)",
          taskType: "LIGHTING_CHECK",
          status: "SCHEDULED",
          scheduledTime: "06:00 PM (Prior to Night Match)",
          assignedStaff: "Electrician Suresh",
          notes: "Check 800 LUX floodlight array #4 before Quarterfinal doubles.",
        },
        {
          id: "MT-04",
          courtName: "Pro Shop Stringing Workshop",
          taskType: "STRINGING_JOB",
          status: "READY",
          scheduledTime: "10:00 AM (Completed)",
          assignedStaff: "Coach David & Pro Shop Staff",
          notes: "Alex Morgan's Babolat Pure Aero strung with RPM Blast 54 lbs.",
        },
      ],
    },
  },
};

export const DEFAULT_COACH_EMPLOYEE_DATA: EmployeeData = DEMO_MEMBERS.coach_david.employeeData!;

// ============================================================================
// STORAGE KEYS & EVENT DISPATCHER
// ============================================================================

const TOKEN_KEY = "cc_token";
const USER_KEY = "cc_user";
const STORAGE_KEY = "champions_club_active_user";
const AUTH_EVENT_KEY = "cc_auth_state_changed";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function enrichUserProfile(parsed: any): (AuthUserProfile & AuthUser) | null {
  if (!parsed) return null;
  if (!parsed.full_name && parsed.first_name) {
    parsed.full_name = `${parsed.first_name} ${parsed.last_name || ""}`.trim();
  }
  if (!parsed.name) {
    parsed.name = parsed.full_name || (parsed.email ? parsed.email.split("@")[0] : "Member");
  }
  if (!parsed.memberCode) parsed.memberCode = `CC-${(parsed.role || "MEM").toUpperCase()}-${parsed.id || 101}`;
  if (!parsed.phone) parsed.phone = "+91 98765 43210";
  // Dynamic membership plan binding
  if (parsed.membership_plan) {
    parsed.membershipPlan = parsed.membership_plan.toUpperCase();
  } else if (parsed.active_membership?.plan?.code) {
    parsed.membershipPlan = parsed.active_membership.plan.code.toUpperCase();
  } else if (!parsed.membershipPlan) {
    parsed.membershipPlan = "";
  }

  // Dynamic membership status binding
  if (parsed.membership_status) {
    parsed.membershipStatus = parsed.membership_status;
  } else if (parsed.active_membership?.status) {
    parsed.membershipStatus = parsed.active_membership.status;
  } else if (!parsed.membershipStatus) {
    parsed.membershipStatus = "NONE";
  }

  // Dynamic membership expiry / end date
  if (parsed.membership_end_date) {
    parsed.membershipExpiry = parsed.membership_end_date;
  } else if (parsed.active_membership?.end_date) {
    parsed.membershipExpiry = parsed.active_membership.end_date;
  } else if (!parsed.membershipExpiry) {
    parsed.membershipExpiry = "";
  }

  // Dynamic membership start date
  if (parsed.membership_start_date) {
    parsed.joinDate = parsed.membership_start_date;
    parsed.membershipStartDate = parsed.membership_start_date;
  } else if (parsed.active_membership?.start_date) {
    parsed.joinDate = parsed.active_membership.start_date;
    parsed.membershipStartDate = parsed.active_membership.start_date;
  } else if (!parsed.joinDate) {
    parsed.joinDate = "";
    parsed.membershipStartDate = "";
  }

  if (parsed.walletBalance === undefined) parsed.walletBalance = 0;
  if (parsed.clubTabsOutstanding === undefined) parsed.clubTabsOutstanding = 0;
  if (!parsed.crmInquiries || !Array.isArray(parsed.crmInquiries)) parsed.crmInquiries = [];
  if (!parsed.orders || !Array.isArray(parsed.orders)) parsed.orders = [];
  if (!parsed.bookings || !Array.isArray(parsed.bookings)) parsed.bookings = [];
  if (!parsed.payments || !Array.isArray(parsed.payments)) parsed.payments = [];
  if (parsed.avatar_url && !parsed.avatarUrl) parsed.avatarUrl = parsed.avatar_url;
  if (parsed.avatarUrl && !parsed.avatar_url) parsed.avatar_url = parsed.avatarUrl;

  return parsed as (AuthUserProfile & AuthUser);
}

export function getStoredUser(): (AuthUserProfile & AuthUser) | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return enrichUserProfile(parsed);
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUserProfile | AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_EVENT_KEY));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT_KEY));
}

export function clearStoredUser(): void {
  clearAuthSession();
}

// ============================================================================
// API AUTH SERVICES (Connected to Flask Backend)
// ============================================================================

export async function loginUser(email: string, password: string): Promise<LoginResponseData> {
  const data = await apiClient.post<LoginResponseData>("/auth/login", {
    email: email.trim(),
    password,
  });

  if (data?.access_token) {
    setStoredToken(data.access_token);
    if (data.user) {
      setStoredUser(data.user);
    }
  }

  return data;
}

export async function loginWithGoogle(credential: string): Promise<LoginResponseData> {
  const data = await apiClient.post<LoginResponseData>("/auth/google", {
    credential,
  });

  if (data?.access_token) {
    setStoredToken(data.access_token);
    if (data.user) {
      setStoredUser(data.user);
    }
  }

  return data;
}

export async function registerUser(payload: RegisterPayload): Promise<LoginResponseData> {
  const data = await apiClient.post<LoginResponseData>("/auth/register", {
    email: payload.email.trim(),
    password: payload.password,
    first_name: payload.first_name.trim(),
    last_name: payload.last_name.trim(),
  });

  if (data?.access_token) {
    setStoredToken(data.access_token);
    if (data.user) {
      setStoredUser(data.user);
    }
  }

  return data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await apiClient.get<{ user: AuthUser }>("/auth/me");
  if (res?.user) {
    setStoredUser(res.user);
  }
  return res.user;
}

export async function fetchMemberProfile(): Promise<MemberProfile> {
  const res = await apiClient.get<{ member: MemberProfile }>("/members/me");
  return res.member;
}

export async function updateMemberProfile(memberId: number, data: Partial<MemberProfile>): Promise<MemberProfile> {
  const res = await apiClient.put<{ member: MemberProfile }>(`/members/${memberId}`, data);
  return res.member;
}

export async function updateMyMemberProfile(data: {
  date_of_birth?: string | null;
  phone?: string;
  gender?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}): Promise<MemberProfile> {
  const res = await apiClient.put<{ member: MemberProfile }>("/members/me", data);
  return res.member;
}

export function getAvatarImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) {
    return url;
  }
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
  return `${rawBase}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function uploadUserAvatar(fileOrDataUrl: File | string): Promise<{ user: AuthUser; avatar_url: string }> {
  if (typeof fileOrDataUrl === "string") {
    const res = await apiClient.post<{ user: AuthUser; avatar_url: string }>("/auth/avatar", {
      avatar_url: fileOrDataUrl,
    });
    if (res?.user) {
      setStoredUser(res.user);
    }
    return res;
  } else {
    const formData = new FormData();
    formData.append("file", fileOrDataUrl);
    const token = getStoredToken();
    const rawBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1").replace(/\/+$/, "");
    const base = rawBaseUrl.endsWith("/api/v1") ? rawBaseUrl : `${rawBaseUrl}/api/v1`;
    const response = await fetch(`${base}/auth/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || "Failed to upload avatar");
    }
    const data = result.data || result;
    if (data?.user) {
      setStoredUser(data.user);
    }
    return data;
  }
}

export async function deleteUserAvatar(): Promise<void> {
  const res = await apiClient.delete<{ user: AuthUser }>("/auth/avatar");
  if (res?.user) {
    setStoredUser(res.user);
  }
}

export function logout(redirectPath: string = "/login"): void {
  clearAuthSession();
  if (typeof window !== "undefined") {
    window.location.href = redirectPath;
  }
}

// ============================================================================
// REACT EXTERNAL STORE SUBSCRIPTION HOOK
// ============================================================================

function subscribe(callback: () => void) {
  window.addEventListener(AUTH_EVENT_KEY, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(AUTH_EVENT_KEY, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) || localStorage.getItem(USER_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useCurrentUser() {
  const userJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useMemo(() => {
    if (!userJson) return null;
    try {
      return enrichUserProfile(JSON.parse(userJson));
    } catch {
      return null;
    }
  }, [userJson]);

  return {
    user,
    isAuthenticated: user !== null,
    isLoading: false,
    login: (profile: AuthUserProfile) => setStoredUser(profile),
    logout: (redirectPath: string = "/login") => {
      clearStoredUser();
      clearAuthSession();
      if (typeof window !== "undefined") {
        window.location.href = redirectPath;
      }
    },
  };
}

export function hasRole(user: AuthUserProfile | AuthUser | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function isStaffOrAdmin(user: AuthUserProfile | AuthUser | null): boolean {
  if (!user) return false;
  if (user.email === "pushplamba104@gmail.com" || user.email === "italiyaheer7@gmail.com") return true;
  const role = (user.role || "").toString().toUpperCase();
  return ["OWNER", "ADMIN", "MANAGER", "FRONT_DESK", "STAFF", "SHOP_STAFF", "BAR_STAFF", "COACH", "TRAINER", "INSTRUCTOR", "MAINTENANCE"].includes(role);
}

export function isOwner(user: AuthUserProfile | AuthUser | null): boolean {
  if (!user) return false;
  const role = (user.role || "").toString().toUpperCase();
  return role === "OWNER" || user.email === "pushplamba104@gmail.com" || user.email === "italiyaheer7@gmail.com";
}

/**
 * Returns the exact role profile destination URL:
 * - Owner -> /profile/owner
 * - Employee/Staff/Coach/Admin/Manager -> /profile/employee
 * - Member -> /profile/member
 */
export function getRoleProfilePath(user: AuthUserProfile | AuthUser | null | undefined): string {
  if (!user) return "/profile/member";
  if (isOwner(user)) {
    return "/profile/owner";
  }
  if (isStaffOrAdmin(user)) {
    return "/profile/employee";
  }
  return "/profile/member";
}

