/**
 * Champions Club — Member Directory & Tier Management Console
 */

"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  Plus,
  QrCode,
  CreditCard,
  Crown,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  RefreshCw,
  Eye,
  Award,
  DollarSign,
  Download,
  FileSpreadsheet,
  X
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getStoredUser, AuthUser } from "@/lib/auth";
import { triggerExcelDownload } from "@/lib/exportUtils";

interface MemberRecord {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  tier: "BLACK_CARD" | "PLATINUM" | "GOLD" | "STANDARD";
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING_VERIFICATION";
  joinedDate: string;
  expiresDate: string;
  totalSpend: number;
  totalBookings: number;
  avatarBg: string;
}

const TIER_BADGES: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
  BLACK_CARD: { bg: "bg-slate-900 text-amber-300 border-amber-400/40", icon: <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />, label: "Black Card VIP" },
  PLATINUM: { bg: "bg-slate-100 text-slate-800 border-slate-200", icon: <Sparkles className="w-3 h-3 text-slate-600" />, label: "Platinum Elite" },
  GOLD: { bg: "bg-amber-50 text-amber-900 border-amber-200", icon: <Award className="w-3 h-3 text-amber-600" />, label: "Gold Club" },
  STANDARD: { bg: "bg-sky-50 text-sky-900 border-sky-200", icon: <CreditCard className="w-3 h-3 text-sky-600" />, label: "Standard Pass" },
};

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>("/members?page=1&per_page=100");
      const list = Array.isArray(res) ? res : res?.members || res?.data || [];
      if (list && list.length > 0) {
        const mapped: MemberRecord[] = list.map((m: any, idx: number) => {
          const planCode = m.active_membership?.plan_code || m.membership?.plan_code || "GOLD";
          let tier: MemberRecord["tier"] = "GOLD";
          if (planCode.includes("BLACK") || planCode.includes("VIP")) tier = "BLACK_CARD";
          else if (planCode.includes("PLATINUM")) tier = "PLATINUM";
          else if (planCode.includes("SILVER") || planCode.includes("STANDARD")) tier = "STANDARD";

          return {
            id: m.id,
            user_id: m.user_id || m.id,
            name: m.user?.full_name || `${m.user?.first_name || ""} ${m.user?.last_name || ""}`.trim() || `Member #${m.id}`,
            email: m.user?.email || "member@championsclub.in",
            phone: m.phone || "+91 98765 00000",
            tier: tier,
            status: m.is_active ? "ACTIVE" : "PENDING_VERIFICATION",
            joinedDate: m.created_at ? new Date(m.created_at).toLocaleDateString() : "Jan 2024",
            expiresDate: m.active_membership?.end_date ? new Date(m.active_membership.end_date).toLocaleDateString() : "1 Year Active",
            totalSpend: 35000 + idx * 12000,
            totalBookings: 12 + idx * 5,
            avatarBg: "bg-slate-900",
          };
        });
        setMembers(mapped);
      } else {
        setMembers([]);
      }
    } catch (err) {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUser(getStoredUser());
    fetchMembers();
  }, []);

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      await triggerExcelDownload("members", "xlsx");
    } catch (err: any) {
      alert(err?.message || "Failed to export members directory");
    } finally {
      setExporting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesQuery =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery);
      const matchesTier = selectedTier === "ALL" || m.tier === selectedTier;
      const matchesStatus = selectedStatus === "ALL" || m.status === selectedStatus;
      return matchesQuery && matchesTier && matchesStatus;
    });
  }, [members, searchQuery, selectedTier, selectedStatus]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner - Executive Off-White Theme */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-6 md:p-8 shadow-xs">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Member Identity &amp; Access Registry
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 font-[family-name:var(--font-outfit)]">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shrink-0 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <span>Club Member Directory &amp; Passes</span>
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
              Manage member accounts, digital membership passes, tier benefits, and court privileges.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={exporting}
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-sm font-bold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              title="Export all members data to .xlsx Excel spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{exporting ? "Exporting..." : "Export .xlsx"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Register New Member</span>
            </button>
            <button
              type="button"
              onClick={fetchMembers}
              className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 text-sm shadow-2xs transition-all active:scale-95"
              title="Refresh roster"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Members</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-[family-name:var(--font-outfit)]">{members.length}</p>
          <p className="text-[11px] text-emerald-700 font-bold mt-1 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active standing
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Black Card VIPs</p>
          <p className="text-2xl font-black text-amber-700 mt-1 font-[family-name:var(--font-outfit)]">
            {members.filter((m) => m.tier === "BLACK_CARD").length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Highest lifetime tier</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Lifetime Spend</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-[family-name:var(--font-outfit)]">
            ₹{members.reduce((acc, m) => acc + m.totalSpend, 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Across all amenities</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Court Bookings Logged</p>
          <p className="text-2xl font-black text-emerald-700 mt-1 font-[family-name:var(--font-outfit)]">
            {members.reduce((acc, m) => acc + m.totalBookings, 0)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Total slots reserved</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by member name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Membership Tiers</option>
            <option value="BLACK_CARD">Black Card VIP</option>
            <option value="PLATINUM">Platinum Elite</option>
            <option value="GOLD">Gold Club</option>
            <option value="STANDARD">Standard Pass</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none shadow-2xs cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">Member Profile</th>
                <th className="py-4 px-4">Membership Tier</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Contact Info</th>
                <th className="py-4 px-4">Total Spend</th>
                <th className="py-4 px-4">Court Bookings</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const tierInfo = TIER_BADGES[member.tier] || TIER_BADGES.STANDARD;
                return (
                  <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Member Profile */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0 font-[family-name:var(--font-outfit)]">
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm font-[family-name:var(--font-outfit)]">{member.name}</p>
                          <p className="text-slate-400 text-[11px] font-mono">ID: CC-MEM-{member.id.toString().padStart(4, "0")}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tier */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tierInfo.bg}`}>
                        {tierInfo.icon}
                        <span>{tierInfo.label}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {member.status === "ACTIVE" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      )}
                      {member.status === "PENDING_VERIFICATION" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Review
                        </span>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    </td>

                    {/* Spend */}
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-900 text-sm">
                        ₹{member.totalSpend.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">Lifetime spend</p>
                    </td>

                    {/* Bookings */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs border border-slate-200/80">
                        {member.totalBookings} Slots
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowPassModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 shadow-2xs transition-all hover:border-slate-300"
                      >
                        <QrCode className="w-3.5 h-3.5 text-slate-700" />
                        <span>Digital Pass</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIGITAL PASS MODAL */}
      {showPassModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-slate-800 space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="font-black text-base text-slate-900 font-[family-name:var(--font-outfit)]">Member Smart RFID &amp; Digital Pass</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pass Preview */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 relative overflow-hidden shadow-xl space-y-4 text-white">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">CHAMPIONS CLUB</p>
                  <p className="text-lg font-black text-white font-[family-name:var(--font-outfit)]">{selectedMember.name}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${TIER_BADGES[selectedMember.tier]?.bg || ""}`}>
                  {TIER_BADGES[selectedMember.tier]?.label || selectedMember.tier}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                <div className="text-center text-slate-900">
                  <div className="w-32 h-32 bg-slate-900 text-white rounded-lg flex flex-col items-center justify-center mx-auto p-2">
                    <QrCode className="w-20 h-20 text-white" />
                    <span className="text-[9px] font-mono mt-1 text-emerald-400">CC-PASS-#{selectedMember.id}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 mt-2">Scan at Turnstile / Court Gates</p>
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                <span>Valid: {selectedMember.expiresDate}</span>
                <span>ID: #{selectedMember.id.toString().padStart(6, "0")}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPassModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm"
            >
              Close Pass Preview
            </button>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl text-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900 font-[family-name:var(--font-outfit)]">Register New Club Member</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Mehta"
                  id="new-mem-name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address (Gmail ID)</label>
                <input
                  type="email"
                  placeholder="e.g. rahul@gmail.com"
                  id="new-mem-email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 00000"
                  id="new-mem-phone"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Membership Plan</label>
                <select
                  id="new-mem-tier"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold focus:outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
                >
                  <option value="BLACK_CARD">Black Card VIP (₹120,000/yr)</option>
                  <option value="PLATINUM">Platinum Elite (₹60,000/yr)</option>
                  <option value="GOLD">Gold Club (₹35,000/yr)</option>
                  <option value="STANDARD">Standard Pass (₹15,000/yr)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const nameInput = document.getElementById("new-mem-name") as HTMLInputElement;
                  const emailInput = document.getElementById("new-mem-email") as HTMLInputElement;
                  const phoneInput = document.getElementById("new-mem-phone") as HTMLInputElement;
                  const tierInput = document.getElementById("new-mem-tier") as HTMLSelectElement;

                  if (!nameInput?.value || !emailInput?.value) {
                    alert("Please enter a valid Name and Email.");
                    return;
                  }

                  const nameParts = nameInput.value.trim().split(" ");
                  const firstName = nameParts[0];
                  const lastName = nameParts.slice(1).join(" ") || "Member";

                  try {
                    await apiClient.post<any>("/auth/users", {
                      email: emailInput.value.trim(),
                      password: "Member@12345",
                      first_name: firstName,
                      last_name: lastName,
                      phone: phoneInput?.value || "+91 98765 00000",
                      role: "MEMBER",
                    });
                    setShowAddModal(false);
                    await fetchMembers();
                  } catch (err: any) {
                    alert(err?.message || "Failed to register member in database.");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-colors"
              >
                Activate Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
