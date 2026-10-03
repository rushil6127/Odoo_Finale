"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Search,
  Filter,
  ShieldCheck,
  Building,
  User,
  Phone,
  Mail,
  Loader2,
  RefreshCw,
  X,
  Check,
  Activity,
  Layers
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface CourtItem {
  id: number;
  name: string;
  sport_type: string;
  surface_type?: string;
  is_indoor: boolean;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  features?: {
    last_maintenance_note?: string;
    last_maintained_by?: string;
    last_maintenance_date?: string;
  };
}

interface BookingItem {
  id: number;
  booking_reference: string;
  court_id: number;
  court_name: string;
  sport_type: string;
  surface_type?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  member_name: string;
  member_email: string;
  member_phone: string;
  notes?: string;
}

const DEPARTMENTS = [
  { id: "BADMINTON", name: "Badminton Section", icon: "🏸" },
  { id: "LAWN_TENNIS", name: "Lawn Tennis Arenas", icon: "🎾" },
  { id: "BOX_CRICKET", name: "Box Cricket Arenas", icon: "🏏" },
  { id: "TABLE_TENNIS", name: "Table Tennis Pavilion", icon: "🏓" },
  { id: "SWIMMING_POOL", name: "Aquatic Pavilion", icon: "🏊‍♂️" },
  { id: "VOLLEYBALL", name: "Beach Volleyball", icon: "🏐" },
];

export default function StaffBookingDashboard() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [selectedSport, setSelectedSport] = useState<string>("BADMINTON");
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Maintenance Modal
  const [selectedCourtForMaint, setSelectedCourtForMaint] = useState<CourtItem | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [newCourtStatus, setNewCourtStatus] = useState<"MAINTENANCE" | "ACTIVE">("MAINTENANCE");

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user as any);
    if ((user as any)?.department) {
      setSelectedSport((user as any).department);
    }
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchSchedule = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>(`/bookings/department-schedule?sport=${selectedSport}`);
      if (res && res.data) {
        setCourts(res.data.courts || []);
        setBookings(res.data.bookings || []);
      }
    } catch (err: any) {
      console.error("Failed to load department schedule:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSport]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleUpdateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourtForMaint) return;

    try {
      setActionLoading(true);
      const res = await apiClient.post<any>(`/bookings/courts/${selectedCourtForMaint.id}/maintenance`, {
        status: newCourtStatus,
        notes: maintenanceNote,
      });

      if (res && (res.status === "success" || res.data)) {
        showToast("success", `Court '${selectedCourtForMaint.name}' updated to ${newCourtStatus}.`);
        setSelectedCourtForMaint(null);
        setMaintenanceNote("");
        fetchSchedule();
      } else {
        showToast("error", res.message || "Failed to update maintenance.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to update maintenance.");
    } finally {
      setActionLoading(false);
    }
  };

  const currentDeptConfig = DEPARTMENTS.find((d) => d.id === selectedSport) || {
    id: selectedSport,
    name: `${selectedSport} Section`,
    icon: "🏟️",
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.member_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.booking_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.court_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const isOwnerOrAdmin =
    currentUser?.role === "OWNER" ||
    currentUser?.role === "ADMIN" ||
    currentUser?.email === "pushplamba104@gmail.com";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-in slide-in-from-top-4 ${
            notification.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-700/50"
              : "bg-red-950/90 text-red-200 border-red-700/50"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 md:p-8 shadow-xl">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Staff Operational Schedule & Maintenance Controller
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <span>{currentDeptConfig.icon}</span>
              <span>{currentDeptConfig.name} Operational Desk</span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Live court reservation feed, member check-ins, and court maintenance management for the {currentDeptConfig.name}.
            </p>
          </div>

          {/* Department Selector (for Admins / Owners / Cross-department managers) */}
          <div className="flex items-center gap-3">
            {isOwnerOrAdmin ? (
              <div className="flex items-center gap-2 bg-zinc-800/90 border border-zinc-700 rounded-xl px-3 py-2">
                <Building className="w-4 h-4 text-emerald-400" />
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id} className="bg-zinc-900 text-white">
                      {dept.icon} {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="px-3.5 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 border border-zinc-700">
                Assigned: {currentDeptConfig.name}
              </div>
            )}

            <button
              onClick={() => fetchSchedule()}
              className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/60 transition-all"
              title="Refresh schedule"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Section Stats */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4 text-zinc-300">
            <span>Section Courts: <strong className="text-white">{courts.length}</strong></span>
            <span>Today&apos;s Bookings: <strong className="text-emerald-400">{bookings.length}</strong></span>
            <span>Under Maintenance: <strong className="text-amber-400">{courts.filter(c => c.status === "MAINTENANCE").length}</strong></span>
          </div>

          <div className="text-zinc-500 font-mono text-[11px]">
            Staff Scope: Employees monitor bookings & maintenance only
          </div>
        </div>
      </div>

      {/* SECTION 1: COURTS & MAINTENANCE STATUS CARDS */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-amber-400" />
          {currentDeptConfig.name} — Courts & Facility Condition
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courts.map((court) => {
            const isMaint = court.status === "MAINTENANCE";
            return (
              <div
                key={court.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isMaint
                    ? "bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-bold text-white text-base truncate">{court.name}</h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      isMaint
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }`}
                  >
                    {court.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-zinc-400 mb-4">
                  <p>Surface: <strong className="text-zinc-300">{court.surface_type || "Standard"}</strong></p>
                  <p>Type: <strong className="text-zinc-300">{court.is_indoor ? "Indoor Arena" : "Outdoor"}</strong></p>
                  {court.features?.last_maintenance_note && (
                    <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 mt-2">
                      <span className="text-amber-400 font-semibold">Note: </span>
                      {court.features.last_maintenance_note}
                      {court.features.last_maintenance_date && (
                        <span className="block text-zinc-500 text-[10px] mt-0.5">
                          {court.features.last_maintenance_date}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedCourtForMaint(court);
                    setNewCourtStatus(isMaint ? "ACTIVE" : "MAINTENANCE");
                    setMaintenanceNote(court.features?.last_maintenance_note || "");
                  }}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all ${
                    isMaint
                      ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-emerald-500/30"
                      : "bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border-amber-500/30"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{isMaint ? "Mark Active & Ready" : "Put Under Maintenance"}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: LIVE BOOKINGS & SCHEDULE ROSTER */}
      <div className="space-y-4 pt-4 border-t border-zinc-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Who Booked Which Court — Live Operational Roster
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Real-time schedule of members and guests playing in the {currentDeptConfig.name}.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member / reference..."
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-950/80 border border-zinc-700/60 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-700/60 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Status</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-zinc-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm">Loading court schedule...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 space-y-2">
              <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="font-semibold text-zinc-300">No bookings scheduled for today</p>
              <p className="text-xs text-zinc-500">All {currentDeptConfig.name} courts are currently open for match sessions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3.5 px-4">Court Arena</th>
                    <th className="py-3.5 px-4">Reserved Time Slot</th>
                    <th className="py-3.5 px-4">Booked Member / Guest</th>
                    <th className="py-3.5 px-4">Booking Ref</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredBookings.map((b) => {
                    const startStr = b.start_time ? new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                    const endStr = b.end_time ? new Date(b.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                    const isConfirmed = b.status === "CONFIRMED";

                    return (
                      <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{currentDeptConfig.icon}</span>
                            <span>{b.court_name}</span>
                          </div>
                          <div className="text-xs text-zinc-400">{b.surface_type || "Synthetic Surface"}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-emerald-400 flex items-center gap-1.5 text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{startStr} – {endStr}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500">{b.booking_date}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{b.member_name}</span>
                          </div>
                          <div className="text-xs text-zinc-400 font-mono flex items-center gap-2 mt-0.5">
                            <Phone className="w-3 h-3 text-zinc-500" />
                            <span>{b.member_phone}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                          {b.booking_reference}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              isConfirmed
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isConfirmed ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"}`} />
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: UPDATE COURT MAINTENANCE */}
      {selectedCourtForMaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Wrench className="w-5 h-5 text-amber-400" />
                Court Maintenance & Condition
              </div>
              <button
                onClick={() => setSelectedCourtForMaint(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
              <p className="font-bold text-white text-sm">{selectedCourtForMaint.name}</p>
              <p className="text-xs text-zinc-400">Current Status: <strong className="text-white">{selectedCourtForMaint.status}</strong></p>
            </div>

            <form onSubmit={handleUpdateMaintenance} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300">Set Operational Status</label>
                <select
                  value={newCourtStatus}
                  onChange={(e) => setNewCourtStatus(e.target.value as any)}
                  className="w-full mt-1.5 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="ACTIVE">✅ Active & Ready for Bookings</option>
                  <option value="MAINTENANCE">⚠️ Under Maintenance / Cleaning / Repairs</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Maintenance Activity / Note</label>
                <textarea
                  rows={3}
                  value={maintenanceNote}
                  onChange={(e) => setMaintenanceNote(e.target.value)}
                  placeholder="e.g. Net height adjusted to BWF standards, floor mopped, lighting bulb replaced"
                  className="w-full mt-1.5 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSelectedCourtForMaint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Maintenance Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
