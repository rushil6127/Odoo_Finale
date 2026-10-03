/**
 * Champions Club — Excel (.exl / .xlsx) Export Client Utility
 * ============================================================
 * Initiates seamless direct spreadsheet downloads with JWT authentication
 * for all club data:
 * - Master Multi-Sheet Workbook ('all')
 * - Member Directory ('members')
 * - Employee & Staff Roster ('employees')
 * - Reconciled Revenue ('revenue')
 * - Individual Sections: 'courts', 'shop', 'bar', 'memberships'
 */

export type ExportSection =
  | "all"
  | "members"
  | "employees"
  | "revenue"
  | "courts"
  | "shop"
  | "bar"
  | "memberships";

export async function triggerExcelDownload(
  section: ExportSection = "all",
  format: "xlsx" | "exl" = "xlsx",
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("cc_token") : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

  const params = new URLSearchParams({
    section,
    format,
  });

  if (options?.startDate) params.set("start_date", options.startDate);
  if (options?.endDate) params.set("end_date", options.endDate);
  if (token) params.set("token", token);

  const url = `${baseUrl}/reports/export/excel?${params.toString()}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    let errMessage = `Export failed (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.message) errMessage = errJson.message;
    } catch {
      // Ignore json parse error
    }
    throw new Error(errMessage);
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;

  const contentDisp = res.headers.get("content-disposition");
  let filename = `champions_club_${section}.${format}`;
  if (contentDisp && contentDisp.includes("filename=")) {
    filename = contentDisp.split("filename=")[1].replace(/["']/g, "").trim();
  }

  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
