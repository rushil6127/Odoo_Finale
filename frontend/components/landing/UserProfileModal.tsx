"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  X, 
  User, 
  Crown, 
  CreditCard, 
  ShoppingBag, 
  Calendar, 
  MessageSquare, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  TrendingUp, 
  Sparkles, 
  Phone, 
  Mail, 
  Receipt, 
  ExternalLink, 
  Plus,
  ArrowRight,
  Check
} from "lucide-react";
import { isOwner, getUserRoleLabel, getAvatarImageUrl, type AuthUserProfile } from "@/lib/auth";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUserProfile;
  onLogout: () => void;
}

type TabType = "overview" | "crm" | "orders" | "bookings" | "payments";

export default function UserProfileModal({
  isOpen,
  onClose,
  user,
  onLogout,
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [newInquiryTitle, setNewInquiryTitle] = useState("");
  const [newInquiryCat, setNewInquiryCat] = useState("COACHING");
  const [inquiries, setInquiries] = useState(user.crmInquiries || []);
  const [showInquirySuccess, setShowInquirySuccess] = useState(false);

  if (!isOpen) return null;

  const handleAddInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInquiryTitle.trim()) return;

    const newInq = {
      id: `CRM-${Math.floor(1000 + Math.random() * 9000)}`,
      title: newInquiryTitle,
      category: newInquiryCat as "MEMBERSHIP" | "TRIAL_PASS" | "COACHING" | "EVENT",
      status: "NEW" as const,
      date: "Just now",
      notes: "Submitted by member. Concierge desk will review within 2 hours.",
      assignedTo: "Concierge Desk Team",
    };

    setInquiries([newInq, ...inquiries]);
    setNewInquiryTitle("");
    setShowInquirySuccess(true);
    setTimeout(() => setShowInquirySuccess(false), 4000);
  };

  const getTierColor = (plan: string) => {
    switch (plan) {
      case "GOLD":
        return "from-amber-400 to-amber-600 text-amber-950 border-amber-300";
      case "SILVER":
        return "from-slate-200 to-slate-400 text-slate-900 border-slate-300";
      default:
        return "from-sky-400 to-blue-600 text-white border-sky-300";
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Profile Modal Card */}
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Strip with Gradient & User Summary */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white p-6 sm:p-8 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-lime-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            aria-label="Close Profile Dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
            {/* User Identity */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-sky-400 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-2xl shadow-xl border-2 border-white/40 overflow-hidden shrink-0">
                {user.avatarUrl || user.avatar_url ? (
                  <img
                    src={getAvatarImageUrl(user.avatarUrl || user.avatar_url) || ""}
                    alt={user.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  user.name.split(" ").map((n) => n[0]).join("")
                )}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {user.membershipPlan ? (
                    <>
                      <span className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase border shadow-sm bg-gradient-to-r ${getTierColor(user.membershipPlan)}`}>
                        <Crown className="w-3 h-3 inline mr-1 -mt-0.5" />
                        {user.membershipPlan} Member
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                        {user.membershipStatus || "ACTIVE"}
                      </span>
                    </>
                  ) : (
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-bold border border-white/20 bg-white/10 text-slate-300">
                      No Active Membership
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5 font-bold text-sky-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {getUserRoleLabel(user)}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {user.phone}
                  </span>
                </div>
              </div>
            </div>

            {/* Balances Pill Box */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15 shrink-0">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-sky-300 tracking-wider">
                  Wallet Balance
                </div>
                <div className="text-base font-black text-white">
                  ₹{user.walletBalance.toLocaleString("en-IN")}
                </div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold text-lime-300 tracking-wider">
                  Active Tab Due
                </div>
                <div className="text-base font-black text-white">
                  ₹{user.clubTabsOutstanding.toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 mt-6 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "overview", label: "Overview", icon: User },
              { id: "crm", label: `CRM & Enquiries (${inquiries.length})`, icon: MessageSquare },
              { id: "orders", label: `Orders (${user.orders.length})`, icon: ShoppingBag },
              { id: "bookings", label: `Bookings (${user.bookings.length})`, icon: Calendar },
              { id: "payments", label: `Payments & Tabs (${user.payments.length})`, icon: CreditCard },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                    isActive
                      ? "bg-white text-slate-900 shadow-md scale-105"
                      : "bg-white/10 hover:bg-white/20 text-slate-200"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-280px)] space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200/80">
                  <div className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-1">
                    Membership Validity
                  </div>
                  <div className="text-lg font-black text-slate-900">
                    Expires {user.membershipExpiry}
                  </div>
                  <p className="text-xs text-sky-600 mt-1">
                    Member since {user.joinDate}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-lime-50 border border-lime-200/80">
                  <div className="text-xs font-bold text-lime-800 uppercase tracking-wider mb-1">
                    Next Reserved Session
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">
                    {user.bookings[0]?.courtName || "No upcoming booking"}
                  </div>
                  <p className="text-xs text-lime-700 mt-1">
                    {user.bookings[0]?.timeSlot || "Book a court anytime"}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Club Concierge Service
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">
                    Dedicated WhatsApp Line
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    +91 98765 43210 (24/7 Support)
                  </p>
                </div>
              </div>

              {/* Membership Benefits List */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-600" />
                  <span>{user.membershipPlan ? `Your ${user.membershipPlan} Tier Privileges` : "Club Membership Privileges"}</span>
                </h3>
                {user.membershipPlan ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Priority booking on all 4 Wimbledon Natural Grass Courts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>20% Member Discount at Pro Shop & 24hr Stringing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Complimentary Heated Olympic Pool & Lounger Access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Flexible Monthly Charge Tab at Champions Lounge Café</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200/80">
                    <p className="text-xs text-slate-600">
                      You currently have no active membership. Subscribe to a tier to unlock court reservations, discounts, and exclusive events.
                    </p>
                    <Link
                      href="/membership"
                      onClick={onClose}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shrink-0 whitespace-nowrap shadow-sm"
                    >
                      Choose a Plan
                    </Link>
                  </div>
                )}
              </div>

              {/* Quick Action Shortcuts */}
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="#courts"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Book Court Slot</span>
                </Link>
                <Link
                  href="#shop"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Pro Shop Catalog</span>
                </Link>
                {isOwner(user) ? (
                  <Link
                    href="/dashboard"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-lime-100 hover:bg-lime-200 text-lime-900 border border-lime-300 font-bold text-xs transition-all flex items-center gap-2"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Owner Console Dashboard</span>
                  </Link>
                ) : (
                  <Link
                    href="/profile/member?tab=bookings"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-900 border border-sky-300 font-bold text-xs transition-all flex items-center gap-2"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>My Court Bookings</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CRM & INQUIRIES */}
          {activeTab === "crm" && (
            <div className="space-y-6">
              {/* New Inquiry Form */}
              <form 
                onSubmit={handleAddInquiry} 
                className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-sky-600" />
                    <span>Create New CRM Request / Concierge Ticket</span>
                  </h3>
                  {showInquirySuccess && (
                    <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ticket Submitted!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="e.g. Schedule racket demo or private coaching on clay..."
                      value={newInquiryTitle}
                      onChange={(e) => setNewInquiryTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={newInquiryCat}
                      onChange={(e) => setNewInquiryCat(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-sky-500"
                    >
                      <option value="COACHING">Private Coaching</option>
                      <option value="MEMBERSHIP">Membership Upgrade</option>
                      <option value="TRIAL_PASS">Guest Pass</option>
                      <option value="EVENT">Tournament Entry</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shrink-0 transition-all"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </form>

              {/* Inquiries History List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active & Past Concierge Inquiries
                </h4>

                {inquiries.map((inq) => (
                  <div 
                    key={inq.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm hover:border-sky-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                            {inq.id}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 uppercase">
                            {inq.category}
                          </span>
                          <span className="text-[11px] text-slate-400">&bull; {inq.date}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1">
                          {inq.title}
                        </h4>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        inq.status === "APPROVED" 
                          ? "bg-green-100 text-green-800 border border-green-300"
                          : inq.status === "IN_REVIEW"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-sky-100 text-sky-800 border border-sky-300"
                      }`}>
                        {inq.status.replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <strong>Desk Update:</strong> {inq.notes}
                    </p>
                    <div className="text-[11px] text-slate-500">
                      Assigned Agent: <strong>{inq.assignedTo}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ORDERS */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                    Club orders
                  </h4>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[11px] font-black">
                    {user.orders.length}
                  </span>
                </div>
                <Link
                  href="#shop"
                  onClick={onClose}
                  className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
                >
                  Order Gear <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Order list */}
              <div className="space-y-3">
                {user.orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3"
                  >
                    {/* Order header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-black text-slate-900">
                            {order.orderNumber}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            order.type === "PRO_SHOP"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : order.type === "CAFE"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-purple-50 text-purple-700 border-purple-200"
                          }`}>
                            {order.type === "PRO_SHOP" ? "Pro Shop" : order.type.charAt(0) + order.type.slice(1).toLowerCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{order.date}</p>
                      </div>

                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${
                        order.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : order.status === "READY_FOR_PICKUP"
                          ? "bg-sky-50 text-sky-700 border border-sky-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}>
                        {order.status === "COMPLETED" && <Check className="w-3 h-3" />}
                        {order.status === "COMPLETED" ? "Completed" : order.status === "READY_FOR_PICKUP" ? "Ready for pickup" : order.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Items */}
                    <div className="space-y-1.5">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 text-xs">
                            <span className="font-bold text-slate-400 mr-1.5">{item.quantity}×</span>
                            {item.name}
                          </span>
                          <span className="font-semibold text-slate-900 text-xs tabular-nums">
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        Paid via {order.paymentMethod}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Total</span>
                        <span className="font-black text-slate-900 text-sm">
                          ₹{order.totalAmount.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


          {/* TAB 4: BOOKINGS */}
          {activeTab === "bookings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Court Reservations & Practice Sessions
                </h4>
                <Link
                  href="#courts"
                  onClick={onClose}
                  className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1"
                >
                  <span>Book New Slot</span> &rarr;
                </Link>
              </div>

              {user.bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                        {booking.bookingCode}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {booking.sport}
                      </span>
                      <span className="text-[11px] text-slate-400">&bull; {booking.surface}</span>
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900">
                      {booking.courtName}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-semibold text-sky-700">
                        <Clock className="w-3.5 h-3.5" /> {booking.timeSlot}
                      </span>
                      <span>&bull; {booking.date}</span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      booking.status === "CONFIRMED"
                        ? "bg-green-100 text-green-800 border border-green-300"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {booking.status}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      ₹{booking.amount} Paid
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: PAYMENTS & BILLING */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Transaction & Invoicing Records
                </h4>
                <div className="text-xs text-slate-500">
                  Auto-settled via Club Digital POS
                </div>
              </div>

              {user.payments.map((pay) => (
                <div
                  key={pay.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="text-xs font-extrabold text-slate-900">
                        {pay.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="font-mono">{pay.transactionId}</span>
                      <span>&bull; {pay.date}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-700">
                        {pay.method}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-slate-900">
                      ₹{pay.amount.toLocaleString("en-IN")}
                    </div>
                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      {pay.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Footer Control Bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="text-xs font-bold text-slate-700 hover:text-sky-600 flex items-center gap-1.5 transition-colors"
          >
            <span>Open Staff & Admin Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 transition-all flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
