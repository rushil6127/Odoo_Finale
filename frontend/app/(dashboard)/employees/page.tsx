"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Key,
  Crown,
  Lock,
  ChevronRight,
  Sparkles,
  Loader2,
  RefreshCw,
  Edit2,
  Check,
  X,
  Info,
  UserPlus
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface UserItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoleDetail {
  title: string;
  description: string;
  permissions: string[];
}

const ROLE_BADGE_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  OWNER: {
    bg: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    text: "text-amber-500",
    border: "border-amber-500/30",
    icon: "👑",
  },
  ADMIN: {
    bg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    text: "text-purple-400",
    border: "border-purple-500/30",
    icon: "🛡️",
  },
  MANAGER: {
    bg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    text: "text-blue-400",
    border: "border-blue-500/30",
    icon: "👔",
  },
  TRAINER: {
    bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: "🎾",
  },
  STAFF: {
    bg: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    text: "text-teal-400",
    border: "border-teal-500/30",
    icon: "🧑‍💼",
  },
  MEMBER: {
    bg: "bg-green-500/10 text-green-400 border-green-500/30",
    text: "text-green-400",
    border: "border-green-500/30",
    icon: "🏅",
  },
  GUEST: {
    bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
    icon: "👤",
  },
};

export default function EmployeesPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "matrix" | "governance">("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [rolesMap, setRolesMap] = useState<Record<string, RoleDetail>>({});
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Role Edit Modal
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserItem | null>(null);
  const [newRoleSelection, setNewRoleSelection] = useState<string>("");

  // New User / Staff Modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "STAFF",
  });

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter !== "ALL") params.append("is_active", statusFilter === "ACTIVE" ? "true" : "false");
      params.append("per_page", "100");

      const res = await apiClient.get<any>(`/auth/users?${params.toString()}`);
      if (res && res.data && res.data.users) {
        setUsers(res.data.users);
        setTotalUsers(res.meta?.total || res.data.users.length);
      }
    } catch (err: any) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiClient.get<any>("/auth/roles");
      if (res && res.data && res.data.roles) {
        const map: Record<string, RoleDetail> = {};
        if (Array.isArray(res.data.roles)) {
          res.data.roles.forEach((r: any) => {
            map[r.role] = { title: r.title, description: r.description, permissions: r.permissions };
          });
        } else {
          Object.assign(map, res.data.roles);
        }
        setRolesMap(map);
      }
    } catch (err: any) {
      console.error("Failed to load roles metadata:", err);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [fetchRoles, fetchUsers]);

  const handleUpdateRole = async () => {
    if (!selectedUserForRole || !newRoleSelection) return;
    try {
      setActionLoading(true);
      const res = await apiClient.patch<any>(`/auth/users/${selectedUserForRole.id}/role`, {
        role: newRoleSelection,
      });
      if (res && (res.status === "success" || res.data)) {
        showToast("success", `Updated ${selectedUserForRole.first_name}'s role to ${newRoleSelection}.`);
        setSelectedUserForRole(null);
        fetchUsers();
      } else {
        showToast("error", res.message || "Failed to update user role.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to update user role.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (user: UserItem) => {
    const nextStatus = !user.is_active;
    const actionLabel = nextStatus ? "enable" : "disable";
    if (!confirm(`Are you sure you want to ${actionLabel} access for ${user.first_name} ${user.last_name}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.patch<any>(`/auth/users/${user.id}/status`, {
        is_active: nextStatus,
      });
      if (res && (res.status === "success" || res.data)) {
        showToast("success", `User account ${nextStatus ? "enabled" : "disabled"} successfully.`);
        fetchUsers();
      } else {
        showToast("error", res.message || "Failed to update account status.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to update account status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.email || !newUserForm.password || !newUserForm.first_name) {
      showToast("error", "Please fill in all required fields.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await apiClient.post<any>("/auth/users", newUserForm);
      if (res && (res.status === "success" || res.data)) {
        showToast("success", `Account created for ${newUserForm.first_name} (${newUserForm.role}).`);
        setShowAddUserModal(false);
        setNewUserForm({
          first_name: "",
          last_name: "",
          email: "",
          password: "",
          role: "STAFF",
        });
        fetchUsers();
      } else {
        showToast("error", res.message || "Failed to create user.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Failed to create user.");
    } finally {
      setActionLoading(false);
    }
  };

  const isOwner = currentUser?.role === "OWNER" || currentUser?.email === "pushplamba104@gmail.com";
  const isAdmin = isOwner || currentUser?.role === "ADMIN";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
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
              Access Control & Role Governance
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Roles & Staff Management
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Assign roles, configure granular permissions, and manage staff operations with strict server-side authorization enforcement.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowAddUserModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all shadow-lg shadow-emerald-950/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                Add Staff / User
              </button>
            )}
            <button
              onClick={() => fetchUsers()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/60 text-sm transition-all"
              title="Refresh users"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Super Owner Notice */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-zinc-300">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold text-amber-400">Designated Super Owner:</span>
            <span className="font-mono bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/50 text-amber-200">
              pushplamba104@gmail.com
            </span>
            <span className="hidden sm:inline text-zinc-400">• Full administrative sovereignty across all roles</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400 font-medium">
            <span>Total Accounts: <strong className="text-white">{totalUsers}</strong></span>
            <span>Active Roles: <strong className="text-emerald-400">7 Tiers</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("users")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "users"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <Users className="w-4 h-4" />
          Users & Role Delegation
          <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-300 ml-1">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "matrix"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <Key className="w-4 h-4" />
          Role & Permissions Matrix
        </button>

        <button
          onClick={() => setActiveTab("governance")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === "governance"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <Crown className="w-4 h-4" />
          Security Governance & Hierarchy
        </button>
      </div>

      {/* TAB 1: USERS & ROLE DELEGATION */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-950/80 border border-zinc-700/60 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-zinc-950/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="TRAINER">Trainer</option>
                  <option value="STAFF">Staff</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-zinc-950/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="DISABLED">Disabled Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-sm">Loading system accounts & roles...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 space-y-2">
                <Users className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="font-semibold text-zinc-300">No users found</p>
                <p className="text-xs text-zinc-500">Try adjusting your search query or filter settings.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Current Role</th>
                      <th className="py-3.5 px-4">Account Status</th>
                      <th className="py-3.5 px-4">Joined</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {users.map((user) => {
                      const roleConfig = ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.MEMBER;
                      const isTargetSuperOwner = user.email.toLowerCase() === "pushplamba104@gmail.com";
                      return (
                        <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-800 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow">
                                {user.first_name?.[0] || user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium text-white flex items-center gap-1.5">
                                  {user.first_name} {user.last_name}
                                  {isTargetSuperOwner && (
                                    <span className="text-xs" title="Super Owner">👑</span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-400 font-mono">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleConfig.bg}`}
                            >
                              <span>{roleConfig.icon}</span>
                              <span>{user.role}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {user.is_active ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                Disabled
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-zinc-400">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setSelectedUserForRole(user);
                                    setNewRoleSelection(user.role);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-all hover:border-emerald-500/50"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                                  Change Role
                                </button>
                              )}

                              {isAdmin && !isTargetSuperOwner && (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={actionLoading}
                                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                    user.is_active
                                      ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
                                      : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  }`}
                                  title={user.is_active ? "Disable account" : "Enable account"}
                                >
                                  {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
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
      )}

      {/* TAB 2: ROLE & PERMISSIONS MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(rolesMap).map(([roleKey, details]) => {
              const style = ROLE_BADGE_STYLES[roleKey] || ROLE_BADGE_STYLES.MEMBER;
              return (
                <div
                  key={roleKey}
                  className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex flex-col justify-between hover:border-zinc-700 transition-all shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${style.bg}`}>
                        <span>{style.icon}</span>
                        <span>{roleKey}</span>
                      </span>
                      <span className="text-xs text-zinc-500 font-mono">Tier: {roleKey}</span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-1">{details.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-4">{details.description}</p>

                    <div className="space-y-2 border-t border-zinc-800/80 pt-3">
                      <p className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Granted Capabilities</p>
                      <ul className="space-y-1.5">
                        {details.permissions.map((perm, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-zinc-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{perm}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matrix Overview Table */}
          <div className="p-6 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Module Access Matrix
            </h3>
            <p className="text-xs text-zinc-400 mb-5">
              Summary of functional modules accessible per role under strict server-side decorators (`@roles_required`).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 font-semibold uppercase">
                    <th className="py-3 px-4">Club Module</th>
                    <th className="py-3 px-3 text-center">Owner</th>
                    <th className="py-3 px-3 text-center">Admin</th>
                    <th className="py-3 px-3 text-center">Manager</th>
                    <th className="py-3 px-3 text-center">Trainer</th>
                    <th className="py-3 px-3 text-center">Staff</th>
                    <th className="py-3 px-3 text-center">Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  <tr className="hover:bg-zinc-800/30">
                    <td className="py-3 px-4 font-medium text-white">Role Delegation & User Creation</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Full</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Staff/Admin</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/30">
                    <td className="py-3 px-4 font-medium text-white">Membership Request Review & Approval</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Approve/Reject</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Approve/Reject</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Approve/Reject</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">— (Self Submit)</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/30">
                    <td className="py-3 px-4 font-medium text-white">Court Match Bookings</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Full</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Override</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Manage</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Drill Sched</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Check-in</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Member Limit</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/30">
                    <td className="py-3 px-4 font-medium text-white">POS / Pro Shop / Bar Tab Operations</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Full</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Pricing & Setup</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Inventory Sync</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Checkout Terminal</td>
                    <td className="py-3 px-3 text-center text-zinc-400">Personal Purchases</td>
                  </tr>
                  <tr className="hover:bg-zinc-800/30">
                    <td className="py-3 px-4 font-medium text-white">Financial Audit & Payment Settings</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Master Control</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Audit Reports</td>
                    <td className="py-3 px-3 text-center text-emerald-400 font-bold">✓ Daily Shifts</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                    <td className="py-3 px-3 text-center text-zinc-600">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY GOVERNANCE & HIERARCHY */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Super Owner Privileges & Hierarchy Policy</h3>
                <p className="text-xs text-zinc-400">Security principles governing role delegation across Champions Club.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  Designated Super Owner (`pushplamba104@gmail.com`)
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Has perpetual <strong className="text-zinc-200">OWNER</strong> role. Any sign-in or token refresh guarantees owner privileges and cannot be demoted or locked out by standard administrators.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-400">
                  <Lock className="w-4 h-4" />
                  Hierarchical Assignment Safeguards
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Only an existing <strong className="text-zinc-200">OWNER</strong> can appoint or remove another Owner. Admins may delegate roles up to ADMIN, but cannot promote accounts to OWNER.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <Key className="w-4 h-4" />
                  Server-Side Enforcement
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  All critical endpoints are protected using Flask JWT claims & database validations. Client-side hiding alone is never trusted for security.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  Membership Approval Decoupling
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Submitting a UTR payment screenshot creates a <strong className="text-amber-400">PENDING</strong> request. Only manual review by an Admin/Manager/Owner transitions it to <strong className="text-emerald-400">APPROVED</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN / CHANGE USER ROLE */}
      {selectedUserForRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Shield className="w-5 h-5 text-emerald-400" />
                Assign Role to User
              </div>
              <button
                onClick={() => setSelectedUserForRole(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                {selectedUserForRole.first_name?.[0] || selectedUserForRole.email[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">
                  {selectedUserForRole.first_name} {selectedUserForRole.last_name}
                </p>
                <p className="text-xs text-zinc-400 font-mono">{selectedUserForRole.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Select System Role
              </label>
              <select
                value={newRoleSelection}
                onChange={(e) => setNewRoleSelection(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {isOwner && <option value="OWNER">👑 OWNER (Master Sovereignty)</option>}
                <option value="ADMIN">🛡️ ADMIN (Club Operations & Roles)</option>
                <option value="MANAGER">👔 MANAGER (Staff & Reviews)</option>
                <option value="TRAINER">🎾 TRAINER (Coaching & Drills)</option>
                <option value="STAFF">🧑‍💼 STAFF (POS & Check-ins)</option>
                <option value="MEMBER">🏅 MEMBER (Club Member)</option>
                <option value="GUEST">👤 GUEST (Public Visitor)</option>
              </select>
            </div>

            {rolesMap[newRoleSelection] && (
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs space-y-1.5">
                <span className="font-semibold text-zinc-200">
                  {rolesMap[newRoleSelection].title}
                </span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {rolesMap[newRoleSelection].description}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForRole(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-750 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRole}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Confirm Role Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF / USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Provision Staff or User Account
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">First Name</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.first_name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newUserForm.last_name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="staff@championsclub.in"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Initial Password</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Role</label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="STAFF">🧑‍💼 Staff (POS & Front Desk)</option>
                  <option value="TRAINER">🎾 Trainer (Court Coach)</option>
                  <option value="MANAGER">👔 Manager (Club Operations)</option>
                  <option value="ADMIN">🛡️ Administrator</option>
                  <option value="MEMBER">🏅 Member</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
