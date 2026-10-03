import { useSyncExternalStore } from "react";
import type { UserRole, MembershipPlan, MembershipStatus } from "@/types";

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
}

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

const STORAGE_KEY = "champions_club_active_user";
const AUTH_EVENT_KEY = "cc_auth_state_changed";

/**
 * Get the currently logged-in user from localStorage
 */
export function getStoredUser(): AuthUserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUserProfile;
  } catch {
    return null;
  }
}

/**
 * Save user profile to localStorage & broadcast event
 */
export function setStoredUser(user: AuthUserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_EVENT_KEY));
}

/**
 * Remove session & broadcast event
 */
export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT_KEY));
}

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
  return localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

/**
 * Custom React Hook to subscribe to user auth changes
 */
export function useCurrentUser() {
  const userJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user: AuthUserProfile | null = userJson ? JSON.parse(userJson) : null;

  return {
    user,
    isAuthenticated: user !== null,
    isLoading: false,
    login: (profile: AuthUserProfile) => setStoredUser(profile),
    logout: () => clearStoredUser(),
  };
}

/**
 * Check if the user has a permitted role
 */
export function hasRole(user: AuthUserProfile | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
