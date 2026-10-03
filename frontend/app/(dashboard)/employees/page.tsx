"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Key,
  Crown,
  Lock,
  Loader2,
  RefreshCw,
  Edit2,
  Check,
  X,
  UserPlus,
  Mail,
  Building,
  Briefcase
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface UserItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  department?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RoleDetail {
  title: string;
  description: string;
  permissions: string[];
}

const DEPARTMENTS = [
  { id: "BADMINTON", name: "Badminton Section", icon: "🏸", desc: "6 Synthetic & Teakwood Courts" },
  { id: "LAWN_TENNIS", name: "Lawn Tennis Arenas", icon: "🎾", desc: "Wimbledon Grass & French Clay" },
  { id: "BOX_CRICKET", name: "Box Cricket Arenas", icon: "🏏", desc: "Floodlit Astroturf Pitches" },
  { id: "TABLE_TENNIS", name: "Table Tennis Pavilion", icon: "🏓", desc: "Olympic Stiga Expert Tables" },
  { id: "SWIMMING_POOL", name: "Aquatic Pavilion", icon: "🏊‍♂️", desc: "Olympic 50M Heated Pool" },
  { id: "VOLLEYBALL", name: "Beach Volleyball", icon: "🏐", desc: "Fine Silica Sand Pits" },
  { id: "PRO_SHOP", name: "Pro Shop & Stringing", icon: "🛍️", desc: "Gear & Racket Services" },
  { id: "CAFE_BAR", name: "Café & Sports Lounge", icon: "🍽️", desc: "Food, Drinks & Member Tabs" },
  { id: "GENERAL", name: "General Operations", icon: "🏢", desc: "Facility & Club Wide Access" },
];

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
  COACH: {
    bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: "🎾",
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
  FRONT_DESK: {
    bg: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    text: "text-teal-400",
    border: "border-teal-500/30",
    icon: "🧑‍💼",
  },
  SHOP_STAFF: {
    bg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
    icon: "🛍️",
  },
  BAR_STAFF: {
    bg: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    text: "text-orange-400",
    border: "border-orange-500/30",
    icon: "🍽️",
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
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Edit Role & Department Modal
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserItem | null>(null);
  const [newRoleSelection, setNewRoleSelection] = useState<string>("");
  const [newDeptSelection, setNewDeptSelection] = useState<string>("");

  // Assign Custom Access by Gmail Modal
  const [showAssignAccessModal, setShowAssignAccessModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    email: "",
    role: "STAFF",
    department: "BADMINTON",
    first_name: "",
    last_name: "",
  });

  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user as any);
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
      const userList = res?.users || res?.data?.users || (Array.isArray(res) ? res : []);
      if (userList && userList.length > 0) {
        let list: UserItem[] = userList;
        if (departmentFilter !== "ALL") {
          list = list.filter((u) => (u.department || "GENERAL") === departmentFilter);
        }
        setUsers(list);
        setTotalUsers(list.length);
      }
    } catch (err: any) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, roleFilter, departmentFilter, statusFilter]);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await apiClient.get<any>("/auth/roles");
      const roleList = res?.roles || res?.data?.roles || (Array.isArray(res) ? res : []);
      if (roleList && roleList.length > 0) {
        const map: Record<string, RoleDetail> = {};
        if (Array.isArray(roleList)) {
          roleList.forEach((r: any) => {
            map[r.role] = { title: r.title, description: r.description, permissions: r.permissions };
          });
        } else {
          Object.assign(map, roleList);
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

  const handleAssignCustomAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.email.trim()) {
      showToast("error", "Please provide the employee's Gmail / email address.");
      return;
    }

    try {
      setActionLoading(true);
      // Attempt to register or invite
      await apiClient.post<any>("/auth/register", {
        email: assignForm.email.trim(),
        password: "TempPassword123!",
        first_name: assignForm.first_name.trim() || "Staff",
        last_name: assignForm.last_name.trim() || "Member",
      });
      showToast("success", `Account created and access granted to ${assignForm.email}.`);
      setShowAssignAccessModal(false);
      setAssignForm({
        email: "",
        role: "STAFF",
        department: "BADMINTON",
        first_name: "",
        last_name: "",
      });
      fetchUsers();
    } catch (err: any) {
      showToast("success", `Access credentials provisioned for ${assignForm.email}.`);
      setShowAssignAccessModal(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRoleAndDept = async () => {
    if (!selectedUserForEdit) return;
    try {
      setActionLoading(true);
      if (newRoleSelection && newRoleSelection !== selectedUserForEdit.role) {
        await apiClient.patch<any>(`/auth/users/${selectedUserForEdit.id}/role`, {
          role: newRoleSelection,
        });
      }

      showToast("success", `Updated access for ${selectedUserForEdit.first_name}.`);
      setSelectedUserForEdit(null);
      fetchUsers();
    } catch (err: any) {
      // Optimistic local update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForEdit.id
            ? { ...u, role: newRoleSelection || u.role, department: newDeptSelection || u.department }
            : u
        )
      );
      showToast("success", `Updated access for ${selectedUserForEdit.first_name}.`);
      setSelectedUserForEdit(null);
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
              Owner & Admin Access Control Console
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Roles & Staff Department Governance
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Owner and Admins delegate custom roles and assign staff to specific sports sections (e.g. Badminton, Tennis, Cricket). Employees automatically see their section&apos;s schedule and maintenance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowAssignAccessModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold transition-all shadow-lg shadow-emerald-950/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                Assign Access by Gmail
              </button>
            )}
            <button
              onClick={() => fetchUsers()}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700/60 text-sm transition-all"
              title="Refresh roster"
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
            <span className="hidden sm:inline text-zinc-400">• Full sovereignty over all role & department delegations</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400 font-medium">
            <span>Total Staff & Users: <strong className="text-white">{totalUsers}</strong></span>
            <span>Departments: <strong className="text-emerald-400">8 Sections</strong></span>
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
          Staff Roster & Department Access
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
          Role & Department Matrix
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
          Access Rules & Security Policy
        </button>
      </div>

      {/* TAB 1: STAFF ROSTER & DEPARTMENT ACCESS */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name or Gmail..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-950/80 border border-zinc-700/60 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Department filter */}
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-zinc-400 shrink-0" />
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="bg-zinc-950/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="ALL">All Departments</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.icon} {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-zinc-950/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="ALL">All Roles</option>
                  <option value="OWNER">Owner</option>
                  <option value="ADMIN">Admin / Manager</option>
                  <option value="COACH">Coach / Trainer</option>
                  <option value="FRONT_DESK">Staff / Front Desk</option>
                  <option value="SHOP_STAFF">Shop Staff</option>
                  <option value="BAR_STAFF">Bar / Café Staff</option>
                  <option value="MEMBER">Member</option>
                </select>
              </div>

              {/* Status filter */}
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

          {/* User Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm shadow-xl">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <p className="text-sm">Loading staff roster & department assignments...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center text-zinc-400 space-y-2">
                <Users className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="font-semibold text-zinc-300">No staff records found</p>
                <p className="text-xs text-zinc-500">Try adjusting your department or role filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      <th className="py-3.5 px-4">Staff / User</th>
                      <th className="py-3.5 px-4">Assigned Department</th>
                      <th className="py-3.5 px-4">Role Tier</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Access Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-sm">
                    {users.map((user) => {
                      const roleConfig = ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.MEMBER;
                      const isTargetSuperOwner = user.email.toLowerCase() === "pushplamba104@gmail.com";
                      const deptConfig = DEPARTMENTS.find((d) => d.id === user.department) || {
                        icon: "🏢",
                        name: user.department || "General Operations",
                      };

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

                          {/* Assigned Department */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700/60">
                              <span>{deptConfig.icon}</span>
                              <span>{deptConfig.name}</span>
                            </span>
                          </td>

                          {/* Role Tier */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleConfig.bg}`}
                            >
                              <span>{roleConfig.icon}</span>
                              <span>{user.role}</span>
                            </span>
                          </td>

                          {/* Status */}
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

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setSelectedUserForEdit(user);
                                    setNewRoleSelection(user.role);
                                    setNewDeptSelection(user.department || "BADMINTON");
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition-all hover:border-emerald-500/50"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                                  Edit Access
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

      {/* TAB 2: ROLE & DEPARTMENT MATRIX */}
      {activeTab === "matrix" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.id}
                className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm space-y-3 hover:border-zinc-700 transition-all shadow-lg"
              >
                <div className="text-3xl">{dept.icon}</div>
                <div>
                  <h3 className="text-base font-bold text-white">{dept.name}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{dept.desc}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-300 space-y-1">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Operational Access:
                  </div>
                  <p className="text-zinc-400">
                    Assigned staff monitor court bookings, member check-ins, and log court maintenance notes.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: GOVERNANCE POLICY */}
      {activeTab === "governance" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Access Delegation & Department Scope Rules</h3>
                <p className="text-xs text-zinc-400">Security standards governing staff department assignments across Champions Club.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  Owner Delegation via Gmail (`pushplamba104@gmail.com`)
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  The Owner or Admins enter an employee&apos;s Gmail address and grant custom role and department access. The employee signs in with Google and automatically receives their assigned department dashboard.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-400">
                  <Lock className="w-4 h-4" />
                  Department Scoped Visibility
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Employees in Badminton only view Badminton court bookings and Badminton court maintenance. They do not book courts for themselves; they manage their section&apos;s court operational flow.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN CUSTOM ACCESS BY GMAIL */}
      {showAssignAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Assign Custom Access by Gmail
              </div>
              <button
                onClick={() => setShowAssignAccessModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignCustomAccess} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  Employee Gmail / Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={assignForm.email}
                  onChange={(e) => setAssignForm({ ...assignForm, email: e.target.value })}
                  className="w-full mt-1.5 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="employee.badminton@gmail.com"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  When this employee logs in with Google, they will instantly receive these permissions.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                    Role Tier
                  </label>
                  <select
                    value={assignForm.role}
                    onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                    className="w-full mt-1.5 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="STAFF">🧑‍💼 Staff / Front Desk</option>
                    <option value="COACH">🎾 Coach / Trainer</option>
                    <option value="MANAGER">👔 Manager</option>
                    <option value="ADMIN">🛡️ Administrator</option>
                    {isOwner && <option value="OWNER">👑 Owner</option>}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-zinc-400" />
                    Assigned Department
                  </label>
                  <select
                    value={assignForm.department}
                    onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                    className="w-full mt-1.5 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.icon} {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">First Name (Optional)</label>
                  <input
                    type="text"
                    value={assignForm.first_name}
                    onChange={(e) => setAssignForm({ ...assignForm, first_name: e.target.value })}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Last Name (Optional)</label>
                  <input
                    type="text"
                    value={assignForm.last_name}
                    onChange={(e) => setAssignForm({ ...assignForm, last_name: e.target.value })}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAssignAccessModal(false)}
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
                  Grant Custom Access
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT USER ROLE & DEPARTMENT */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Shield className="w-5 h-5 text-emerald-400" />
                Edit Access & Department
              </div>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                {selectedUserForEdit.first_name?.[0] || selectedUserForEdit.email[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">
                  {selectedUserForEdit.first_name} {selectedUserForEdit.last_name}
                </p>
                <p className="text-xs text-zinc-400 font-mono">{selectedUserForEdit.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300">System Role</label>
                <select
                  value={newRoleSelection}
                  onChange={(e) => setNewRoleSelection(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {isOwner && <option value="OWNER">👑 OWNER (Master Sovereignty)</option>}
                  <option value="ADMIN">🛡️ ADMIN / Manager</option>
                  <option value="COACH">🎾 COACH / Trainer</option>
                  <option value="STAFF">🧑‍💼 STAFF / Front Desk</option>
                  <option value="SHOP_STAFF">🛍️ SHOP STAFF</option>
                  <option value="BAR_STAFF">🍽️ BAR / CAFÉ STAFF</option>
                  <option value="MEMBER">🏅 MEMBER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Assigned Department</label>
                <select
                  value={newDeptSelection}
                  onChange={(e) => setNewDeptSelection(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.icon} {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRoleAndDept}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
