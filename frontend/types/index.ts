/**
 * Champions Club — Domain Types
 *
 * Central type definitions mirroring the backend API contract.
 * Keep in sync with backend models.
 */

/* ============================================================
   Enums / Union Types
   ============================================================ */

export type MembershipPlan = "GOLD" | "SILVER" | "JUNIOR";

export type MembershipStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED";

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED";

export type PaymentMethod = "CASH" | "CARD" | "UPI" | "ONLINE";

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export type OrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "DELIVERED" | "CANCELLED";

export type OrderType = "PICKUP" | "DELIVERY" | "DINE_IN";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type CRMStage = "NEW" | "CONTACTED" | "TRIAL_BOOKED" | "QUOTE_SENT" | "CONVERTED";

export type UserRole =
  | "OWNER"
  | "ADMIN"
  | "FRONT_DESK"
  | "SHOP_STAFF"
  | "BAR_STAFF"
  | "COACH"
  | "MEMBER";

/* ============================================================
   Core Domain Models
   ============================================================ */

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  phone: string;
  membershipPlan: MembershipPlan;
  membershipStatus: MembershipStatus;
  membershipExpiry: string;
  joinDate: string;
}

export interface Membership {
  id: number;
  memberId: number;
  plan: MembershipPlan;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  benefits: string[];
}

export interface Court {
  id: number;
  name: string;
  sport: string;
  isActive: boolean;
}

export interface Booking {
  id: number;
  memberId: number;
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  price: number;
  isSocialPlay: boolean;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  memberPrice: number | null;
  category: string;
  imageUrl: string | null;
  stockStatus: StockStatus;
  stockQuantity: number;
}

export interface InventoryItem {
  id: number;
  productId: number;
  productName: string;
  currentStock: number;
  lowStockThreshold: number;
  status: StockStatus;
}

export interface Order {
  id: number;
  memberId: number | null;
  items: OrderItem[];
  total: number;
  discount: number;
  status: OrderStatus;
  type: OrderType;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceId: string | null;
  createdAt: string;
}

export interface CRMLead {
  id: number;
  name: string;
  email: string;
  phone: string;
  source: string;
  interestedPlan: MembershipPlan | null;
  stage: CRMStage;
  trialDate: string | null;
  notes: string;
  createdAt: string;
}

export interface Employee {
  id: number;
  userId: number;
  name: string;
  role: UserRole;
  isActive: boolean;
  joinDate: string;
}

/* ============================================================
   Dashboard / KPI Types
   ============================================================ */

export interface DashboardKPI {
  revenue: number;
  activeMembers: number;
  todayBookings: number;
  courtUtilization: number;
  shopSales: number;
  barSales: number;
  outstandingPayments: number;
  lowStockCount: number;
}
