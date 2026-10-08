/**
 * Champions Club — Centralized API Client
 *
 * Provides a typed fetch wrapper for all backend communication.
 *
 * Features:
 *  - Base URL from environment
 *  - JSON request/response handling
 *  - Authorization header injection
 *  - Consistent error handling
 *  - GET / POST / PUT / PATCH / DELETE helpers
 *
 * Usage:
 *   import { apiClient } from "@/lib/api/client";
 *   const res = await apiClient.get<Member[]>("/members");
 */

import type { ApiResponse } from "@/types/api";

/* ============================================================
   Configuration
   ============================================================ */

const rawBaseUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1"
).replace(/\/+$/, "");

const BASE_URL: string = rawBaseUrl.endsWith("/api/v1")
  ? rawBaseUrl
  : rawBaseUrl.endsWith("/api")
  ? `${rawBaseUrl}/v1`
  : `${rawBaseUrl}/api/v1`;

/* ============================================================
   Token Accessor
   ============================================================ */

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cc_token");
}

/* ============================================================
   Error Class
   ============================================================ */

export class ApiError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/* ============================================================
   Core Request
   ============================================================ */

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...options?.headers,
  };

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
    signal: options?.signal,
  };

  if (body !== undefined && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (netErr: any) {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      `Unable to reach backend service (${netErr?.message || "Failed to fetch"}). Ensure backend is active.`
    );
  }

  // Handle non-JSON responses (e.g. 204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  let json: ApiResponse<T>;

  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "PARSE_ERROR",
      "Failed to parse server response"
    );
  }

  if (!response.ok || !json.success) {
    const errorResponse = json as { success: false; error?: { code?: string; message?: string } };
    
    // Automatically handle token expiration
    if (response.status === 401 && errorResponse.error?.code === "TOKEN_EXPIRED") {
      if (typeof window !== "undefined") {
        localStorage.removeItem("cc_token");
        localStorage.removeItem("cc_user");
        localStorage.removeItem("cc_role");
        window.location.href = "/login";
      }
    }
    
    throw new ApiError(
      response.status,
      errorResponse.error?.code ?? "UNKNOWN_ERROR",
      errorResponse.error?.message ?? "An unexpected error occurred"
    );
  }

  return (json as { success: true; data: T }).data;
}

/* ============================================================
   Public API
   ============================================================ */

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", path, undefined, options);
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("POST", path, body, options);
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PUT", path, body, options);
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>("PATCH", path, body, options);
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, undefined, options);
  },
};

export default apiClient;
