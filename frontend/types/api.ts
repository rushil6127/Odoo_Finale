/**
 * Champions Club — API Response Types
 *
 * Typed wrappers for all API responses.
 * The backend returns a consistent shape per rules.md §7.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
