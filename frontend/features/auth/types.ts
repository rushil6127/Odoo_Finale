import type { User, UserRole } from "@/types";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthSession {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
}
