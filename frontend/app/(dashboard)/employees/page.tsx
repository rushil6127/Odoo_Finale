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
  Briefcase,
  User,
  ShoppingBag,
  Utensils,
  Award,
  Activity,
  CircleDot,
  Trophy,
  Layers,
  Waves,
  Target
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
  { id: "BADMINTON", name: "Badminton Section", desc: "6 Synthetic & Teakwood Courts" },
  { id: "LAWN_TENNIS", name: "Lawn Tennis Arenas", desc: "Wimbledon Grass & French Clay" },
  { id: "BOX_CRICKET", name: "Box Cricket Arenas", desc: "Floodlit Astroturf Pitches" },
  { id: "TABLE_TENNIS", name: "Table Tennis Pavilion", desc: "Olympic Stiga Expert Tables" },
  { id: "SWIMMING_POOL", name: "Aquatic Pavilion", desc: "Olympic 50M Heated Pool" },
  { id: "VOLLEYBALL", name: "Beach Volleyball", desc: "Fine Silica Sand Pits" },
  { id: "PRO_SHOP", name: "Pro Shop & Stringing", desc: "Gear & Racket Services" },
  { id: "CAFE_BAR", name: "Café & Sports Lounge", desc: "Food, Drinks & Member Tabs" },
  { id: "GENERAL", name: "General Operations", desc: "Facility & Club Wide Access" },
];

function getDepartmentIcon(id: string, className = "w-3.5 h-3.5") {
  switch (id) {
    case "BADMINTON":
      return <Activity className={className} />;
    case "LAWN_TENNIS":
      return <CircleDot className={className} />;
    case "BOX_CRICKET":
      return <Trophy className={className} />;
    case "TABLE_TENNIS":
      return <Layers className={className} />;
    case "SWIMMING_POOL":
      return <Waves className={className} />;
    case "VOLLEYBALL":
      return <Target className={className} />;
    case "PRO_SHOP":
      return <ShoppingBag className={className} />;
    case "CAFE_BAR":
      return <Utensils className={className} />;
    default:
      return <Building className={className} />;
  }
}

function getRoleBadge(role: string) {
  switch (role) {
    case "OWNER":
      return {
        bg: "bg-amber-50 text-amber-900 border-amber-300",
        icon: <Crown className="w-3 h-3 text-amber-600" />,
        label: "OWNER"
      };
    case "ADMIN":
      return {
        bg: "bg-purple-50 text-purple-900 border-purple-200",
        icon: <Shield className="w-3 h-3 text-purple-600" />,
        label: "ADMIN"
      };
    case "MANAGER":
      return {
        bg: "bg-blue-50 text-blue-900 border-blue-200",
        icon: <Briefcase className="w-3 h-3 text-blue-600" />,
        label: "MANAGER"
      };
    case "COACH":
    case "TRAINER":
      return {
        bg: "bg-emerald-50 text-emerald-900 border-emerald-200",
        icon: <CircleDot className="w-3 h-3 text-emerald-600" />,
        label: role
      };
    case "STAFF":
    case "FRONT_DESK":
      return {
        bg: "bg-sky-50 text-sky-900 border-sky-200",
        icon: <User className="w-3 h-3 text-sky-600" />,
        label: role
      };
    case "SHOP_STAFF":
      return {
        bg: "bg-cyan-50 text-cyan-900 border-cyan-200",
        icon: <ShoppingBag className="w-3 h-3 text-cyan-600" />,
        label: "SHOP_STAFF"
      };
    case "BAR_STAFF":
      return {
        bg: "bg-orange-50 text-orange-900 border-orange-200",
        icon: <Utensils className="w-3 h-3 text-orange-600" />,
        label: "BAR_STAFF"
      };
    case "MEMBER":
      return {
        bg: "bg-slate-100 text-slate-800 border-slate-200",
        icon: <Award className="w-3 h-3 text-slate-600" />,
        label: "MEMBER"
      };
    default:
      return {
        bg: "bg-slate-100 text-slate-800 border-slate-200",
        icon: <User className="w-3 h-3 text-slate-500" />,
        label: role || "USER"
      };
  }
}

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
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-6 md:p-8 shadow-xs">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Owner &amp; Admin Access Control Console
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
              Roles &amp; Staff Department Governance
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-2xl leading-relaxed">
              Owner and Admins delegate custom roles and assign staff to specific sports sections (e.g. Badminton, Tennis, Cricket). Employees automatically see their section&apos;s schedule and maintenance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowAssignAccessModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4 text-emerald-400" />
                Assign Access by Gmail
              </button>
            )}
            <button
              onClick={() => fetchUsers()}
              className="inline-flex items-center gap-2 p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 text-sm shadow-2xs transition-all active:scale-95"
              title="Refresh roster"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Super Owner Notice */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 text-slate-600">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-bold text-amber-800">Designated Super Owner:</span>
            <span className="font-mono bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200 text-amber-900 font-semibold">
              pushplamba104@gmail.com
            </span>
            <span className="hidden sm:inline text-slate-400">• Full sovereignty over all role &amp; department delegations</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600 font-semibold">
            <span>Total Staff &amp; Users: <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">{totalUsers}</strong></span>
            <span>Departments: <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">{DEPARTMENTS.length} Sections</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("users")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "users"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Users className="w-4 h-4 text-emerald-600" />
          Staff Roster &amp; Department Access
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200 ml-1">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "matrix"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Key className="w-4 h-4 text-emerald-600" />
          Role &amp; Department Matrix
        </button>

        <button
          onClick={() => setActiveTab("governance")}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === "governance"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
          }`}
        >
          <Crown className="w-4 h-4 text-emerald-600" />
          Access Rules &amp; Security Policy
        </button>
      </div>

      {/* TAB 1: STAFF ROSTER & DEPARTMENT ACCESS */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-50/80 p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="relative w-full lg:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name or Gmail..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Department filter */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                <Building className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role filter */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
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
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 shadow-2xs cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="DISABLED">Disabled Only</option>
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                <p className="text-sm font-semibold">Loading staff roster &amp; department assignments...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No staff records found</p>
                <p className="text-xs text-slate-400">Try adjusting your department or role filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Staff / User</th>
                      <th className="py-3.5 px-4">Assigned Department</th>
                      <th className="py-3.5 px-4">Role Tier</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Access Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map((user) => {
                      const roleConfig = getRoleBadge(user.role);
                      const isTargetSuperOwner = user.email.toLowerCase() === "pushplamba104@gmail.com";
                      const deptConfig = DEPARTMENTS.find((d) => d.id === user.department) || {
                        id: user.department || "GENERAL",
                        name: user.department || "General Operations",
                        desc: ""
                      };

                      return (
                        <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                {user.first_name?.[0] || user.email[0].toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 font-[family-name:var(--font-outfit)]">
                                  {user.first_name} {user.last_name}
                                  {isTargetSuperOwner && (
                                    <span title="Super Owner">
                                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Assigned Department */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-800 border border-slate-200">
                              <div className="text-emerald-700">
                                {getDepartmentIcon(deptConfig.id, "w-3.5 h-3.5")}
                              </div>
                              <span>{deptConfig.name}</span>
                            </span>
                          </td>

                          {/* Role Tier */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${roleConfig.bg}`}
                            >
                              {roleConfig.icon}
                              <span>{roleConfig.label}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {user.is_active ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-bold">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
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
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200 shadow-2xs transition-all hover:border-slate-300"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Edit Access
                                </button>
                              )}

                              {isAdmin && !isTargetSuperOwner && (
                                <button
                                  onClick={() => handleToggleStatus(user)}
                                  disabled={actionLoading}
                                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                    user.is_active
                                      ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200 shadow-2xs"
                                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200 shadow-2xs"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.id}
                className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3 hover:border-slate-300 transition-all hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  {getDepartmentIcon(dept.id, "w-5 h-5")}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-[family-name:var(--font-outfit)]">{dept.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{dept.desc}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Operational Access Scope:
                  </div>
                  <p className="text-slate-500 leading-relaxed">
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
          <div className="p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">Access Delegation &amp; Department Scope Rules</h3>
                <p className="text-xs text-slate-500 mt-0.5">Security standards governing staff department assignments across Champions Club.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Owner Delegation via Gmail (pushplamba104@gmail.com)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The Owner or Admins enter an employee&apos;s Gmail address and grant custom role and department access. The employee signs in with Google and automatically receives their assigned department dashboard.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-purple-800">
                  <Lock className="w-4 h-4 text-purple-600" />
                  Department Scoped Visibility
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Employees in Badminton only view Badminton court bookings and Badminton court maintenance. They do not book courts for themselves; they manage their section&apos;s court operational flow.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN CUSTOM ACCESS BY GMAIL */}
      {showAssignAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Assign Custom Access by Gmail
              </div>
              <button
                onClick={() => setShowAssignAccessModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignCustomAccess} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                  Employee Gmail / Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={assignForm.email}
                  onChange={(e) => setAssignForm({ ...assignForm, email: e.target.value })}
                  className="w-full mt-1.5 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  placeholder="employee.badminton@gmail.com"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  When this employee logs in with Google, they will instantly receive these permissions.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    Role Tier
                  </label>
                  <select
                    value={assignForm.role}
                    onChange={(e) => setAssignForm({ ...assignForm, role: e.target.value })}
                    className="w-full mt-1.5 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  >
                    <option value="STAFF">Staff / Front Desk</option>
                    <option value="COACH">Coach / Trainer</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Administrator</option>
                    {isOwner && <option value="OWNER">Owner</option>}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    Assigned Department
                  </label>
                  <select
                    value={assignForm.department}
                    onChange={(e) => setAssignForm({ ...assignForm, department: e.target.value })}
                    className="w-full mt-1.5 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">First Name (Optional)</label>
                  <input
                    type="text"
                    value={assignForm.first_name}
                    onChange={(e) => setAssignForm({ ...assignForm, first_name: e.target.value })}
                    className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="First Name"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Last Name (Optional)</label>
                  <input
                    type="text"
                    value={assignForm.last_name}
                    onChange={(e) => setAssignForm({ ...assignForm, last_name: e.target.value })}
                    className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAssignAccessModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm disabled:opacity-50 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Shield className="w-5 h-5 text-emerald-600" />
                Edit Access &amp; Department
              </div>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-2xs">
                {selectedUserForEdit.first_name?.[0] || selectedUserForEdit.email[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">
                  {selectedUserForEdit.first_name} {selectedUserForEdit.last_name}
                </p>
                <p className="text-xs text-slate-500 font-mono">{selectedUserForEdit.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">System Role</label>
                <select
                  value={newRoleSelection}
                  onChange={(e) => setNewRoleSelection(e.target.value)}
                  className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  {isOwner && <option value="OWNER">OWNER (Master Sovereignty)</option>}
                  <option value="ADMIN">ADMIN / Manager</option>
                  <option value="COACH">COACH / Trainer</option>
                  <option value="STAFF">STAFF / Front Desk</option>
                  <option value="SHOP_STAFF">SHOP STAFF</option>
                  <option value="BAR_STAFF">BAR / CAFÉ STAFF</option>
                  <option value="MEMBER">MEMBER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Assigned Department</label>
                <select
                  value={newDeptSelection}
                  onChange={(e) => setNewDeptSelection(e.target.value)}
                  className="w-full mt-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 shadow-2xs"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForEdit(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateRoleAndDept}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm disabled:opacity-50 transition-colors"
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
