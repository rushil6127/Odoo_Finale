"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Crown, ShieldCheck, Check, Zap, ArrowRight, Clock, Calendar,
  CreditCard, Sparkles, AlertCircle, CheckCircle2, Lock, ChevronLeft,
  Trophy, User, RefreshCw, PartyPopper, Rocket,
  ChevronRight, Shield, BadgeCheck, Wallet, QrCode, Smartphone,
  LayoutDashboard,
} from "lucide-react";
import { useCurrentUser, setStoredUser } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";

interface PlanBenefitDetails {
  tier_level?: number; courts_count?: number; court_types?: string[];
  courts_access?: string; reservation_window_days?: number;
  shop_discount_pct?: number; monthly_coaching_sessions?: number;
  monthly_guest_passes?: number; locker_steam_spa_access?: boolean;
  vip_lounge_bar_priority?: boolean; digital_card_charging_tab?: boolean;
  pool_clubhouse_access?: boolean; social_play_included?: boolean;
  age_bracket?: string; features?: string[];
}
interface Plan {
  id: number; code: "SILVER" | "GOLD" | "JUNIOR" | string; name: string;
  description: string; displayed_monthly_price: number;
  effective_annual_price: number; duration_months: number;
  complimentary_months: number; benefits: PlanBenefitDetails; is_active: boolean;
}
interface ActiveMembershipData {
  id: number; plan_id: number; start_date: string; end_date: string;
  status: string; display_status: string; is_active: boolean;
  price_paid: number; plan?: Plan;
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: 1, code: "SILVER", name: "Silver Tier",
    description: "Standard club membership with court access, swimming pool, and shop discounts.",
    displayed_monthly_price: 2799, effective_annual_price: 27990, duration_months: 12, complimentary_months: 2,
    benefits: { tier_level: 1, shop_discount_pct: 10, social_play_included: true, pool_clubhouse_access: true,
      features: [
        "Access to all 14 Hard & Clay Tennis courts (Off-Peak & Standard)",
        "Standard 3-day advance court reservation window",
        "10% member discount across Pro Shop equipment & apparel",
        "Friday Social-Play mixer pass & round-robin ladder entry",
        "Access to Olympic swimming pool & clubhouse lounge",
        "Digital member card & unified charging tab",
      ],
    }, is_active: true,
  },
  {
    id: 2, code: "GOLD", name: "Gold Champion",
    description: "Premium all-access membership with grass courts, VIP perks, coaching, and guest passes.",
    displayed_monthly_price: 4799, effective_annual_price: 47990, duration_months: 12, complimentary_months: 2,
    benefits: { tier_level: 2, shop_discount_pct: 20, monthly_coaching_sessions: 2, monthly_guest_passes: 4,
      locker_steam_spa_access: true, vip_lounge_bar_priority: true,
      features: [
        "Unlimited priority access to all 22+ courts including Grass Lawns",
        "7-day advance peak-hour slot reservation window",
        "20% member discount on Pro Shop apparel, strings & gear",
        "2x monthly complimentary private coaching sessions with pro coaches",
        "4 free monthly guest passes with full clubhouse & pool privileges",
        "Executive locker suite, steam, sauna, and hot jacuzzi access",
        "VIP priority table reservations at the Champions Lounge & Bar",
      ],
    }, is_active: true,
  },
  {
    id: 3, code: "JUNIOR", name: "Junior Academy",
    description: "Youth membership for players under 18 with dedicated training clinics, coaching, and tournaments.",
    displayed_monthly_price: 1999, effective_annual_price: 19990, duration_months: 12, complimentary_months: 2,
    benefits: { tier_level: 1, age_bracket: "Ages 6-18", shop_discount_pct: 15,
      features: [
        "Ages 6-18 / under 18 dedicated athletic tier",
        "Dedicated afternoon and weekend youth training court allocation",
        "4x monthly structured group academy clinics with certified coaches",
        "15% discount on junior racket stringing, balls & footwear",
        "Junior tournament & ranking ladder participation",
        "Olympic pool swim safety & stroke training sessions",
        "Comprehensive athletic progress and fitness tracking",
      ],
    }, is_active: true,
  },
];

function getPlanStyle(code: string) {
  const c = code.toUpperCase();
  if (c === "GOLD") return {
    gradient: "from-amber-950/60 via-slate-900 to-yellow-950/40",
    ring: "ring-2 ring-amber-400/40",
    badge: "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900",
    badgeText: "Most Popular · VIP", priceColor: "text-amber-300",
    checkColor: "bg-amber-400/20 text-amber-400",
    btnGradient: "from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900",
    topEdge: true, iconBg: "bg-amber-400/15 border border-amber-400/25", tierColor: "text-amber-400",
  };
  if (c === "JUNIOR") return {
    gradient: "from-emerald-950/60 via-slate-900 to-teal-950/40",
    ring: "ring-1 ring-emerald-500/30",
    badge: "bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-900",
    badgeText: "Ages 6-18", priceColor: "text-emerald-300",
    checkColor: "bg-emerald-500/20 text-emerald-400",
    btnGradient: "from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white",
    topEdge: false, iconBg: "bg-emerald-500/15 border border-emerald-500/25", tierColor: "text-emerald-400",
  };
  return {
    gradient: "from-slate-800/80 via-slate-900 to-slate-800/60",
    ring: "ring-1 ring-slate-700/50",
    badge: "bg-gradient-to-r from-slate-400 to-slate-500 text-slate-900",
    badgeText: "Essential", priceColor: "text-sky-300",
    checkColor: "bg-sky-500/20 text-sky-400",
    btnGradient: "from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white",
    topEdge: false, iconBg: "bg-slate-700/50 border border-slate-600/30", tierColor: "text-slate-400",
  };
}

function PlanIcon({ code }: { code: string }) {
  const c = code.toUpperCase();
  if (c === "GOLD") return <Crown className="w-6 h-6 text-amber-400" />;
  if (c === "JUNIOR") return <Rocket className="w-6 h-6 text-emerald-400" />;
  return <Shield className="w-6 h-6 text-slate-300" />;
}

export default function MembershipPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewMember = searchParams?.get("welcome") === "1";
  const { user, isAuthenticated } = useCurrentUser();

  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [activeMembership, setActiveMembership] = useState<ActiveMembershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<Plan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<{
    orderId: string; keyId: string; amount: number; currency: string;
    plan: Plan; isUpgrade: boolean; isDowngrade: boolean;
  } | null>(null);
  const [completedPayment, setCompletedPayment] = useState<{
    planName: string; planCode: string; startDate: string; endDate: string;
    amount: number; transactionId: string;
  } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [payMethod, setPayMethod] = useState<"razorpay" | "upi" | "card" | "netbanking">("razorpay");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const r = await apiClient.get<{ plans: Plan[] }>("/membership-plans");
        if (r?.plans?.length) {
          const ord: Record<string, number> = { SILVER: 1, GOLD: 2, JUNIOR: 3 };
          setPlans([...r.plans].sort((a, b) => (ord[a.code.toUpperCase()] ?? 99) - (ord[b.code.toUpperCase()] ?? 99)));
        }
      } catch { /* use fallback */ }
      const token = typeof window !== "undefined" ? localStorage.getItem("cc_token") : null;
      if (token) {
        try {
          const s = await apiClient.get<{ active_membership: ActiveMembershipData | null }>("/membership-plans/my-status");
          if (s?.active_membership) setActiveMembership(s.active_membership);
        } catch { if (user?.active_membership) setActiveMembership(user.active_membership); }
      }
    } catch (e: any) { setError(e?.message || "Failed to load."); }
    finally { setLoading(false); }
  }, [user?.id, user?.email]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentPlanCode = (activeMembership?.plan?.code || user?.membership_plan || user?.membershipPlan || "").toUpperCase();

  const fmt = (d?: string) => {
    if (!d) return "N/A";
    try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const daysLeft = (end?: string) => {
    if (!end) return null;
    const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
    return d > 0 ? d : 0;
  };

  const handleSubscribe = async (plan: Plan) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("cc_token") : null;
    if (!token && !isAuthenticated) { setShowLoginPrompt(true); return; }
    setProcessingPlan(plan); setIsProcessing(true); setError(null);
    try {
      const res = await apiClient.post<{
        razorpay_order_id: string; razorpay_key_id: string; amount: number;
        currency: string; plan: Plan; is_upgrade: boolean; is_downgrade: boolean;
      }>("/membership-plans/subscribe/order", { plan_id: plan.id, plan_code: plan.code });
      setCheckoutOrder({ orderId: res.razorpay_order_id, keyId: res.razorpay_key_id, amount: res.amount, currency: res.currency || "INR", plan, isUpgrade: res.is_upgrade, isDowngrade: res.is_downgrade });
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        try {
          const opts = {
            key: res.razorpay_key_id, amount: Math.round(res.amount * 100), currency: res.currency || "INR",
            name: "The Champions Club", description: `${plan.name} Annual Pass`, order_id: res.razorpay_order_id,
            prefill: { name: user?.name || user?.full_name || "Member", email: user?.email || "", contact: user?.phone || "" },
            theme: { color: "#f59e0b" },
            handler: async (r: any) => { await handleVerify({ plan, orderId: r.razorpay_order_id || res.razorpay_order_id, paymentId: r.razorpay_payment_id || `pay_${Date.now()}`, signature: r.razorpay_signature || "sig", amount: res.amount }); },
            modal: { ondismiss: () => setProcessingPlan(null) },
          };
          const rzp = new (window as any).Razorpay(opts);
          rzp.on("payment.failed", (r: any) => { setError(r.error?.description || "Payment failed."); setProcessingPlan(null); });
          rzp.open();
        } catch { setShowCheckoutModal(true); }
      } else { setShowCheckoutModal(true); }
    } catch (e: any) { setError(e?.message || "Failed to initiate payment."); }
    finally { setIsProcessing(false); }
  };

  const handleVerify = async (params: { plan: Plan; orderId: string; paymentId: string; signature: string; amount: number; }) => {
    setIsProcessing(true); setError(null);
    try {
      const v = await apiClient.post<{ membership: ActiveMembershipData; user: any; message: string; }>(
        "/membership-plans/subscribe/verify",
        { plan_id: params.plan.id, plan_code: params.plan.code, razorpay_order_id: params.orderId, razorpay_payment_id: params.paymentId, razorpay_signature: params.signature, amount: params.amount }
      );
      if (v?.membership) setActiveMembership(v.membership);
      if (v?.user) setStoredUser(v.user);
      setCompletedPayment({ planName: params.plan.name, planCode: params.plan.code, startDate: v.membership.start_date, endDate: v.membership.end_date, amount: params.amount, transactionId: params.paymentId });
      setShowCheckoutModal(false);
      setSuccessMessage(v.message || `Welcome to ${params.plan.name}!`);
      await loadData();
    } catch (e: any) { setError(e?.message || "Verification failed. Contact support."); }
    finally { setIsProcessing(false); setProcessingPlan(null); }
  };

  return (
    <div className="min-h-screen text-slate-100" style={{ background: "linear-gradient(135deg,#020617 0%,#0c1426 30%,#0f172a 60%,#050d1a 100%)" }}>
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full opacity-[0.05]" style={{ background: "radial-gradient(circle,#f59e0b,transparent 70%)" }} />
        <div className="absolute top-1/2 -left-60 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle,#0ea5e9,transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle,#10b981,transparent 70%)" }} />
      </div>

      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <span className="text-slate-900 font-black text-xs">CC</span>
              </div>
              <span className="font-extrabold text-sm tracking-tight text-white group-hover:text-amber-400 transition-colors">The Champions Club</span>
            </Link>
            <span className="text-slate-700 text-xs hidden sm:inline">&bull;</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/70 hidden sm:inline">Membership Portal</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-white">{user?.name || user?.full_name || user?.email}</span>
                  <span className="text-[10px] text-slate-400">{currentPlanCode ? `${currentPlanCode} Member` : "New Member"}</span>
                </div>
                <Link href="/profile" className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 border border-white/10 transition-all flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" /><span>My Profile</span>
                </Link>
              </div>
            ) : (
              <Link href="/login" className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs transition-all">Sign In</Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        {/* NEW MEMBER WELCOME BANNER */}
        {isNewMember && !currentPlanCode && (
          <div className="mb-10 rounded-3xl overflow-hidden border border-amber-400/20 shadow-2xl shadow-amber-500/10 relative">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#451a03 0%,#1c1003 40%,#0c1117 100%)" }} />
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle,#f59e0b,transparent 70%)" }} />
            <div className="relative z-10 p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <PartyPopper className="w-8 h-8 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">
                  <Sparkles className="w-3 h-3" />Welcome to The Champions Club
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">Account created! Choose your membership</h1>
                <p className="text-sm text-amber-100/60 leading-relaxed max-w-xl">Pick the tier that matches your game, complete a quick secure payment, and your membership activates instantly.</p>
              </div>
              {/* Step progress */}
              <div className="flex-shrink-0 hidden lg:flex items-center gap-1">
                {(["Register", "Pick Plan", "Pay", "Play!"] as const).map((label, i) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${i === 0 ? "bg-emerald-500 border-emerald-400 text-white" : i === 1 ? "bg-amber-400 border-amber-300 text-slate-900 animate-pulse" : "bg-white/5 border-white/10 text-slate-500"}`}>
                        {i === 0 ? <Check className="w-4 h-4" /> : <span>{i + 1}</span>}
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-emerald-400" : i === 1 ? "text-amber-400" : "text-slate-600"}`}>{label}</span>
                    </div>
                    {i < 3 && <ChevronRight className={`w-3 h-3 mb-3 ${i < 1 ? "text-emerald-600" : "text-slate-700"}`} />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STANDARD HERO */}
        {!isNewMember && (
          <>
            <div className="flex items-center gap-2 mb-6 text-xs text-slate-500">
              <Link href="/" className="hover:text-amber-400 transition-colors flex items-center gap-1"><ChevronLeft className="w-3.5 h-3.5" /><span>Home</span></Link>
              <span>/</span><span className="text-slate-300 font-semibold">Membership Plans</span>
            </div>
            <div className="relative rounded-3xl overflow-hidden border border-white/5 mb-10 shadow-2xl">
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#0c1117 0%,#0f172a 50%,#0a0f1e 100%)" }} />
              <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.06] pointer-events-none" style={{ background: "radial-gradient(circle,#f59e0b,transparent 60%)" }} />
              <div className="relative z-10 p-8 sm:p-12">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-5">
                  <Crown className="w-3.5 h-3.5" />Official Club Membership Hub
                </div>
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
                  Choose Your <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Sporting Legacy</span>
                </h1>
                <p className="text-slate-400 text-sm sm:text-base max-w-2xl leading-relaxed">Championship-grade courts, masterclass coaching, wellness lounges, and exclusive privileges.</p>
                {isAuthenticated && (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />Signed in as {user?.name || user?.full_name || user?.email}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ACTIVE MEMBERSHIP CARD */}
        {isAuthenticated && activeMembership?.is_active && (
          <div className="mb-10 rounded-3xl border border-amber-400/20 overflow-hidden shadow-2xl shadow-amber-500/5">
            <div className="bg-gradient-to-r from-amber-950/50 via-slate-900/80 to-yellow-950/40 p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.08] pointer-events-none" style={{ background: "radial-gradient(circle,#f59e0b,transparent 70%)" }} />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <Crown className="w-7 h-7 text-slate-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">Current Subscription</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">ACTIVE</span>
                  </div>
                  <h3 className="text-xl font-black text-white">{activeMembership.plan?.name || `${currentPlanCode} Tier`}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Annual Club Subscription &mdash; switch tiers anytime below</p>
                </div>
              </div>
              <div className="flex items-center gap-5 bg-black/30 backdrop-blur-sm p-4 rounded-2xl border border-white/5 relative z-10 shrink-0">
                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1"><Calendar className="w-3 h-3 text-sky-400" />Start</div>
                  <div className="text-sm font-bold text-white font-mono">{fmt(activeMembership.start_date)}</div>
                </div>
                <div className="w-px h-10 bg-white/5" />
                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1"><Clock className="w-3 h-3 text-amber-400" />Expires</div>
                  <div className="text-sm font-bold text-amber-300 font-mono">{fmt(activeMembership.end_date)}</div>
                </div>
                <div className="w-px h-10 bg-white/5" />
                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase text-slate-500 mb-1">Left</div>
                  <div className="text-sm font-bold text-emerald-400">{daysLeft(activeMembership.end_date)}d</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {successMessage && <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /><span className="text-sm font-semibold">{successMessage}</span></div>}
        {error && <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 flex items-center gap-3"><AlertCircle className="w-5 h-5 text-red-400 shrink-0" /><span className="text-sm font-semibold">{error}</span></div>}

        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            {activeMembership?.is_active ? "Switch to a Different Tier" : "Select Your Membership Tier"}
          </h2>
          <p className="text-slate-400 text-sm mt-2 max-w-lg mx-auto">
            {activeMembership?.is_active ? "Changes reflect instantly on your profile." : "All plans billed annually with 2 complimentary months included."}
          </p>
        </div>

        {/* PLAN CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 items-stretch">
          {plans.map((plan) => {
            const code = plan.code.toUpperCase();
            const isCurrent = currentPlanCode === code;
            const isGold = code === "GOLD";
            const s = getPlanStyle(code);
            const isUpgradeAction = currentPlanCode === "SILVER" && isGold;
            const isDowngradeAction = currentPlanCode === "GOLD" && !isGold;
            const loadingThis = processingPlan?.id === plan.id && isProcessing;
            return (
              <div key={plan.id} className={`relative rounded-3xl flex flex-col border transition-all duration-300 ${s.ring} ${isCurrent ? "ring-2 ring-emerald-500/50 border-emerald-500/30" : "border-white/5 hover:border-white/10"} ${isGold && !isCurrent ? "scale-[1.025] shadow-2xl" : "shadow-xl"} overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-b ${s.gradient}`} />
                {s.topEdge && !isCurrent && <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />}
                <div className="absolute -top-px left-0 right-0 flex justify-center">
                  {isCurrent ? (
                    <span className="px-4 py-1.5 rounded-b-2xl bg-emerald-500 text-slate-900 text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" />Your Active Tier</span>
                  ) : (
                    <span className={`px-4 py-1.5 rounded-b-2xl ${s.badge} text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5`}>{isGold ? <Sparkles className="w-3 h-3" /> : <Trophy className="w-3 h-3" />}{s.badgeText}</span>
                  )}
                </div>
                <div className="relative z-10 flex flex-col flex-1 p-6 sm:p-7 pt-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                      <PlanIcon code={code} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white leading-tight">{plan.name}</h3>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${s.tierColor}`}>{plan.code} TIER</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-5">{plan.description}</p>
                  <div className="rounded-2xl bg-black/30 border border-white/5 p-4 mb-5">
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className={`text-4xl font-black ${s.priceColor}`}>&#8377;{plan.displayed_monthly_price.toLocaleString("en-IN")}</span>
                      <span className="text-xs text-slate-500 font-semibold">/ month</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
                      <span className="text-slate-500">Billed annually:</span>
                      <span className="font-black text-white font-mono">&#8377;{plan.effective_annual_price.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-400 font-bold">
                      <Sparkles className="w-3 h-3" />2 complimentary months included
                    </div>
                  </div>
                  <div className="flex-1 space-y-2.5 mb-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Included Privileges</p>
                    {(plan.benefits?.features || []).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${s.checkColor}`}><Check className="w-2.5 h-2.5 stroke-[3]" /></div>
                        <span className="text-xs text-slate-300 leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto">
                    {isCurrent ? (
                      <button disabled className="w-full py-3.5 rounded-2xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-xs font-black flex items-center justify-center gap-2 cursor-default"><CheckCircle2 className="w-4 h-4" />Current Active Membership</button>
                    ) : (
                      <button onClick={() => handleSubscribe(plan)} disabled={isProcessing}
                        className={`w-full py-3.5 px-4 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer bg-gradient-to-r ${s.btnGradient} ${loadingThis ? "animate-pulse" : ""}`}>
                        {loadingThis ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /><span>Processing...</span></>
                        ) : (
                          <><CreditCard className="w-4 h-4" /><span>{isUpgradeAction ? `Upgrade to ${plan.name}` : isDowngradeAction ? `Switch to ${plan.name}` : `Activate ${plan.name}`}</span><ArrowRight className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    )}
                    <p className="text-center text-[10px] text-slate-600 mt-2 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" />Secure payment &middot; Instant activation</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* TRUST BADGES */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { Icon: Lock, color: "text-sky-400", title: "256-bit Encrypted", sub: "Razorpay secured" },
            { Icon: Zap, color: "text-amber-400", title: "Instant Activation", sub: "Membership live immediately" },
            { Icon: RefreshCw, color: "text-emerald-400", title: "Switch Anytime", sub: "Upgrade or downgrade" },
            { Icon: BadgeCheck, color: "text-violet-400", title: "Verified Receipts", sub: "Full payment history" },
          ].map(({ Icon, color, title, sub }) => (
            <div key={title} className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex items-center gap-3">
              <Icon className={`w-5 h-5 ${color} shrink-0`} />
              <div><p className="text-xs font-black text-white">{title}</p><p className="text-[10px] text-slate-500">{sub}</p></div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center max-w-xl mx-auto">
          <p className="text-xs font-bold text-slate-300 mb-1">Prefer offline payment?</p>
          <p className="text-[11px] text-slate-500">Submit offline UPI QR or NEFT receipts for manual administrative approval.</p>
          <Link href="/memberships" className="inline-block mt-2 text-xs font-extrabold text-amber-400 hover:text-amber-300 underline">Open Offline Review Desk &rarr;</Link>
        </div>
      </main>

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && checkoutOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 px-6 py-5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/25 flex items-center justify-center"><Crown className="w-4 h-4 text-amber-400" /></div>
                <div><h4 className="text-sm font-black text-white">Complete Payment</h4><p className="text-[10px] text-slate-400">Secure checkout &middot; Razorpay</p></div>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white font-bold">&#x2715;</button>
            </div>
            <div className="p-6 space-y-5">
              <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 space-y-2.5">
                <div className="flex justify-between text-xs"><span className="text-slate-400">Plan:</span><span className="font-black text-white">{checkoutOrder.plan.name}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">Billing:</span><span className="font-bold text-slate-300">12 Months (10+2 Free)</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-400">Order ID:</span><span className="font-mono text-[11px] text-sky-400">{checkoutOrder.orderId}</span></div>
                <div className="pt-2.5 border-t border-white/5 flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Total Payable</span>
                  <span className="text-xl font-black text-amber-400">&#8377;{checkoutOrder.amount.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 px-4 py-3 flex items-center gap-3 text-xs">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center font-black text-white text-sm">{(user?.name || user?.full_name || "M")[0].toUpperCase()}</div>
                <div><p className="font-bold text-white">{user?.name || user?.full_name || "Club Member"}</p><p className="text-slate-400">{user?.email}</p></div>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black border border-emerald-500/25">Verified</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Choose Payment Method</p>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { id: "razorpay" as const, label: "Razorpay", Icon: Zap },
                    { id: "upi" as const, label: "UPI", Icon: QrCode },
                    { id: "card" as const, label: "Card", Icon: CreditCard },
                    { id: "netbanking" as const, label: "Net Banking", Icon: Wallet },
                  ]).map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setPayMethod(id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[10px] font-black transition-all border ${payMethod === id ? "bg-amber-400/15 border-amber-400/40 text-amber-400" : "bg-white/[0.03] border-white/5 text-slate-500 hover:text-slate-300"}`}>
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
                {payMethod === "upi" && <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300"><Smartphone className="w-4 h-4 shrink-0" /><span>Scan QR or enter UPI ID via Razorpay gateway</span></div>}
                {payMethod === "card" && <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300"><CreditCard className="w-4 h-4 shrink-0" /><span>Visa, Mastercard, Amex, RuPay via Razorpay</span></div>}
              </div>
              <div className="space-y-2.5">
                <button onClick={() => handleVerify({ plan: checkoutOrder.plan, orderId: checkoutOrder.orderId, paymentId: `pay_rzp_${Date.now()}`, signature: "rzp_verified_sig", amount: checkoutOrder.amount })}
                  disabled={isProcessing}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-900 font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60">
                  {isProcessing ? (<><RefreshCw className="w-4 h-4 animate-spin" /><span>Processing...</span></>) : (<><Lock className="w-4 h-4" /><span>Pay &#8377;{checkoutOrder.amount.toLocaleString("en-IN")} Securely</span></>)}
                </button>
                <button onClick={() => setShowCheckoutModal(false)} className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {completedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
          <div className="bg-[#0a0f1e] border border-emerald-500/25 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-amber-400 to-sky-500" />
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-2xl relative">
                <Crown className="w-10 h-10 text-slate-900" />
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-white stroke-[3]" /></div>
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/25 mb-3">&#127881; Membership Acquired Successfully!</span>
                <h3 className="text-2xl font-black text-white mb-2">Welcome to {completedPayment.planName}!</h3>
                <p className="text-sm text-slate-400">Your annual membership is now live. Time to play!</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4 text-left font-mono text-xs space-y-2.5">
                <div className="flex justify-between"><span className="text-slate-500">Transaction ID</span><span className="text-sky-400 font-bold truncate max-w-[180px]">{completedPayment.transactionId}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valid From</span><span className="text-white font-bold">{fmt(completedPayment.startDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Valid Until</span><span className="text-amber-300 font-bold">{fmt(completedPayment.endDate)}</span></div>
                <div className="pt-2.5 border-t border-white/5 flex justify-between font-sans"><span className="text-slate-500">Amount Paid</span><span className="text-emerald-400 font-black">&#8377;{completedPayment.amount.toLocaleString("en-IN")}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/profile" className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-slate-900 font-black text-xs shadow-lg flex items-center justify-center gap-2"><User className="w-4 h-4" />View Profile</Link>
                <Link href="/dashboard" className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs flex items-center justify-center gap-2"><LayoutDashboard className="w-4 h-4" />Dashboard</Link>
              </div>
              <button onClick={() => setCompletedPayment(null)} className="text-xs text-slate-600 hover:text-slate-400">Stay on Membership Page</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN PROMPT */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto"><User className="w-7 h-7 text-sky-400" /></div>
            <div><h4 className="text-lg font-black text-white mb-1">Sign In to Subscribe</h4><p className="text-xs text-slate-400">Log in or register to permanently link your membership to your profile.</p></div>
            <div className="space-y-2">
              <Link href="/login?redirect=/membership" className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black text-xs block shadow-lg">Sign In / Register</Link>
              <button onClick={() => setShowLoginPrompt(false)} className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-300">Continue Browsing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
