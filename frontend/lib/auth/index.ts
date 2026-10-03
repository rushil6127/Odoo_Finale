/**
 * Champions Club — Authentication & User Session Services
 *
 * Connected directly with Flask JWT backend (/api/v1/auth & /api/v1/members)
 */

import { apiClient, ApiError } from "@/lib/api/client";
import type { UserRole } from "@/types";

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

const TOKEN_KEY = "cc_token";
const USER_KEY = "cc_user";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Authenticate user with email and password
 */
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

/**
 * Authenticate or register with Google OAuth credential
 */
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

/**
 * Self-service registration for new members
 */
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

/**
 * Fetch currently authenticated user profile from /auth/me
 */
export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await apiClient.get<{ user: AuthUser }>("/auth/me");
  if (res?.user) {
    setStoredUser(res.user);
  }
  return res.user;
}

/**
 * Fetch member profile details including membership tier and sports privileges
 */
export async function fetchMemberProfile(): Promise<MemberProfile> {
  const res = await apiClient.get<{ member: MemberProfile }>("/members/me");
  return res.member;
}

/**
 * Update member profile
 */
export async function updateMemberProfile(memberId: number, data: Partial<MemberProfile>): Promise<MemberProfile> {
  const res = await apiClient.put<{ member: MemberProfile }>(`/members/${memberId}`, data);
  return res.member;
}

/**
 * Log out and redirect
 */
export function logout(redirectPath: string = "/login"): void {
  clearAuthSession();
  if (typeof window !== "undefined") {
    window.location.href = redirectPath;
  }
}

/**
 * Check if the user has one of the allowed roles
 */
export function hasRole(user: AuthUser | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
