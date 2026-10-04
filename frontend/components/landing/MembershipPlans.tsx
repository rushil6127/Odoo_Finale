"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Check, 
  Crown, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Star, 
  ArrowRight,
  HelpCircle
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  tierColor: string;
  badge: string;
  benefits: string[];
  features: { name: string; included: boolean }[];
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "silver",
    name: "Silver Tier",
    tagline: "Ideal for club enthusiasts and regular recreational players.",
    monthlyPrice: 3499,
    annualPrice: 2799,
    tierColor: "from-slate-700 to-slate-900",
    badge: "Club Essential",
    benefits: [
      "Access to all 14 Hard & Clay Tennis courts (Off-Peak & Standard)",
      "Standard 3-day advance court reservation window",
      "10% Member discount across Pro Shop equipment & apparel",
      "Friday Social-Play mixer pass & round-robin ladder entry",
      "Access to Olympic swimming pool & clubhouse lounge",
      "Digital member card & unified charging tab",
    ],
    features: [
      { name: "Max 2 court bookings / day", included: true },
      { name: "Off-peak clay & hard courts", included: true },
      { name: "10% Pro Shop discount", included: true },
      { name: "Cafeteria charge account", included: true },
      { name: "Peak-hour priority slots", included: false },
      { name: "Wimbledon grass court complimentary", included: false },
      { name: "1-on-1 coaching clinic included", included: false },
      { name: "VIP Locker suite & spa access", included: false },
    ],
  },
  {
    id: "gold",
    name: "Gold Champion",
    tagline: "The ultimate sports lifestyle with VIP court priority & coaching.",
    monthlyPrice: 5999,
    annualPrice: 4799,
    popular: true,
    tierColor: "from-sky-500 via-blue-600 to-sky-700",
    badge: "Most Popular",
    benefits: [
      "Unlimited priority access to all 22+ courts including Grass Lawns",
      "7-Day advance peak-hour slot reservation window",
      "20% Member discount on Pro Shop apparel, strings & gear",
      "2x Monthly complimentary private coaching sessions with pro coaches",
      "4 Free monthly guest passes with full clubhouse & pool privileges",
      "Executive locker suite, steam, sauna, and hot jacuzzi access",
      "VIP priority table reservations at the Champions Lounge & Bar",
    ],
    features: [
      { name: "Max 2 court bookings / day", included: true },
      { name: "Off-peak clay & hard courts", included: true },
      { name: "20% Pro Shop discount", included: true },
      { name: "Cafeteria charge account", included: true },
      { name: "Peak-hour priority slots", included: true },
      { name: "Wimbledon grass court complimentary", included: true },
      { name: "1-on-1 coaching clinic included", included: true },
      { name: "VIP Locker suite & spa access", included: true },
    ],
  },
  {
    id: "junior",
    name: "Junior Academy",
    tagline: "Tailored for aspiring youth athletes (Under 18) to build champions.",
    monthlyPrice: 2499,
    annualPrice: 1999,
    tierColor: "from-emerald-600 to-teal-800",
    badge: "Ages 6-18",
    benefits: [
      "Dedicated afternoon and weekend youth training court allocation",
      "4x Monthly structured group academy clinics with certified coaches",
      "15% Discount on junior junior racket stringing, balls & footwear",
      "Junior tournament & ranking ladder participation",
      "Olympic pool swim safety & stroke training sessions",
      "Comprehensive athletic progress and fitness tracking",
    ],
    features: [
      { name: "Max 2 court bookings / day", included: true },
      { name: "Off-peak clay & hard courts", included: true },
      { name: "15% Junior gear discount", included: true },
      { name: "Cafeteria charge account", included: false },
      { name: "Peak-hour priority slots", included: false },
      { name: "Wimbledon grass court complimentary", included: false },
      { name: "Junior group coaching clinics", included: true },
      { name: "VIP Locker suite & spa access", included: false },
    ],
  },
];

function mapLivePlans(livePlans: any[], basePlans: Plan[] = DEFAULT_PLANS): Plan[] {
  if (!livePlans || !livePlans.length) return basePlans;
  return basePlans.map((staticPlan) => {
    const livePlan = livePlans.find(
      (p: any) => p.code?.toLowerCase() === staticPlan.id.toLowerCase()
    );
    if (!livePlan) return staticPlan;

    const monthlyFee = Number(livePlan.displayed_monthly_price);
    const liveFeatures = livePlan.benefits?.features || [];

    return {
      ...staticPlan,
      name: livePlan.name || staticPlan.name,
      annualPrice: monthlyFee,
      monthlyPrice: Math.round(monthlyFee * 1.25),
      benefits: liveFeatures.length > 0 ? liveFeatures : staticPlan.benefits,
    };
  });
}

interface MembershipPlansProps {
  initialPlans?: any[] | null;
}

export default function MembershipPlans({ initialPlans }: MembershipPlansProps) {
  const [isAnnual, setIsAnnual] = useState(true);
  const [plansList, setPlansList] = useState<Plan[]>(() =>
    initialPlans && initialPlans.length > 0 ? mapLivePlans(initialPlans) : DEFAULT_PLANS
  );

  useEffect(() => {
    let isMounted = true;
    async function fetchLivePlans() {
      try {
        const data = await apiClient.get<{ plans: any[] }>("/membership-plans");
        if (data?.plans?.length && isMounted) {
          setPlansList(mapLivePlans(data.plans));
        }
      } catch {
        // Fallback gracefully to default plans
      }
    }
    fetchLivePlans();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section id="memberships" className="py-20 bg-slate-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-lime-100 text-lime-800 text-xs font-bold uppercase tracking-wider mb-3 border border-lime-300">
            <Crown className="w-3.5 h-3.5 text-lime-700" />
            <span>Exclusive Club Memberships</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Elevate Your Sporting Journey
          </h2>
          <p className="text-slate-600 text-base mt-3 leading-relaxed">
            Choose the membership tier tailored to your ambitions. Enjoy seamless court bookings, pro shop discounts, cafeteria tabs, and social tournaments.
          </p>

          {/* Billing Interval Switch */}
          <div className="inline-flex items-center gap-3 bg-white p-1.5 rounded-full border border-slate-200 shadow-sm mt-8">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                !isAnnual ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                isAnnual ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>Annual Plan</span>
              <span className="bg-[#CCFF00] text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plansList.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-7 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular
                    ? "bg-white border-2 border-sky-500 shadow-2xl shadow-sky-500/15 scale-100 lg:-translate-y-2"
                    : "bg-white/80 border border-slate-200 shadow-lg hover:shadow-xl"
                }`}
              >
                {/* Popular Highlight Ribbon */}
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md flex items-center gap-1 border border-white">
                    <Star className="w-3 h-3 fill-white" />
                    <span>Most Popular</span>
                  </div>
                )}

                <div>
                  {/* Top Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {plan.name}
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {plan.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    {plan.tagline}
                  </p>

                  {/* Pricing Display */}
                  <div className="pb-6 mb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">
                        ₹{price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        / month {isAnnual ? "(billed annually)" : ""}
                      </span>
                    </div>
                    {isAnnual && (
                      <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold mt-1">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Includes 2 months complimentary</span>
                      </p>
                    )}
                  </div>

                  {/* Benefits List */}
                  <div className="space-y-3 mb-8">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Included Privileges:
                    </div>
                    {plan.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <div className="w-4 h-4 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="leading-snug">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Action CTA */}
                <div>
                  <Link
                    href="/membership"
                    className={`w-full py-3.5 px-6 rounded-2xl text-xs font-bold text-center transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
                      plan.popular
                        ? "bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-sky-500/25"
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    <span>Subscribe to {plan.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-center text-[10px] text-slate-400 mt-2">
                    Instant activation via Razorpay Online Gateway
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
