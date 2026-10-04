"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  CreditCard,
  QrCode,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ShieldCheck,
  Search,
  Eye,
  Check,
  X,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trophy,
  ArrowRight,
  Filter,
  Pencil,
  Trash2,
  Plus
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getStoredUser, AuthUser } from "@/lib/auth";

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string;
  displayed_monthly_price: number;
  effective_annual_price: number;
  duration_months: number;
  complimentary_months: number;
  benefits: {
    courts_count?: number;
    shop_discount_pct?: number;
    features?: string[];
  };
}

interface MembershipRequest {
  id: number;
  user_id: number;
  user?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    full_name: string;
  };
  plan_id: number;
  plan?: Plan;
  status: "PENDING" | "APPROVED" | "REJECTED";
  payment_method: string;
  transaction_reference: string;
  screenshot_url?: string;
  amount_paid: number;
  requester_notes?: string;
  reviewed_by_id?: number;
  reviewer?: {
    full_name: string;
    email: string;
  };
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
}

export default function MembershipsPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [myRequests, setMyRequests] = useState<MembershipRequest[]>([]);
  const [allRequests, setAllRequests] = useState<MembershipRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"plans" | "my_requests" | "admin_queue">("plans");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Submit Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState("UPI_QR");
  const [screenshotFile, setScreenshotFile] = useState<string | null>(null);
  const [requesterNotes, setRequesterNotes] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Admin Review Modal State
  const [selectedReviewRequest, setSelectedReviewRequest] = useState<MembershipRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const isAdminOrOwner = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";
  const isOwner = currentUser?.role === "OWNER";

  // Owner Edit Plan Modal State
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editMonthlyPrice, setEditMonthlyPrice] = useState<number | string>(0);
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [newFeatureInput, setNewFeatureInput] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);

  const handleOpenEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditMonthlyPrice(plan.displayed_monthly_price);
    setEditFeatures([...(plan.benefits?.features || [])]);
    setNewFeatureInput("");
    setIsEditPlanModalOpen(true);
  };

  const handleAddFeature = () => {
    if (!newFeatureInput.trim()) return;
    setEditFeatures((prev) => [...prev, newFeatureInput.trim()]);
    setNewFeatureInput("");
  };

  const handleDeleteFeature = (idx: number) => {
    setEditFeatures((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    const priceNum = Number(editMonthlyPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Please enter a valid non-negative monthly price.");
      return;
    }
    if (editFeatures.length === 0) {
      setError("Please provide at least one benefit feature for this tier.");
      return;
    }

    try {
      setSavingPlan(true);
      setError(null);
      const res = await apiClient.put<{ plan: Plan }>(`/membership-plans/${editingPlan.id}`, {
        displayed_monthly_price: priceNum,
        features: editFeatures,
      });

      setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? res.plan : p)));
      setSuccess(`Plan "${res.plan.name}" updated successfully! Database and site updated in real-time.`);
      setIsEditPlanModalOpen(false);
      setEditingPlan(null);
      setTimeout(() => setSuccess(null), 5000);
      await fetchPlans();
    } catch (err: any) {
      setError(err?.message || "Failed to update membership plan.");
    } finally {
      setSavingPlan(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const data = await apiClient.get<{ plans: Plan[] }>("/membership-plans");
      setPlans(data.plans || []);
    } catch {
      // Ignore
    }
  };

  const fetchMyRequests = async () => {
    try {
      const data = await apiClient.get<{ requests: MembershipRequest[] }>("/members/requests/my");
      setMyRequests(data.requests || []);
    } catch {
      // Ignore
    }
  };

  const fetchAllRequests = useCallback(async () => {
    if (!isAdminOrOwner) return;
    try {
      const statusParam = statusFilter !== "ALL" ? `&status=${statusFilter}` : "";
      const searchParam = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : "";
      const data = await apiClient.get<{ requests: MembershipRequest[] }>(
        `/members/requests?page=1&per_page=50${statusParam}${searchParam}`
      );
      setAllRequests(data.requests || []);
    } catch {
      // Ignore
    }
  }, [isAdminOrOwner, statusFilter, searchQuery]);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    async function load() {
      setLoading(true);
      await fetchPlans();
      await fetchMyRequests();
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (isAdminOrOwner) {
      fetchAllRequests();
    }
  }, [isAdminOrOwner, fetchAllRequests]);

  const handleOpenSubmit = (plan: Plan) => {
    setSelectedPlan(plan);
    setAmountPaid(plan.effective_annual_price || plan.displayed_monthly_price * 10);
    setTransactionRef("");
    setScreenshotFile(null);
    setRequesterNotes("");
    setIsSubmitModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64 for instant preview & secure storage
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setScreenshotFile(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    setActionLoading(true);
    setError(null);

    try {
      await apiClient.post("/members/requests", {
        plan_id: selectedPlan.id,
        transaction_reference: transactionRef.trim(),
        amount_paid: Number(amountPaid),
        screenshot_url: screenshotFile,
        payment_method: paymentMethod,
        requester_notes: requesterNotes.trim() || undefined,
      });

      setSuccess("Membership request submitted! Our administrators will review your payment receipt.");
      setIsSubmitModalOpen(false);
      await fetchMyRequests();
      setActiveTab("my_requests");
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err?.message || "Failed to submit membership request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (requestId: number) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/members/requests/${requestId}/approve`, {
        review_notes: reviewNotes.trim() || undefined,
      });
      setSuccess("Request APPROVED! Membership subscription is now officially active.");
      setSelectedReviewRequest(null);
      setReviewNotes("");
      await fetchAllRequests();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to approve membership request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (requestId: number) => {
    setActionLoading(true);
    setError(null);
    try {
      await apiClient.post(`/members/requests/${requestId}/reject`, {
        review_notes: reviewNotes.trim() || undefined,
      });
      setSuccess("Request marked as REJECTED.");
      setSelectedReviewRequest(null);
      setReviewNotes("");
      await fetchAllRequests();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || "Failed to reject request.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-[family-name:var(--font-outfit)] tracking-tight">
            Membership & Payment Review Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Browse tiers, submit offline payment proofs with UPI/Bank transfer, and review requests.
          </p>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab("plans")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "plans" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Membership Plans
          </button>
          <button
            onClick={() => setActiveTab("my_requests")}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "my_requests" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>My Requests</span>
            {myRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-100 text-sky-800 text-[10px]">
                {myRequests.length}
              </span>
            )}
          </button>
          {isAdminOrOwner && (
            <button
              onClick={() => setActiveTab("admin_queue")}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "admin_queue"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-lime-400" />
              <span>Admin Review Queue</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Alerts */}
      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: MEMBERSHIP PLANS */}
      {activeTab === "plans" && (
        <div className="space-y-8">
          {/* Offline Payment Information Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-400/30">
                <QrCode className="w-3.5 h-3.5" />
                <span>Official Club QR & Wire Transfer</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                Secure Offline Membership Payments
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan the club&apos;s ICICI UPI QR code or transfer directly to our current account. Submit your transaction UTR reference and screenshot to request activation.
              </p>
            </div>

            {/* Bank Specs Strip */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700 text-xs space-y-1.5 w-full sm:w-auto font-mono text-slate-300">
              <div><strong>UPI VPA:</strong> <span className="text-[#CCFF00]">championsclub@icici</span></div>
              <div><strong>Bank:</strong> ICICI Bank, Sports Complex Branch</div>
              <div><strong>A/C No:</strong> 0045-8902-1194</div>
              <div><strong>IFSC:</strong> ICIC0000045</div>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-800 text-[11px] font-extrabold border border-sky-100">
                      {plan.code} PLAN
                    </span>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditPlan(plan)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-black inline-flex items-center gap-1.5 transition-all shadow-2xs hover:scale-105 active:scale-95 cursor-pointer"
                          title="Owner Exclusive: Edit Price & Benefits"
                        >
                          <Pencil className="w-3 h-3 text-amber-700" />
                          <span>Edit Tier</span>
                        </button>
                      )}
                      <span className="text-[11px] font-bold text-slate-400">
                        {plan.duration_months} Months
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-1 font-[family-name:var(--font-outfit)]">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-slate-500 mb-5 min-h-[36px]">
                    {plan.description}
                  </p>

                  <div className="mb-6 pb-6 border-b border-slate-100">
                    <div className="text-3xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                      ₹{plan.displayed_monthly_price.toLocaleString("en-IN")}
                      <span className="text-xs font-medium text-slate-400"> / month</span>
                    </div>
                    <div className="text-[11px] font-bold text-emerald-600 mt-1">
                      Effective Billed Annually: ₹{plan.effective_annual_price?.toLocaleString("en-IN") || (plan.displayed_monthly_price * 10).toLocaleString("en-IN")} (Includes 2 Mo Free)
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-2.5 mb-6 text-xs text-slate-600">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      <span>Included Privileges ({plan.benefits?.features?.length || 0})</span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditPlan(plan)}
                          className="text-amber-700 hover:text-amber-800 font-bold inline-flex items-center gap-1 text-[11px] hover:underline cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add/Edit</span>
                        </button>
                      )}
                    </div>
                    {(plan.benefits?.features || [
                      "Full access to 22+ championship venues",
                      "Priority court match reservation window",
                      "Member discounts on Pro Shop & Café tabs",
                    ]).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleOpenSubmit(plan)}
                  className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-sky-600 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Request Plan & Pay</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: MY SUBMITTED REQUESTS */}
      {activeTab === "my_requests" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 font-[family-name:var(--font-outfit)]">
              My Membership Requests & Proof History
            </h2>

            {myRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>You haven&apos;t submitted any offline membership requests yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Request ID</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Transaction Ref</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Submitted On</th>
                      <th className="p-3.5">Admin Review Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {myRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/80">
                        <td className="p-3.5 font-mono font-bold">REQ-{req.id}</td>
                        <td className="p-3.5 font-semibold text-slate-900">{req.plan?.name || `Plan #${req.plan_id}`}</td>
                        <td className="p-3.5 font-bold">₹{req.amount_paid?.toLocaleString("en-IN")}</td>
                        <td className="p-3.5 font-mono text-slate-600">{req.transaction_reference}</td>
                        <td className="p-3.5">
                          {req.status === "PENDING" && (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Under Review
                            </span>
                          )}
                          {req.status === "APPROVED" && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Approved & Active
                            </span>
                          )}
                          {req.status === "REJECTED" && (
                            <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-extrabold inline-flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-slate-400">
                          {new Date(req.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="p-3.5 text-slate-500 italic max-w-xs truncate">
                          {req.review_notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN REVIEW QUEUE */}
      {activeTab === "admin_queue" && isAdminOrOwner && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search UTR, name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending Review Only</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>

              <button
                onClick={fetchAllRequests}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Refresh queue"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Queue Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">ID</th>
                    <th className="p-3.5">Requester</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">UTR Reference</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Proof</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {allRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/80">
                      <td className="p-3.5 font-mono font-bold">#{req.id}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{req.user?.full_name || req.user?.email}</div>
                        <div className="text-[10px] text-slate-400">{req.user?.email}</div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-900">{req.plan?.name || `Plan #${req.plan_id}`}</td>
                      <td className="p-3.5 font-bold">₹{req.amount_paid?.toLocaleString("en-IN")}</td>
                      <td className="p-3.5 font-mono text-slate-600">{req.transaction_reference}</td>
                      <td className="p-3.5">
                        {req.status === "PENDING" && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                            PENDING
                          </span>
                        )}
                        {req.status === "APPROVED" && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                            APPROVED
                          </span>
                        )}
                        {req.status === "REJECTED" && (
                          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[10px] font-extrabold">
                            REJECTED
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {req.screenshot_url ? (
                          <button
                            onClick={() => {
                              setSelectedReviewRequest(req);
                              setReviewNotes("");
                            }}
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700 font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Proof</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">No image</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedReviewRequest(req);
                            setReviewNotes("");
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-sky-600 text-white font-bold text-[11px] transition-colors"
                        >
                          Review & Decide
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: SUBMIT PAYMENT REQUEST */}
      {isSubmitModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                  Offline Membership Request
                </span>
                <h3 className="text-lg font-black font-[family-name:var(--font-outfit)]">
                  {selectedPlan.name} (12 Mo + 2 Mo Free)
                </h3>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-6 space-y-4 text-xs">
              {/* QR & Bank Quick Strip */}
              <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-between gap-3 text-sky-900">
                <div className="space-y-0.5">
                  <div className="font-bold">Scan UPI QR / Transfer to:</div>
                  <div className="font-mono font-bold text-sky-700">championsclub@icici</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500">Pay Exactly</div>
                  <div className="font-black text-sm text-slate-900">
                    ₹{amountPaid.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium"
                >
                  <option value="UPI_QR">UPI QR (GooglePay / PhonePe / Paytm)</option>
                  <option value="BANK_TRANSFER">Direct Bank IMPS / NEFT Transfer</option>
                  <option value="CARD">Debit / Credit Card Counter Terminal</option>
                  <option value="CASH">Club Reception Cash Receipt</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Transaction Reference / UTR Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 428901239847 or UPI Ref ID"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono"
                />
              </div>

              {/* Upload Screenshot */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Upload Payment Screenshot / Receipt Proof
                </label>
                <div className="mt-1 flex justify-center px-4 pt-4 pb-4 border-2 border-slate-300 border-dashed rounded-2xl bg-slate-50/50 hover:bg-slate-50">
                  <div className="space-y-1 text-center">
                    {screenshotFile ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshotFile}
                          alt="Payment Screenshot Preview"
                          className="max-h-36 mx-auto rounded-lg border shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setScreenshotFile(null)}
                          className="text-[11px] text-red-600 font-bold hover:underline"
                        >
                          Remove & Re-upload
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-8 w-8 text-slate-400" />
                        <div className="flex text-xs text-slate-600 justify-center">
                          <label className="relative cursor-pointer rounded-md font-bold text-sky-600 hover:text-sky-500">
                            <span>Upload a screenshot</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="sr-only"
                            />
                          </label>
                        </div>
                        <p className="text-[10px] text-slate-400">PNG, JPG, WEBP up to 5MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Notes for Admin (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Paid via HDFC Google Pay at 2:30 PM..."
                  value={requesterNotes}
                  onChange={(e) => setRequesterNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl text-white bg-sky-600 hover:bg-sky-700 font-bold shadow-sm flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Submit for Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADMIN REVIEW & DECISION MODAL */}
      {selectedReviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div>
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                  Admin Verification Portal
                </span>
                <h3 className="text-lg font-black font-[family-name:var(--font-outfit)]">
                  Review Membership Request #{selectedReviewRequest.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedReviewRequest(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {/* Requester & Plan Card */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Requester</span>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedReviewRequest.user?.full_name || selectedReviewRequest.user?.email}
                  </div>
                  <div className="text-slate-500">{selectedReviewRequest.user?.email}</div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block uppercase font-bold">Plan & Amount</span>
                  <div className="font-bold text-sky-700 text-sm">
                    {selectedReviewRequest.plan?.name || `Plan #${selectedReviewRequest.plan_id}`}
                  </div>
                  <div className="font-black text-slate-900">
                    ₹{selectedReviewRequest.amount_paid?.toLocaleString("en-IN")} ({selectedReviewRequest.payment_method})
                  </div>
                </div>

                <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Transaction Reference / UTR</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {selectedReviewRequest.transaction_reference}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-bold">Submitted Date</span>
                    <span className="text-slate-700">
                      {new Date(selectedReviewRequest.created_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Requester notes if any */}
              {selectedReviewRequest.requester_notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <strong>Requester Notes:</strong> {selectedReviewRequest.requester_notes}
                </div>
              )}

              {/* Screenshot Proof */}
              <div>
                <span className="text-slate-700 font-bold block mb-2">
                  Uploaded Payment Proof Screenshot:
                </span>
                {selectedReviewRequest.screenshot_url ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 flex justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedReviewRequest.screenshot_url}
                      alt="Payment Proof Receipt"
                      className="max-h-72 object-contain rounded-xl shadow"
                    />
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 border border-dashed rounded-2xl text-center text-slate-400">
                    No screenshot image was attached with this request.
                  </div>
                )}
              </div>

              {/* Reviewer Note Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Admin Verification Notes / Rejection Reason
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bank credit verified in ICICI ledger on 3rd Oct..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedReviewRequest(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold"
                >
                  Close
                </button>

                {selectedReviewRequest.status === "PENDING" && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleReject(selectedReviewRequest.id)}
                      className="px-4 py-2.5 rounded-xl text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 font-bold flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Request</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleApprove(selectedReviewRequest.id)}
                      className="px-5 py-2.5 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-sm flex items-center gap-1.5"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Approve & Grant Membership</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OWNER EDIT PLAN MODAL */}
      {isEditPlanModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                  <Pencil className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                      Edit Plan: {editingPlan.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">
                      Owner Console
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Modify monthly fee and live benefits for {editingPlan.code} plan. Updates database in real-time.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPlanModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price Edit Section */}
            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                Monthly Membership Fee (INR ₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editMonthlyPrice}
                  onChange={(e) => setEditMonthlyPrice(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-lg font-black text-slate-900 focus:bg-white focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
                  placeholder="e.g. 2999"
                />
              </div>

              {/* Real-time Annual Math Indicator */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-xs font-bold text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Effective Annual Billing:</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-emerald-900">
                    ₹{(Math.max(0, Number(editMonthlyPrice) || 0) * 10).toLocaleString("en-IN")}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold block">
                    (10 Billed Months + 2 Complimentary)
                  </span>
                </div>
              </div>
            </div>

            {/* Benefits Manager Section */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
                    Plan Privileges &amp; Inclusions ({editFeatures.length})
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Add or remove perks displayed to club members and the public.
                  </p>
                </div>
              </div>

              {/* Add Benefit Input Bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFeatureInput}
                  onChange={(e) => setNewFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                  placeholder="Type new benefit (e.g. 2x free personal trainer sessions)..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:border-amber-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddFeature}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-amber-600 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Perk</span>
                </button>
              </div>

              {/* Current Benefits List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {editFeatures.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No benefits added yet. Type a benefit above and click &quot;Add Perk&quot;.
                  </div>
                ) : (
                  editFeatures.map((feat, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 flex items-center justify-between gap-3 text-xs text-slate-700 transition-colors group"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug break-words">{feat}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFeature(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                        title="Delete this benefit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsEditPlanModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingPlan}
                onClick={handleSavePlan}
                className="px-6 py-2.5 rounded-xl text-xs font-black text-slate-950 bg-[#CCFF00] hover:bg-[#b8e600] transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingPlan ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-slate-950" />
                    <span>Save &amp; Update in Database</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
