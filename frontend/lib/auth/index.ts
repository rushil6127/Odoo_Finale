/**
 * Champions Club — Auth Utilities (placeholder)
 *
 * Will be implemented in Phase 1.
 * Provides stub types and helpers for the auth flow.
 */

import type { User, UserRole } from "@/types";

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const initialAuthState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
};

/**
 * Check if the current user has one of the allowed roles.
 * Actual enforcement happens on the backend — this is UI-only.
 */
export function hasRole(user: User | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
