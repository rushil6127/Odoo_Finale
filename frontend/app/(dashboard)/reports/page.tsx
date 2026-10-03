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
  ArrowUpRight
} from "lucide-react";

interface ReportSummary {
  department: string;
  revenue: number;
  bookings: number;
  sharePct: number;
  trend: string;
}

const REVENUE_BY_DEPT: ReportSummary[] = [
  { department: "🏸 Badminton Pavilion (6 Courts)", revenue: 384000, bookings: 420, sharePct: 32, trend: "+18%" },
  { department: "🎾 Lawn Tennis Arenas (Grass & Clay)", revenue: 295000, bookings: 195, sharePct: 24, trend: "+12%" },
  { department: "🍽️ Sports Bar & Café POS", revenue: 210000, bookings: 540, sharePct: 18, trend: "+25%" },
  { department: "🏊‍♂️ Olympic Aquatic Pavilion", revenue: 145000, bookings: 280, sharePct: 12, trend: "+8%" },
  { department: "🛍️ Pro Shop & Restringing Services", revenue: 98000, bookings: 85, sharePct: 8, trend: "+15%" },
  { department: "🏏 Box Cricket Astroturf", revenue: 72000, bookings: 64, sharePct: 6, trend: "+30%" },
];

const AUDIT_LOGS = [
  { id: 1, action: "Member Tier Upgraded to Black Card", user: "Pushp Lamba (Super Owner)", timestamp: "Today, 4:15 PM", ip: "192.168.1.10", status: "SUCCESS" },
  { id: 2, action: "Day-End POS Tab Batch Settlement (₹84,500)", user: "Front Desk Cashier", timestamp: "Today, 3:30 PM", ip: "192.168.1.45", status: "SUCCESS" },
  { id: 3, action: "Lawn Tennis Court 2 Locked for Grass Rolling", user: "Head Groundsman", timestamp: "Today, 1:00 PM", ip: "192.168.1.22", status: "SUCCESS" },
  { id: 4, action: "Staff Role Assigned: Tennis Coach to Vikram S.", user: "Pushp Lamba (Owner)", timestamp: "Yesterday, 6:40 PM", ip: "192.168.1.10", status: "SUCCESS" },
];

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("THIS_MONTH");

  const totalGrossRevenue = REVENUE_BY_DEPT.reduce((acc, r) => acc + r.revenue, 0);
  const totalBookings = REVENUE_BY_DEPT.reduce((acc, r) => acc + r.bookings, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Executive Financial & Audit Reports
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Department revenue reconciliation, court booking utilization, GST tax ledger, and sovereign audit trail.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            onClick={() => alert("Exporting formatted PDF & Excel audit workbook...")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 text-white shadow-md transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Audit Workbook</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Gross Club Revenue (MTD)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{totalGrossRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">+21.4% vs previous month</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Reservations Filled</p>
          <p className="text-2xl font-black text-sky-600 mt-1">{totalBookings} Slots</p>
          <p className="text-[11px] text-slate-500 mt-1">Across 18 courts & arenas</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">GST & Hospitality Tax Accrued</p>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{Math.round(totalGrossRevenue * 0.05).toLocaleString()}</p>
          <p className="text-[11px] text-slate-500 mt-1">5% GST rate compliant</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Avg Spend Per Active Member</p>
          <p className="text-2xl font-black text-purple-600 mt-1">₹14,250</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">+9.8% member retention</p>
        </div>
      </div>

      {/* Revenue by Department Breakdown */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Department Performance Breakdown
            </h3>
            <p className="text-xs text-slate-500">Revenue and slot volume breakdown by sports wing and hospitality</p>
          </div>
        </div>

        <div className="space-y-4">
          {REVENUE_BY_DEPT.map((dept) => (
            <div key={dept.department} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">{dept.department}</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-slate-400">{dept.bookings} sessions</span>
                  <span className="font-black text-slate-900">₹{dept.revenue.toLocaleString()}</span>
                  <span className="text-emerald-600 font-bold text-[11px]">{dept.trend}</span>
                </div>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${dept.sharePct}%` }}
                />
              </div>
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
          {AUDIT_LOGS.map((log) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
