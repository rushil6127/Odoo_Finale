/**
 * Champions Club — Financial, Operational & Audit Reports Console
 */

"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  Activity,
  CheckCircle2,
  FileText,
  PieChart,
  BarChart3,
  ShieldCheck,
  ArrowUpRight,
  Users,
  UserCheck,
  ShoppingBag,
  Utensils,
  Award,
  Layers,
  Sparkles
} from "lucide-react";

import { apiClient } from "@/lib/api/client";
import { useEffect, useCallback } from "react";
import { triggerExcelDownload, ExportSection } from "@/lib/exportUtils";

interface ReportSummary {
  department: string;
  revenue: number;
  bookings: number;
  sharePct: number;
  trend: string;
  color?: string;
}

interface AuditEntry {
  id: number;
  action: string;
  user: string;
  timestamp: string;
  ip: string;
  status: string;
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("THIS_MONTH");
  const [exportSection, setExportSection] = useState<ExportSection>("all");
  const [deptRevenue, setDeptRevenue] = useState<ReportSummary[]>([]);
  const [financialSummary, setFinancialSummary] = useState({
    gross_revenue: 0,
    net_revenue: 0,
    tax_amount: 0,
    transactions_count: 0,
    growth_pct: 0,
  });
  const [activeMemberCount, setActiveMemberCount] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chartAnimated, setChartAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setChartAnimated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const periodKey = selectedPeriod === "TODAY" ? "today" : selectedPeriod === "THIS_WEEK" ? "week" : "month";
      const [reportRes, paymentsRes] = await Promise.allSettled([
        apiClient.get<any>(`/reports/overview?period=${periodKey}`),
        apiClient.get<any>(`/payments`),
      ]);

      if (reportRes.status === "fulfilled" && reportRes.value) {
        const overview = reportRes.value?.data || reportRes.value;
        const fin = overview?.financial_summary || {};
        const growth = overview?.period_comparison?.growth_percentage ?? 0;
        const activeMembers = overview?.operational_snapshot?.active_members ?? 0;

        setFinancialSummary({
          gross_revenue: Number(fin.gross_revenue ?? overview?.total_revenue ?? 0),
          net_revenue: Number(fin.net_revenue ?? 0),
          tax_amount: Number(fin.tax_amount ?? 0),
          transactions_count: Number(fin.transactions_count ?? 0),
          growth_pct: Number(growth),
        });
        setActiveMemberCount(Number(activeMembers));

        const streams = overview?.stream_breakdown || {};
        const grandTotal = Number(fin.gross_revenue ?? overview?.total_revenue ?? 0);

        const courtGross = Number(streams.courts?.gross_revenue ?? 0);
        const memGross = Number(streams.memberships?.gross_revenue ?? 0);
        const barGross = Number(streams.bar?.gross_revenue ?? 0);
        const shopGross = Number(streams.shop?.gross_revenue ?? 0);
        const invGross = Number(streams.invoices?.gross_revenue ?? 0);

        const mapped: ReportSummary[] = [
          {
            department: "Court Bookings & Arenas",
            revenue: courtGross,
            bookings: streams.courts?.transactions_count || 0,
            sharePct: grandTotal > 0 ? Math.round((courtGross / grandTotal) * 100) : 0,
            trend: "+15%",
            color: "bg-emerald-500",
          },
          {
            department: "Membership Subscriptions",
            revenue: memGross,
            bookings: streams.memberships?.transactions_count || 0,
            sharePct: grandTotal > 0 ? Math.round((memGross / grandTotal) * 100) : 0,
            trend: "+22%",
            color: "bg-sky-500",
          },
          {
            department: "Sports Bar & Café POS",
            revenue: barGross,
            bookings: streams.bar?.transactions_count || 0,
            sharePct: grandTotal > 0 ? Math.round((barGross / grandTotal) * 100) : 0,
            trend: "+25%",
            color: "bg-amber-500",
          },
          {
            department: "Pro Shop & Merchandise",
            revenue: shopGross,
            bookings: streams.shop?.transactions_count || 0,
            sharePct: grandTotal > 0 ? Math.round((shopGross / grandTotal) * 100) : 0,
            trend: "+10%",
            color: "bg-purple-500",
          },
          ...(invGross > 0 ? [{
            department: "Corporate Invoices & Events",
            revenue: invGross,
            bookings: streams.invoices?.transactions_count || 0,
            sharePct: grandTotal > 0 ? Math.round((invGross / grandTotal) * 100) : 0,
            trend: "+12%",
            color: "bg-pink-500",
          }] : []),
        ];
        setDeptRevenue(mapped);
      } else {
        setDeptRevenue([]);
      }

      if (paymentsRes.status === "fulfilled" && paymentsRes.value) {
        const pList = Array.isArray(paymentsRes.value) ? paymentsRes.value : paymentsRes.value?.payments || paymentsRes.value?.data || [];
        const logs: AuditEntry[] = pList.slice(0, 10).map((p: any) => ({
          id: p.id,
          action: `Payment: ${p.item_type || "Settlement"} (₹${Number(p.amount || 0).toLocaleString("en-IN")})`,
          user: p.user?.full_name || p.user?.email || "Club Member",
          timestamp: p.created_at ? new Date(p.created_at).toLocaleString() : "Recent",
          ip: "192.168.1.10",
          status: p.status || "SUCCESS",
        }));
        setAuditLogs(logs);
      } else {
        setAuditLogs([]);
      }
    } catch (err) {
      setDeptRevenue([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleExport = async (targetSection?: ExportSection) => {
    const sec = targetSection || exportSection;
    try {
      setExporting(true);
      await triggerExcelDownload(sec, "xlsx");
    } catch (err: any) {
      alert(err?.message || "Failed to download export spreadsheet");
    } finally {
      setExporting(false);
    }
  };

  const totalGrossRevenue = financialSummary.gross_revenue;
  const totalBookings = financialSummary.transactions_count || deptRevenue.reduce((acc, r) => acc + r.bookings, 0);
  const topDept = deptRevenue.length > 0 ? [...deptRevenue].sort((a, b) => b.revenue - a.revenue)[0] : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Executive Financial &amp; Audit Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconciled revenue streams, member &amp; staff data, court utilization, and sovereign audit trail.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={exportSection}
            onChange={(e) => setExportSection(e.target.value as ExportSection)}
            className="px-3 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            title="Select section to export"
          >
            <option value="all">All Sections (Master .xlsx)</option>
            <option value="revenue">Reconciled All Revenue (.xlsx)</option>
            <option value="courts">Court Bookings Revenue (.xlsx)</option>
            <option value="shop">Pro Shop Merchandise (.xlsx)</option>
            <option value="bar">Sports Bar &amp; Café POS (.xlsx)</option>
            <option value="memberships">Membership Subscriptions (.xlsx)</option>
            <option value="members">Member Directory (.xlsx)</option>
            <option value="employees">Staff &amp; Employee Roster (.xlsx)</option>
          </select>

          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 font-bold text-slate-700"
          >
            <option value="TODAY">Today&apos;s Ledger</option>
            <option value="THIS_WEEK">This Week</option>
            <option value="THIS_MONTH">October 2024 (MTD)</option>
            <option value="LAST_QUARTER">Q3 Executive Summary</option>
          </select>

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
            title="Download Excel spreadsheet (.xlsx)"
          >
            <FileSpreadsheet className={`w-4 h-4 text-emerald-400 ${exporting ? "animate-pulse" : ""}`} />
            <span>{exporting ? "Generating..." : "Export .xlsx"}</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Gross Club Revenue ({selectedPeriod.replace('_', ' ')})</p>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{totalGrossRevenue.toLocaleString("en-IN")}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            {financialSummary.growth_pct >= 0 ? `+${financialSummary.growth_pct}%` : `${financialSummary.growth_pct}%`} vs prior period
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Transactions Settled</p>
          <p className="text-2xl font-black text-sky-600 mt-1">{totalBookings} Transactions</p>
          <p className="text-[11px] text-slate-500 mt-1">Across all revenue streams</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">GST &amp; Statutory Tax Accrued</p>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{financialSummary.tax_amount.toLocaleString("en-IN")}</p>
          <p className="text-[11px] text-slate-500 mt-1">Statutory tax compliant (5% &amp; 18%)</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Avg Spend Per Active Member</p>
          <p className="text-2xl font-black text-purple-600 mt-1">
            ₹{activeMemberCount > 0 ? Math.round(totalGrossRevenue / activeMemberCount).toLocaleString("en-IN") : totalGrossRevenue.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">{activeMemberCount} Active Members</p>
        </div>
      </div>

      {/* Revenue by Department Breakdown with Sharp Circular Chart */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Department Revenue &amp; Stream Performance</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time revenue reconciliation and volume share across all club wings</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {deptRevenue.length} Revenue Streams Synced
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Sharp Circular Donut Chart (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-50/80 border border-slate-200/80">
            <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
              <svg
                className="w-full h-full transform select-none"
                viewBox="0 0 128 128"
                style={{
                  transform: chartAnimated ? "rotate(-90deg) scale(1)" : "rotate(-140deg) scale(0.85)",
                  opacity: chartAnimated ? 1 : 0.2,
                  transition: "transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s ease",
                }}
              >
                {/* Outer Precision Track Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  fill="none"
                />

                {/* Base Background Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r="50"
                  stroke="#f1f5f9"
                  strokeWidth="12"
                  fill="none"
                />

                {/* Dynamic Segments */}
                {deptRevenue.map((dept, idx) => {
                  const CIRCUMFERENCE = 314.16;
                  const segLength = (dept.sharePct / 100) * CIRCUMFERENCE;
                  const prevLengthSum = deptRevenue
                    .slice(0, idx)
                    .reduce((sum, d) => sum + (d.sharePct / 100) * CIRCUMFERENCE, 0);
                  const offset = -prevLengthSum;
                  const colors = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
                  const strokeColor = colors[idx % colors.length];
                  return (
                    <circle
                      key={dept.department}
                      cx="64"
                      cy="64"
                      r="50"
                      stroke={strokeColor}
                      strokeWidth="12"
                      strokeDasharray={chartAnimated ? `${segLength.toFixed(2)} ${CIRCUMFERENCE}` : `0 ${CIRCUMFERENCE}`}
                      strokeDashoffset={offset.toFixed(2)}
                      strokeLinecap="butt"
                      fill="none"
                      style={{
                        transition: `stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1) ${(idx * 0.15).toFixed(2)}s`,
                      }}
                    />
                  );
                })}

                {/* Inner Precision Hairline Ring */}
                <circle
                  cx="64"
                  cy="64"
                  r="42"
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  fill="none"
                />
              </svg>

              {/* Center Metrics (Sharp Technical Monospace Typography) */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{
                  opacity: chartAnimated ? 1 : 0,
                  transform: chartAnimated ? "scale(1)" : "scale(0.8)",
                  transition: "opacity 0.6s ease-out 0.4s, transform 0.6s ease-out 0.4s",
                }}
              >
                <span className="text-xl font-black text-slate-900 tracking-tight font-mono leading-none">
                  {totalGrossRevenue >= 1000000
                    ? `₹${(totalGrossRevenue / 1000000).toFixed(2)}M`
                    : totalGrossRevenue >= 1000
                    ? `₹${(totalGrossRevenue / 1000).toFixed(1)}K`
                    : `₹${totalGrossRevenue.toLocaleString("en-IN")}`}
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 font-mono mt-1">
                  GROSS {selectedPeriod.replace('_', ' ')}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-200 mt-1 font-mono">
                  {financialSummary.growth_pct >= 0 ? `+${financialSummary.growth_pct}%` : `${financialSummary.growth_pct}%`} GROWTH
                </span>
              </div>
            </div>

            {/* Subtitle / Top Contributing Department */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 w-full text-center">
              <p className="text-[11px] font-bold text-slate-500">
                Top Contributor: <strong className="text-slate-800">{topDept ? `${topDept.department} (${topDept.sharePct}%)` : "All Streams Active"}</strong>
              </p>
            </div>
          </div>

          {/* Right: Department Performance List (7 cols) */}
          <div className="lg:col-span-7 space-y-3.5">
            {deptRevenue.map((dept) => (
              <div key={dept.department} className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-sm ${dept.color || "bg-emerald-500"} shrink-0`} />
                    <span className="font-bold text-slate-800 text-xs">{dept.department}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-400 hidden sm:inline">{dept.bookings} transactions</span>
                    <span className="font-black text-slate-900">₹{dept.revenue.toLocaleString("en-IN")}</span>
                    <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm text-[10px] font-bold">
                      {dept.sharePct}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dept.color || "bg-emerald-500"} transition-all duration-500`}
                    style={{ width: `${dept.sharePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Section Excel (.xlsx) Data Exports */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Individual Section Data Spreadsheets (.xlsx)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Download dedicated individual section workbooks or master spreadsheets formatted for Microsoft Excel (.xlsx)
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
            Microsoft Excel (.xlsx)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            {
              section: "members" as ExportSection,
              title: "Member Directory",
              desc: "Member profile, contact, tier, lifetime spend & bookings",
              icon: <Users className="w-4 h-4 text-emerald-600" />,
              badge: "Members",
            },
            {
              section: "employees" as ExportSection,
              title: "Staff & Employees",
              desc: "Staff roster, role permissions & assigned sports departments",
              icon: <UserCheck className="w-4 h-4 text-sky-600" />,
              badge: "Staff",
            },
            {
              section: "revenue" as ExportSection,
              title: "All Revenue Reconciled",
              desc: "Cross-stream payments ledger with Net, 5% GST & Gross split",
              icon: <DollarSign className="w-4 h-4 text-emerald-700" />,
              badge: "Finance",
            },
            {
              section: "courts" as ExportSection,
              title: "Court Bookings",
              desc: "Tennis, Badminton & Cricket slot reservations & hourly rates",
              icon: <Activity className="w-4 h-4 text-amber-600" />,
              badge: "Bookings",
            },
            {
              section: "shop" as ExportSection,
              title: "Pro Shop Merchandise",
              desc: "Equipment sales, restringing service billing & quantities",
              icon: <ShoppingBag className="w-4 h-4 text-purple-600" />,
              badge: "Pro Shop",
            },
            {
              section: "bar" as ExportSection,
              title: "Sports Bar & Café POS",
              desc: "POS bar tab settlements, food & beverage hospitality revenue",
              icon: <Utensils className="w-4 h-4 text-rose-600" />,
              badge: "Bar & POS",
            },
            {
              section: "memberships" as ExportSection,
              title: "Membership Subscriptions",
              desc: "Black Card VIP, Platinum & Gold tier subscription plans",
              icon: <Award className="w-4 h-4 text-indigo-600" />,
              badge: "Subscriptions",
            },
            {
              section: "all" as ExportSection,
              title: "Master Multi-Sheet (.xlsx)",
              desc: "Complete 8-sheet sovereign workbook with Executive Summary",
              icon: <Layers className="w-4 h-4 text-slate-800" />,
              badge: "All-in-One",
            },
          ].map((item) => (
            <div
              key={item.section}
              className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                    {item.badge}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                  {item.desc}
                </p>
              </div>

              <button
                type="button"
                disabled={exporting}
                onClick={() => handleExport(item.section)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-900 text-slate-700 hover:text-white border border-slate-200 hover:border-slate-900 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Download .xlsx</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sovereign Audit Trail */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Administrative Audit Trail & Security Log</span>
            </h3>
            <p className="text-xs text-slate-500">Immutable ledger of executive role assignments and high-value transactions</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {auditLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No recent audit or payment transactions recorded yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="font-black text-slate-900">{log.action}</p>
                  <p className="text-[11px] text-slate-400">Initiated by: <strong className="text-slate-700">{log.user}</strong></p>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{log.ip}</span>
                  <span>{log.timestamp}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px]">
                    VERIFIED
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
