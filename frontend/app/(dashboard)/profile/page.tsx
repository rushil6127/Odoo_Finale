"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Shield,
  ShieldCheck,
  Crown,
  Edit3,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trophy,
  ArrowRight,
  Sparkles,
  CreditCard,
  KeyRound
} from "lucide-react";
import {
  fetchCurrentUser,
  fetchMemberProfile,
  updateMemberProfile,
  getStoredUser,
  AuthUser,
  MemberProfile
} from "@/lib/auth";

export default function ProfilePage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formData, setFormData] = useState({
    phone: "",
    address: "",
    date_of_birth: "",
    gender: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const showToast = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const user = await fetchCurrentUser();
      setAuthUser(user);

      try {
        const mem = await fetchMemberProfile();
        setProfile(mem);
        setFormData({
          phone: mem.phone || "",
          address: mem.address || "",
          date_of_birth: mem.date_of_birth || "",
          gender: mem.gender || "PREFER_NOT_TO_SAY",
          emergency_contact_name: mem.emergency_contact_name || "",
          emergency_contact_phone: mem.emergency_contact_phone || "",
        });
      } catch {
        // If member profile doesn't exist yet, we still have user info
      }
    } catch (err: any) {
      console.error("Failed to load profile:", err);
      // Fallback to stored user if offline
      const stored = getStoredUser();
      if (stored) setAuthUser(stored);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      showToast("error", "Member record not linked yet. Please contact administration.");
      return;
    }

    try {
      setSaving(true);
      const updated = await updateMemberProfile(profile.id, {
        phone: formData.phone,
        address: formData.address,
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender,
        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_phone: formData.emergency_contact_phone,
      });

      setProfile(updated);
      setIsEditing(false);
      showToast("success", "Profile details updated successfully!");
    } catch (err: any) {
      showToast("error", err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const isOwner = authUser?.role === "OWNER" || authUser?.email === "pushplamba104@gmail.com";

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm">Loading your member profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
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

      {/* Header Profile Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 md:p-8 shadow-xl">
        <div className="absolute -right-8 -top-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg border border-emerald-500/30">
              {authUser?.first_name?.[0] || authUser?.email?.[0]?.toUpperCase() || "U"}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  {authUser?.first_name} {authUser?.last_name}
                </h1>
                {isOwner ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                    <Crown className="w-3.5 h-3.5" />
                    Super Owner
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {authUser?.role || "MEMBER"}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 font-mono flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                {authUser?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-all hover:border-emerald-500/50 w-full sm:w-auto"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                Edit Profile
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-medium w-full sm:w-auto"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Information & Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  Personal & Contact Details
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Your official member record with the club desk.</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400">First Name</label>
                  <input
                    type="text"
                    disabled
                    value={authUser?.first_name || ""}
                    className="w-full mt-1 bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400">Last Name</label>
                  <input
                    type="text"
                    disabled
                    value={authUser?.last_name || ""}
                    className="w-full mt-1 bg-zinc-950/80 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Phone Number</label>
                  <div className="relative mt-1">
                    <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      disabled={!isEditing}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className={`w-full pl-9 pr-3.5 py-2 rounded-lg text-sm transition-colors ${
                        isEditing
                          ? "bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                          : "bg-zinc-950/60 border border-zinc-800/80 text-zinc-300"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300">Date of Birth</label>
                  <div className="relative mt-1">
                    <Calendar className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      disabled={!isEditing}
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className={`w-full pl-9 pr-3.5 py-2 rounded-lg text-sm transition-colors ${
                        isEditing
                          ? "bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                          : "bg-zinc-950/60 border border-zinc-800/80 text-zinc-300"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Gender</label>
                  <select
                    disabled={!isEditing}
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className={`w-full mt-1 px-3.5 py-2 rounded-lg text-sm transition-colors ${
                      isEditing
                        ? "bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                        : "bg-zinc-950/60 border border-zinc-800/80 text-zinc-300"
                    }`}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300">Residential Address</label>
                  <div className="relative mt-1">
                    <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. Golf Links, New Delhi"
                      className={`w-full pl-9 pr-3.5 py-2 rounded-lg text-sm transition-colors ${
                        isEditing
                          ? "bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                          : "bg-zinc-950/60 border border-zinc-800/80 text-zinc-300"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Emergency Medical / Court Contact
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Contact Name</label>
                    <input
                      type="text"
                      disabled={!isEditing}
                      value={formData.emergency_contact_name}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                      placeholder="Emergency contact person"
                      className={`w-full mt-1 px-3.5 py-2 rounded-lg text-sm transition-colors ${
                        isEditing
                          ? "bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                          : "bg-zinc-950/60 border border-zinc-800/80 text-zinc-300"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-300">Contact Phone</label>
                    <input
                      type="tel"
                      disabled={!isEditing}
                      value={formData.emergency_contact_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                      placeholder="+91 98765 00000"
                      className={`w-full mt-1 px-3.5 py-2 rounded-lg text-sm transition-colors ${
                        isEditing
                          ? "bg-zinc-950 border border-zinc-700 text-white focus:outline-none focus:border-emerald-500"
                          : "bg-zinc-950/60 border border-zinc-800/80 text-zinc-300"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {isEditing && (
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Membership Tier & Privilege Card */}
        <div className="space-y-6">
          {/* Membership Tier Status */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4" />
                Active Tier
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {profile?.active_membership ? "ACTIVE" : "FREE / GUEST"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <h4 className="text-lg font-extrabold text-white">
                {profile?.active_membership?.plan_name || "Club Member Tier"}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {profile?.active_membership
                  ? `Valid until ${new Date(profile.active_membership.end_date).toLocaleDateString()}`
                  : "Enjoy court bookings, offline UPI membership enrollment, and pro shop access."}
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-zinc-300">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
                <span className="text-zinc-400">Court Booking Privilege</span>
                <span className="font-semibold text-white">60-min sessions (up to 2/day)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
                <span className="text-zinc-400">Pro Shop Discount</span>
                <span className="font-semibold text-emerald-400">15% on Gear</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-800/80">
                <span className="text-zinc-400">Club House Access</span>
                <span className="font-semibold text-white">Lounge & Bar Tab</span>
              </div>
            </div>

            <Link
              href="/memberships"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition-all hover:scale-[1.01]"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Manage / Upgrade Membership
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          {/* Account Security Info */}
          <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 shadow-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
              Account & Security
            </h4>
            <div className="text-xs space-y-2 text-zinc-400">
              <div className="flex items-center justify-between">
                <span>Account ID</span>
                <span className="font-mono text-zinc-300">#USR-{authUser?.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Google OAuth</span>
                <span className="text-emerald-400 font-semibold">Connected</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Role Level</span>
                <span className="font-semibold text-white">{authUser?.role}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
