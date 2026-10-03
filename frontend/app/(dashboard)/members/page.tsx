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
  DollarSign
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getStoredUser, AuthUser } from "@/lib/auth";

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

const INITIAL_MEMBERS: MemberRecord[] = [
  {
    id: 1,
    user_id: 101,
    name: "Pushp Lamba",
    email: "pushplamba104@gmail.com",
    phone: "+91 98765 43210",
    tier: "BLACK_CARD",
    status: "ACTIVE",
    joinedDate: "Jan 15, 2024",
    expiresDate: "Lifetime Sovereign",
    totalSpend: 245000,
    totalBookings: 88,
    avatarBg: "from-amber-400 to-amber-600",
  },
  {
    id: 2,
    user_id: 102,
    name: "Aarav Sharma",
    email: "aarav.sharma@gmail.com",
    phone: "+91 98111 22334",
    tier: "PLATINUM",
    status: "ACTIVE",
    joinedDate: "Mar 10, 2024",
    expiresDate: "Mar 10, 2025",
    totalSpend: 78500,
    totalBookings: 42,
    avatarBg: "from-sky-400 to-blue-600",
  },
  {
    id: 3,
    user_id: 103,
    name: "Rohan Verma",
    email: "rohan.v@gmail.com",
    phone: "+91 98222 33445",
    tier: "GOLD",
    status: "ACTIVE",
    joinedDate: "Feb 01, 2024",
    expiresDate: "Feb 01, 2025",
    totalSpend: 42000,
    totalBookings: 29,
    avatarBg: "from-emerald-400 to-teal-600",
  },
  {
    id: 4,
    user_id: 104,
    name: "Ananya Iyer",
    email: "ananya.iyer@outlook.com",
    phone: "+91 98333 44556",
    tier: "STANDARD",
    status: "ACTIVE",
    joinedDate: "Jul 20, 2024",
    expiresDate: "Jul 20, 2025",
    totalSpend: 15400,
    totalBookings: 14,
    avatarBg: "from-purple-400 to-indigo-600",
  },
  {
    id: 5,
    user_id: 105,
    name: "Vikram Malhotra",
    email: "v.malhotra@corp.com",
    phone: "+91 98444 55667",
    tier: "BLACK_CARD",
    status: "PENDING_VERIFICATION",
    joinedDate: "Oct 01, 2024",
    expiresDate: "Pending Review",
    totalSpend: 120000,
    totalBookings: 5,
    avatarBg: "from-amber-500 to-red-600",
  },
  {
    id: 6,
    user_id: 106,
    name: "Kavita Rao",
    email: "kavita.rao@gmail.com",
    phone: "+91 98555 66778",
    tier: "GOLD",
    status: "ACTIVE",
    joinedDate: "May 12, 2024",
    expiresDate: "May 12, 2025",
    totalSpend: 36800,
    totalBookings: 21,
    avatarBg: "from-pink-400 to-rose-600",
  },
];

const TIER_BADGES = {
  BLACK_CARD: { bg: "bg-slate-900 text-amber-300 border-amber-400/40", icon: "👑", label: "Black Card VIP" },
  PLATINUM: { bg: "bg-slate-100 text-slate-800 border-slate-300", icon: "💎", label: "Platinum Elite" },
  GOLD: { bg: "bg-amber-50 text-amber-800 border-amber-300", icon: "🥇", label: "Gold Club" },
  STANDARD: { bg: "bg-sky-50 text-sky-800 border-sky-200", icon: "🏅", label: "Standard Pass" },
};

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRecord[]>(INITIAL_MEMBERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Club Member Directory & Passes
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage member accounts, digital membership passes, tier benefits, and court privileges.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Member</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Members</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{members.length}</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">+100% active standing</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Black Card VIPs</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {members.filter((m) => m.tier === "BLACK_CARD").length}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Highest lifetime tier</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Lifetime Spend</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            ₹{members.reduce((acc, m) => acc + m.totalSpend, 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Across all amenities</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Court Bookings Logged</p>
          <p className="text-2xl font-black text-sky-600 mt-1">
            {members.reduce((acc, m) => acc + m.totalBookings, 0)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Total slots reserved</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by member name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 font-bold text-slate-700 focus:outline-none"
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
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 font-bold text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
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
                const tierInfo = TIER_BADGES[member.tier];
                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Member Profile */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${member.avatarBg} text-white font-black flex items-center justify-center text-sm shadow-sm shrink-0`}>
                          {member.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">{member.name}</p>
                          <p className="text-slate-400 text-[11px] font-mono">ID: CC-MEM-{member.id.toString().padStart(4, "0")}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tier */}
                    <td className="py-4 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-extrabold border shadow-xs ${tierInfo.bg}`}>
                        <span>{tierInfo.icon}</span>
                        <span>{tierInfo.label}</span>
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      {member.status === "ACTIVE" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ACTIVE
                        </span>
                      )}
                      {member.status === "PENDING_VERIFICATION" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          PENDING REVIEW
                        </span>
                      )}
                    </td>

                    {/* Contact */}
                    <td className="py-4 px-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[160px]">{member.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    </td>

                    {/* Spend */}
                    <td className="py-4 px-4">
                      <p className="font-black text-slate-900 text-sm">
                        ₹{member.totalSpend.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">Lifetime spend</p>
                    </td>

                    {/* Bookings */}
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-sky-50 text-sky-700 font-black text-xs">
                        {member.totalBookings} Slots
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right space-x-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMember(member);
                          setShowPassModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[11px] shadow-sm transition-all"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-300" />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white space-y-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-black text-base">Member Smart RFID & Digital Pass</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Pass Preview */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700 p-6 relative overflow-hidden shadow-2xl space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-400">CHAMPIONS CLUB</p>
                  <p className="text-lg font-black text-white">{selectedMember.name}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${TIER_BADGES[selectedMember.tier].bg}`}>
                  {TIER_BADGES[selectedMember.tier].label}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                <div className="text-center text-slate-900">
                  <div className="w-32 h-32 bg-slate-900 text-white rounded-lg flex flex-col items-center justify-center mx-auto p-2">
                    <QrCode className="w-20 h-20 text-white" />
                    <span className="text-[9px] font-mono mt-1 text-sky-300">CC-PASS-#{selectedMember.id}</span>
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
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition-all shadow-md shadow-sky-600/20"
            >
              Close Pass Preview
            </button>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base">Register New Club Member</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Mehta"
                  id="new-mem-name"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address (Gmail ID)</label>
                <input
                  type="email"
                  placeholder="e.g. rahul@gmail.com"
                  id="new-mem-email"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 00000"
                  id="new-mem-phone"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Membership Plan</label>
                <select
                  id="new-mem-tier"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  <option value="BLACK_CARD">👑 Black Card VIP (₹120,000/yr)</option>
                  <option value="PLATINUM">💎 Platinum Elite (₹60,000/yr)</option>
                  <option value="GOLD">🥇 Gold Club (₹35,000/yr)</option>
                  <option value="STANDARD">🏅 Standard Pass (₹15,000/yr)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const nameInput = document.getElementById("new-mem-name") as HTMLInputElement;
                  const emailInput = document.getElementById("new-mem-email") as HTMLInputElement;
                  const phoneInput = document.getElementById("new-mem-phone") as HTMLInputElement;
                  const tierInput = document.getElementById("new-mem-tier") as HTMLSelectElement;

                  if (nameInput?.value && emailInput?.value) {
                    const newMem: MemberRecord = {
                      id: members.length + 1,
                      user_id: 200 + members.length,
                      name: nameInput.value,
                      email: emailInput.value,
                      phone: phoneInput?.value || "+91 90000 00000",
                      tier: (tierInput?.value as any) || "STANDARD",
                      status: "ACTIVE",
                      joinedDate: "Today",
                      expiresDate: "1 Year",
                      totalSpend: 0,
                      totalBookings: 0,
                      avatarBg: "from-sky-400 to-indigo-600",
                    };
                    setMembers([newMem, ...members]);
                    setShowAddModal(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md shadow-sky-600/20"
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
