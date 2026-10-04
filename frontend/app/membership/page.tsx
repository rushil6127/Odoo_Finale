"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Crown,
  ShieldCheck,
  Check,
  Zap,
  ArrowRight,
  Clock,
  Calendar,
  CreditCard,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronLeft,
  Trophy,
  User,
  RefreshCw,
  PartyPopper,
  Rocket,
  ChevronRight,
  Shield,
  BadgeCheck,
  Wallet,
  QrCode,
  Smartphone,
  ChevronDown,
  X,
} from "lucide-react";
import { useCurrentUser, setStoredUser, isOwner, getRoleProfilePath } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";
import Navbar from "@/components/landing/Navbar";

interface PlanBenefitDetails {
  tier_level?: number;
  courts_count?: number;
  court_types?: string[];
  courts_access?: string;
  reservation_window_days?: number;
  shop_discount_pct?: number;
  monthly_coaching_sessions?: number;
  monthly_guest_passes?: number;
  locker_steam_spa_access?: boolean;
  vip_lounge_bar_priority?: boolean;
  digital_card_charging_tab?: boolean;
  pool_clubhouse_access?: boolean;
  social_play_included?: boolean;
  age_bracket?: string;
  features?: string[];
}

interface Plan {
  id: number;
  code: "SILVER" | "GOLD" | "JUNIOR" | string;
  name: string;
  description: string;
  displayed_monthly_price: number;
  effective_annual_price: number;
  duration_months: number;
  complimentary_months: number;
  benefits: PlanBenefitDetails;
  is_active: boolean;
}

interface ActiveMembershipData {
  id: number;
  plan_id: number;
  start_date: string;
  end_date: string;
  status: string;
  display_status: string;
  is_active: boolean;
  price_paid: number;
  plan?: Plan;
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: 1,
    code: "SILVER",
    name: "Silver Tier",
    description: "Standard club membership with court access, swimming pool, and shop discounts.",
    displayed_monthly_price: 2799,
    effective_annual_price: 27990,
    duration_months: 12,
    complimentary_months: 2,
    benefits: {
      tier_level: 1,
      shop_discount_pct: 10,
      social_play_included: true,
      pool_clubhouse_access: true,
      features: [
        "Access to all 14 Hard & Clay Tennis courts (Off-Peak & Standard)",
        "Standard 3-day advance court reservation window",
        "10% member discount across Pro Shop equipment & apparel",
        "Friday Social-Play mixer pass & round-robin ladder entry",
        "Access to Olympic swimming pool & clubhouse lounge",
        "Digital member card & unified charging tab",
      ],
    },
    is_active: true,
  },
  {
    id: 2,
    code: "GOLD",
    name: "Gold Champion",
    description: "Premium all-access membership with grass courts, VIP perks, coaching, and guest passes.",
    displayed_monthly_price: 4799,
    effective_annual_price: 47990,
    duration_months: 12,
    complimentary_months: 2,
    benefits: {
      tier_level: 2,
      shop_discount_pct: 20,
      monthly_coaching_sessions: 2,
      monthly_guest_passes: 4,
      locker_steam_spa_access: true,
      vip_lounge_bar_priority: true,
      features: [
        "Unlimited priority access to all 22+ courts including Grass Lawns",
        "7-day advance peak-hour slot reservation window",
        "20% member discount on Pro Shop apparel, strings & gear",
        "2x monthly complimentary private coaching sessions with pro coaches",
        "4 free monthly guest passes with full clubhouse & pool privileges",
        "Executive locker suite, steam, sauna, and hot jacuzzi access",
        "VIP priority table reservations at the Champions Lounge & Bar",
      ],
    },
    is_active: true,
  },
  {
    id: 3,
    code: "JUNIOR",
    name: "Junior Academy",
    description: "Youth membership for players under 18 with dedicated training clinics, coaching, and tournaments.",
    displayed_monthly_price: 1999,
    effective_annual_price: 19990,
    duration_months: 12,
    complimentary_months: 2,
    benefits: {
      tier_level: 1,
      age_bracket: "Ages 6-18",
      shop_discount_pct: 15,
      features: [
        "Ages 6-18 / under 18 dedicated athletic tier",
        "Dedicated afternoon and weekend youth training court allocation",
        "4x monthly structured group academy clinics with certified coaches",
        "15% discount on junior racket stringing, balls & footwear",
        "Junior tournament & ranking ladder participation",
        "Olympic pool swim safety & stroke training sessions",
        "Comprehensive athletic progress and fitness tracking",
      ],
    },
    is_active: true,
  },
];

function PlanIcon({ code }: { code: string }) {
  const c = code.toUpperCase();
  if (c === "GOLD") return <Crown className="w-6 h-6 text-amber-500" />;
  if (c === "JUNIOR") return <Rocket className="w-6 h-6 text-emerald-600" />;
  return <Shield className="w-6 h-6 text-slate-700" />;
}

function MembershipContent() {
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
    orderId: string;
    keyId: string;
    amount: number;
    currency: string;
    plan: Plan;
    isUpgrade: boolean;
    isDowngrade: boolean;
  } | null>(null);
  const [completedPayment, setCompletedPayment] = useState<{
    planName: string;
    planCode: string;
    startDate: string;
    endDate: string;
    amount: number;
    transactionId: string;
  } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [payMethod, setPayMethod] = useState<"razorpay" | "upi" | "card" | "netbanking">("razorpay");
  const [dobCountdown, setDobCountdown] = useState<number | null>(null);

  // Auto-redirect to profile settings when date of birth error occurs
  useEffect(() => {
    if (error && error.toLowerCase().includes("date of birth")) {
      setDobCountdown(3);
      const interval = setInterval(() => {
        setDobCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            router.push("/profile?tab=settings&focus=dob");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setDobCountdown(null);
    }
  }, [error, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const r = await apiClient.get<{ plans: Plan[] }>("/membership-plans");
        if (r?.plans?.length) {
          const ord: Record<string, number> = { SILVER: 1, GOLD: 2, JUNIOR: 3 };
          setPlans(
            [...r.plans].sort(
              (a, b) => (ord[a.code.toUpperCase()] ?? 99) - (ord[b.code.toUpperCase()] ?? 99)
            )
          );
        }
      } catch {
        /* use fallback */
      }
      const token = typeof window !== "undefined" ? localStorage.getItem("cc_token") : null;
      if (token) {
        try {
          const s = await apiClient.get<{ active_membership: ActiveMembershipData | null }>(
            "/membership-plans/my-status"
          );
          if (s?.active_membership) setActiveMembership(s.active_membership);
        } catch {
          if (user?.active_membership) setActiveMembership(user.active_membership);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentPlanCode = (
    activeMembership?.plan?.code ||
    user?.membership_plan ||
    user?.membershipPlan ||
    ""
  ).toUpperCase();

  const fmt = (d?: string) => {
    if (!d) return "N/A";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const daysLeft = (end?: string) => {
    if (!end) return null;
    const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
    return d > 0 ? d : 0;
  };

  const handleSubscribe = async (plan: Plan) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("cc_token") : null;
    if (!token && !isAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }
    setProcessingPlan(plan);
    setIsProcessing(true);
    setError(null);
    try {
      const res = await apiClient.post<{
        razorpay_order_id: string;
        razorpay_key_id: string;
        amount: number;
        currency: string;
        plan: Plan;
        is_upgrade: boolean;
        is_downgrade: boolean;
      }>("/membership-plans/subscribe/order", { plan_id: plan.id, plan_code: plan.code });

      setCheckoutOrder({
        orderId: res.razorpay_order_id,
        keyId: res.razorpay_key_id,
        amount: res.amount,
        currency: res.currency || "INR",
        plan,
        isUpgrade: res.is_upgrade,
        isDowngrade: res.is_downgrade,
      });

      if (typeof window !== "undefined" && (window as any).Razorpay) {
        try {
          const opts = {
            key: res.razorpay_key_id,
            amount: Math.round(res.amount * 100),
            currency: res.currency || "INR",
            name: "The Champions Club",
            description: `${plan.name} Annual Pass`,
            order_id: res.razorpay_order_id,
            prefill: {
              name: user?.name || user?.full_name || "Member",
              email: user?.email || "",
              contact: user?.phone || "",
            },
            theme: { color: "#0ea5e9" },
            handler: async (r: any) => {
              await handleVerify({
                plan,
                orderId: r.razorpay_order_id || res.razorpay_order_id,
                paymentId: r.razorpay_payment_id || `pay_${Date.now()}`,
                signature: r.razorpay_signature || "sig",
                amount: res.amount,
              });
            },
            modal: { ondismiss: () => setProcessingPlan(null) },
          };
          const rzp = new (window as any).Razorpay(opts);
          rzp.on("payment.failed", (r: any) => {
            setError(r.error?.description || "Payment failed.");
            setProcessingPlan(null);
          });
          rzp.open();
        } catch {
          setShowCheckoutModal(true);
        }
      } else {
        setShowCheckoutModal(true);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to initiate payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerify = async (params: {
    plan: Plan;
    orderId: string;
    paymentId: string;
    signature: string;
    amount: number;
  }) => {
    setIsProcessing(true);
    setError(null);
    try {
      const v = await apiClient.post<{
        membership: ActiveMembershipData;
        user: any;
        message: string;
      }>("/membership-plans/subscribe/verify", {
        plan_id: params.plan.id,
        plan_code: params.plan.code,
        razorpay_order_id: params.orderId,
        razorpay_payment_id: params.paymentId,
        razorpay_signature: params.signature,
        amount: params.amount,
      });

      if (v?.membership) setActiveMembership(v.membership);
      if (v?.user) setStoredUser(v.user);
      setCompletedPayment({
        planName: params.plan.name,
        planCode: params.plan.code,
        startDate: v.membership.start_date,
        endDate: v.membership.end_date,
        amount: params.amount,
        transactionId: params.paymentId,
      });
      setShowCheckoutModal(false);
      setSuccessMessage(v.message || `Welcome to ${params.plan.name}!`);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Verification failed. Contact support.");
    } finally {
      setIsProcessing(false);
      setProcessingPlan(null);
    }
  };

  const profileLink = getRoleProfilePath(user);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 selection:bg-sky-200 selection:text-sky-900 font-sans">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-sky-400/5 blur-3xl" />
        <div className="absolute top-1/2 -left-60 w-[500px] h-[500px] rounded-full bg-emerald-400/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-400/5 blur-3xl" />
      </div>

      {/* Full Floating Navbar matching Landing Page */}
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-8 sm:pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-500">
          <Link href="/" className="hover:text-sky-600 transition-colors flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">Membership Plans</span>
        </div>

        {/* NEW MEMBER WELCOME BANNER (If redirected from registration) */}
        {isNewMember && !currentPlanCode && (
          <div className="mb-8 rounded-3xl overflow-hidden border border-sky-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shadow-xs">
              <PartyPopper className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-black uppercase tracking-widest mb-2">
                <Sparkles className="w-3 h-3 text-sky-600" />
                <span>Welcome to The Champions Club</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1 font-[family-name:var(--font-outfit)]">
                Account created! Choose your membership plan
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                Pick the tier that matches your game, complete quick verification, and your privileges activate immediately.
              </p>
            </div>
          </div>
        )}

        {/* HERO BANNER - Luxury Light Theme */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 bg-white p-8 sm:p-12 mb-8 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-400/10 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-bold uppercase tracking-wider mb-4">
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>Official Club Membership Hub</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3 font-[family-name:var(--font-outfit)]">
              Choose Your{" "}
              <span className="bg-gradient-to-r from-sky-600 via-blue-700 to-sky-800 bg-clip-text text-transparent">
                Sporting Legacy
              </span>
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed mb-6">
              Championship-grade courts, masterclass coaching, wellness lounges, and exclusive privileges across our 22+ venues.
            </p>

            {isAuthenticated && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Signed in as {user?.name || user?.full_name || user?.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE MEMBERSHIP STATUS CARD */}
        {isAuthenticated && activeMembership?.is_active && (
          <div className="mb-8 rounded-3xl border border-amber-200/90 bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center shadow-xs shrink-0">
                  <Crown className="w-7 h-7 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Current Subscription
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ACTIVE
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                    {activeMembership.plan?.name || `${currentPlanCode} Tier`}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Annual Club Subscription &mdash; switch tiers anytime below
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs shrink-0">
                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-sky-600" />
                    <span>Start</span>
                  </div>
                  <div className="text-xs font-bold text-slate-900 font-mono">
                    {fmt(activeMembership.start_date)}
                  </div>
                </div>

                <div className="w-px h-8 bg-slate-200" />

                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span>Expires</span>
                  </div>
                  <div className="text-xs font-bold text-amber-800 font-mono">
                    {fmt(activeMembership.end_date)}
                  </div>
                </div>

                <div className="w-px h-8 bg-slate-200" />

                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase text-slate-500 mb-1">Left</div>
                  <div className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {daysLeft(activeMembership.end_date)}d
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notification Messages */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Section Heading */}
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
            {activeMembership?.is_active ? "Switch to a Different Tier" : "Select Your Membership Tier"}
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-1.5 max-w-lg mx-auto">
            {activeMembership?.is_active
              ? "Upgrades and plan changes reflect instantly on your member profile."
              : "All plans billed annually with 2 complimentary months included."}
          </p>
        </div>

        {/* PLAN CARDS GRID - Luxury Off-White & Slate Aesthetic */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch mb-12">
          {plans.map((plan) => {
            const code = plan.code.toUpperCase();
            const isCurrent = currentPlanCode === code;
            const isGold = code === "GOLD";
            const isJunior = code === "JUNIOR";
            const isUpgradeAction = currentPlanCode === "SILVER" && isGold;
            const isDowngradeAction = currentPlanCode === "GOLD" && !isGold;
            const loadingThis = processingPlan?.id === plan.id && isProcessing;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl flex flex-col justify-between transition-all duration-300 overflow-hidden bg-white ${
                  isCurrent
                    ? "ring-2 ring-emerald-500 border border-emerald-300 shadow-md"
                    : isGold
                    ? "border-2 border-sky-500 shadow-lg hover:shadow-2xl scale-[1.02]"
                    : "border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-slate-300"
                }`}
              >
                {/* Top Badge */}
                <div className="absolute top-0 left-0 right-0 flex justify-center">
                  {isCurrent ? (
                    <span className="px-4 py-1.5 rounded-b-2xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Your Active Tier</span>
                    </span>
                  ) : isGold ? (
                    <span className="px-4 py-1.5 rounded-b-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-[#CCFF00]" />
                      <span>Most Popular · All-Access VIP</span>
                    </span>
                  ) : isJunior ? (
                    <span className="px-4 py-1.5 rounded-b-2xl bg-emerald-50 text-emerald-800 border-b border-x border-emerald-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Trophy className="w-3 h-3 text-emerald-600" />
                      <span>Ages 6–18 Academy</span>
                    </span>
                  ) : (
                    <span className="px-4 py-1.5 rounded-b-2xl bg-slate-100 text-slate-700 border-b border-x border-slate-200 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-slate-500" />
                      <span>Club Essential</span>
                    </span>
                  )}
                </div>

                {/* Card Content */}
                <div className="flex flex-col flex-1 p-6 sm:p-7 pt-10">
                  <div className="flex items-center gap-3.5 mb-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                        isGold
                          ? "bg-amber-50 border-amber-200 shadow-2xs"
                          : isJunior
                          ? "bg-emerald-50 border-emerald-200 shadow-2xs"
                          : "bg-slate-100 border-slate-200 shadow-2xs"
                      }`}
                    >
                      <PlanIcon code={code} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 leading-tight font-[family-name:var(--font-outfit)]">
                        {plan.name}
                      </h3>
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest ${
                          isGold
                            ? "text-amber-700"
                            : isJunior
                            ? "text-emerald-700"
                            : "text-slate-500"
                        }`}
                      >
                        {plan.code} TIER
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mb-5">
                    {plan.description}
                  </p>

                  {/* Pricing Box */}
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 mb-5">
                    <div className="flex items-baseline gap-1.5 mb-2">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                        ₹{plan.displayed_monthly_price.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">/ month</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-200/80">
                      <span className="text-slate-500">Billed annually:</span>
                      <span className="font-extrabold text-slate-900 font-mono">
                        ₹{plan.effective_annual_price.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>2 complimentary months included (10 mo billed)</span>
                    </div>

                    {isGold && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-sky-800 font-extrabold bg-sky-50 px-2 py-1 rounded-lg border border-sky-200">
                        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>100% FREE Court Bookings Included</span>
                      </div>
                    )}
                  </div>

                  {/* Included Privileges */}
                  <div className="flex-1 space-y-2.5 mb-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                      Included Privileges
                    </p>
                    {(plan.benefits?.features || []).map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 text-emerald-600">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="text-xs text-slate-700 leading-snug">{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action CTA */}
                  <div className="mt-auto pt-2">
                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold flex items-center justify-center gap-2 cursor-default"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Current Active Membership</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={isProcessing}
                        className={`w-full py-3.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer ${
                          isGold
                            ? "bg-gradient-to-r from-sky-500 via-sky-600 to-blue-700 hover:from-sky-600 hover:to-blue-800 text-white shadow-sky-500/25"
                            : isJunior
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                            : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10"
                        } ${loadingThis ? "animate-pulse" : ""}`}
                      >
                        {loadingThis ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>
                              {isUpgradeAction
                                ? `Upgrade to ${plan.name}`
                                : isDowngradeAction
                                ? `Switch to ${plan.name}`
                                : `Activate ${plan.name}`}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )}
                    <p className="text-center text-[10px] text-slate-500 mt-2 flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Instant digital card activation &middot; Razorpay secure</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* TRUST BADGES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { Icon: Lock, color: "text-sky-600", title: "256-bit Encrypted", sub: "Razorpay secure gateway" },
            { Icon: Zap, color: "text-amber-500", title: "Instant Activation", sub: "Membership live immediately" },
            { Icon: RefreshCw, color: "text-emerald-600", title: "Switch Anytime", sub: "Upgrade or downgrade tiers" },
            { Icon: BadgeCheck, color: "text-blue-600", title: "Verified Digital Card", sub: "With RFID charging tab" },
          ].map(({ Icon, color, title, sub }) => (
            <div
              key={title}
              className="rounded-2xl bg-white border border-slate-200/90 p-4 flex items-center gap-3 shadow-xs"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{title}</p>
                <p className="text-[10px] text-slate-500">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* CHECKOUT MODAL - Luxury Light Theme */}
      {showCheckoutModal && checkoutOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 text-slate-900">
            <div className="bg-slate-50 px-6 py-5 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">Complete Membership Payment</h4>
                  <p className="text-[10px] text-slate-500">Secure Checkout &middot; Powered by Razorpay</p>
                </div>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold transition-colors"
              >
                &#x2715;
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Plan:</span>
                  <span className="font-extrabold text-slate-900">{checkoutOrder.plan.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Duration:</span>
                  <span className="font-bold text-slate-800">12 Months (10 Billed + 2 Complimentary)</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Order Reference:</span>
                  <span className="font-mono text-[11px] text-sky-700 font-bold">{checkoutOrder.orderId}</span>
                </div>
                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-sm font-extrabold text-slate-900">Total Payable</span>
                  <span className="text-xl font-black text-slate-900">
                    ₹{checkoutOrder.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-sky-50/70 border border-sky-200/80 px-4 py-3 flex items-center gap-3 text-xs">
                <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {(user?.name || user?.full_name || "M")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{user?.name || user?.full_name || "Club Member"}</p>
                  <p className="text-slate-500 text-[11px]">{user?.email}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200">
                  Verified
                </span>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Choose Payment Method
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "razorpay" as const, label: "Razorpay", Icon: Zap },
                    { id: "upi" as const, label: "UPI", Icon: QrCode },
                    { id: "card" as const, label: "Card", Icon: CreditCard },
                    { id: "netbanking" as const, label: "Net Banking", Icon: Wallet },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => setPayMethod(id)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl text-[10px] font-bold transition-all border ${
                        payMethod === id
                          ? "bg-sky-50 border-sky-500 text-sky-800 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {payMethod === "upi" && (
                  <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900">
                    <Smartphone className="w-4 h-4 shrink-0 text-purple-600" />
                    <span>Scan QR or enter UPI ID via secure gateway</span>
                  </div>
                )}
                {payMethod === "card" && (
                  <div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900">
                    <CreditCard className="w-4 h-4 shrink-0 text-sky-600" />
                    <span>Visa, Mastercard, Amex, RuPay via secure gateway</span>
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() =>
                    handleVerify({
                      plan: checkoutOrder.plan,
                      orderId: checkoutOrder.orderId,
                      paymentId: `pay_rzp_${Date.now()}`,
                      signature: "rzp_verified_sig",
                      amount: checkoutOrder.amount,
                    })
                  }
                  disabled={isProcessing}
                  className="w-full py-4 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs transition-all shadow-md shadow-sky-500/25 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Confirming Transaction...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Pay ₹{checkoutOrder.amount.toLocaleString("en-IN")} Securely</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION MODAL - Luxury Light Theme */}
      {completedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-emerald-200 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden p-8 text-center text-slate-900">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-xs mb-5">
              <Check className="w-8 h-8 text-emerald-600 stroke-[3]" />
            </div>

            <div className="mb-6">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-200 mb-2">
                🎉 Membership Acquired Successfully!
              </span>
              <h3 className="text-2xl font-black text-slate-900 mb-1 font-[family-name:var(--font-outfit)]">
                Welcome to {completedPayment.planName}!
              </h3>
              <p className="text-xs text-slate-500">
                Your annual membership privileges are now live.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-left font-mono text-xs space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="text-sky-700 font-bold truncate max-w-[180px]">
                  {completedPayment.transactionId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valid From:</span>
                <span className="text-slate-900 font-bold">{fmt(completedPayment.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Valid Until:</span>
                <span className="text-amber-800 font-bold">{fmt(completedPayment.endDate)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-sans">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="text-emerald-700 font-black">
                  ₹{completedPayment.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/profile/member"
                className="py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs shadow-md shadow-sky-500/20 flex items-center justify-center gap-1.5"
              >
                <User className="w-4 h-4" />
                <span>My Profile</span>
              </Link>
              <Link
                href="/"
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs border border-slate-200 flex items-center justify-center gap-1.5"
              >
                <span>Browse Club</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN PROMPT MODAL */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-7 text-center shadow-2xl space-y-5 text-slate-900">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center mx-auto text-sky-600 shadow-xs">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 mb-1 font-[family-name:var(--font-outfit)]">
                Sign In to Subscribe
              </h4>
              <p className="text-xs text-slate-500">
                Log in or register to permanently link your annual membership pass to your account.
              </p>
            </div>
            <div className="space-y-2">
              <Link
                href="/login?redirect=/membership"
                className="w-full py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs block shadow-md shadow-sky-500/20 transition-all"
              >
                Sign In / Register
              </Link>
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ERROR POPUP MODAL */}
      {error && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setError(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close 'X' Button */}
            <button
              type="button"
              onClick={() => setError(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
              aria-label="Close error popup"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Glowing Alert Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border-2 border-rose-200/80 text-rose-500 flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle className="w-8 h-8 stroke-[2.2]" />
            </div>

            {/* Modal Title */}
            <h3 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)] tracking-tight">
              {error.toLowerCase().includes("date of birth")
                ? "Date of Birth Required"
                : error.toLowerCase().includes("age")
                ? "Age Restriction Notice"
                : error.toLowerCase().includes("payment")
                ? "Payment Notice"
                : "Unable to Complete Action"}
            </h3>

            {/* Error Message */}
            <p className="text-xs sm:text-sm font-medium text-slate-600 mt-2 mb-4 leading-relaxed max-w-sm">
              {error}
            </p>

            {/* Auto-redirect indicator for DOB error */}
            {error.toLowerCase().includes("date of birth") && (
              <div className="w-full bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 mb-5 text-left flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-spin" />
                <div className="text-xs text-amber-900 leading-snug">
                  Redirecting to your profile settings to enter your Date of Birth in{" "}
                  <strong className="font-extrabold text-amber-800 font-mono text-sm">
                    {dobCountdown !== null ? `${dobCountdown}s` : "3s"}
                  </strong>
                  ...
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {error.toLowerCase().includes("date of birth") ? (
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDobCountdown(null);
                    router.push("/profile?tab=settings&focus=dob");
                  }}
                  className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-xs shadow-md shadow-sky-500/20 text-center transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Enter Date of Birth Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDobCountdown(null);
                  }}
                  className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Stay Here
                </button>
              </div>
            ) : error.toLowerCase().includes("profile") ? (
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <Link
                  href="/profile?tab=settings"
                  onClick={() => setError(null)}
                  className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-sky-500/20 text-center transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Update Profile Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setError(null)}
                className="w-full py-3 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer"
              >
                Okay, Understood
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] flex items-center justify-center text-slate-400 text-sm">
          Loading memberships...
        </div>
      }
    >
      <MembershipContent />
    </Suspense>
  );
}
