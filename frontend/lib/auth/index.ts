/**
 * Champions Club — Authentication & User Session Services
 *
 * Connected directly with Flask JWT backend (/api/v1/auth & /api/v1/members)
 * with support for client-side Demo member sessions and reactive hooks.
 */

import { useSyncExternalStore } from "react";
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
  id: string;
  bookingCode: string;
  courtName: string;
  sport: string;
  surface: string;
  date: string;
  timeSlot: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
  amount: number;
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
  walletBalance: number;
  clubTabsOutstanding: number;
  avatarUrl?: string;
  crmInquiries: UserCRMInquiry[];
  orders: UserOrder[];
  bookings: UserBooking[];
  payments: UserPayment[];
  first_name?: string;
  last_name?: string;
  full_name?: string;
  is_active?: boolean;
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
};

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
  if (!parsed.membershipPlan) parsed.membershipPlan = "GOLD";
  if (!parsed.membershipStatus) parsed.membershipStatus = "ACTIVE";
  if (!parsed.membershipExpiry) parsed.membershipExpiry = "March 31, 2027";
  if (!parsed.joinDate) parsed.joinDate = "January 15, 2024";
  if (parsed.walletBalance === undefined) parsed.walletBalance = 8500;
  if (parsed.clubTabsOutstanding === undefined) parsed.clubTabsOutstanding = 1250;
  if (!parsed.crmInquiries || !Array.isArray(parsed.crmInquiries)) parsed.crmInquiries = DEMO_MEMBERS.alex.crmInquiries;
  if (!parsed.orders || !Array.isArray(parsed.orders)) parsed.orders = DEMO_MEMBERS.alex.orders;
  if (!parsed.bookings || !Array.isArray(parsed.bookings)) parsed.bookings = DEMO_MEMBERS.alex.bookings;
  if (!parsed.payments || !Array.isArray(parsed.payments)) parsed.payments = DEMO_MEMBERS.alex.payments;

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
  const user: AuthUserProfile | null = userJson ? enrichUserProfile(JSON.parse(userJson)) : null;

  return {
    user,
    isAuthenticated: user !== null,
    isLoading: false,
    login: (profile: AuthUserProfile) => setStoredUser(profile),
    logout: () => clearStoredUser(),
  };
}

export function hasRole(user: AuthUserProfile | AuthUser | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
