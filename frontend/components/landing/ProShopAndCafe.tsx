"use client";

import Link from "next/link";
import { 
  ShoppingBag, 
  Coffee, 
  Sparkles, 
  ArrowRight,
  Zap,
  Activity,
  Tv,
  CheckCircle2
} from "lucide-react";

export default function ProShopAndCafe() {
  const shopPills = [
    { label: "Electronic 24h Stringing", icon: "⚡" },
    { label: "Tour Rackets & Balls", icon: "🎾" },
    { label: "Court-Specific Shoes", icon: "👟" },
    { label: "Reserve Online & Pick Up", icon: "📦" },
  ];

  const cafePills = [
    { label: "Recovery Whey Smoothies", icon: "🥤" },
    { label: "Artisan Specialty Coffee", icon: "☕" },
    { label: "High-Protein Bowls & Grill", icon: "🥗" },
    { label: "4K Grand Slam Live Theater", icon: "📺" },
  ];

  return (
    <section id="facilities" className="py-20 bg-slate-50/60 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-sky-200/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-lime-200/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Club Amenities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
            Pro Shop & Champions Lounge
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Tour-level gear and post-match athletic nutrition with seamless digital member account charging.
          </p>
        </div>

        {/* Minimalist Dual Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {/* Card 1: Pro Shop */}
          <div 
            id="shop" 
            className="group relative bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-lime-100 text-lime-900 text-xs font-extrabold border border-lime-300">
                  10% – 20% Member Discount
                </span>
              </div>

              {/* Title & Headline */}
              <div className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">
                Authorized Retail & Workshop
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-3 font-[family-name:var(--font-outfit)]">
                The Pro Shop
              </h3>
              <p className="text-sm text-slate-600 font-normal leading-relaxed mb-6">
                Official Head, Wilson, Babolat, and Nike equipment with certified same-day racket stringing and instant inventory synchronization.
              </p>

              {/* Interactive Feature Pills */}
              <div className="grid grid-cols-2 gap-2.5 mb-8">
                {shopPills.map((pill, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-sky-50/70 border border-slate-200/70 hover:border-sky-200 transition-colors flex items-center gap-2.5 text-xs font-semibold text-slate-800"
                  >
                    <span className="text-base shrink-0">{pill.icon}</span>
                    <span className="truncate">{pill.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Row */}
            <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 font-medium">
                Live Inventory Connected
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 group-hover:bg-sky-600 transition-colors shadow-sm"
              >
                <span>Browse Catalog</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Card 2: Champions Lounge & Cafe */}
          <div 
            id="cafe" 
            className="group relative bg-white rounded-3xl p-7 sm:p-8 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              {/* Header Badges */}
              <div className="flex items-center justify-between gap-2 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-lime-50 text-lime-700 flex items-center justify-center border border-lime-200 group-hover:scale-110 transition-transform">
                  <Coffee className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-extrabold border border-sky-200">
                  Member Charge Tab Enabled
                </span>
              </div>

              {/* Title & Headline */}
              <div className="text-xs font-bold text-lime-700 uppercase tracking-wider mb-1">
                Athletic Nutrition & Dining
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-3 font-[family-name:var(--font-outfit)]">
                Champions Lounge & Café
              </h3>
              <p className="text-sm text-slate-600 font-normal leading-relaxed mb-6">
                Post-match recovery smoothies, organic cold-pressed juices, and healthy gourmet bowls overlooking center court with 4K match screenings.
              </p>

              {/* Interactive Feature Pills */}
              <div className="grid grid-cols-2 gap-2.5 mb-8">
                {cafePills.map((pill, idx) => (
                  <div 
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 hover:bg-lime-50/70 border border-slate-200/70 hover:border-lime-200 transition-colors flex items-center gap-2.5 text-xs font-semibold text-slate-800"
                  >
                    <span className="text-base shrink-0">{pill.icon}</span>
                    <span className="truncate">{pill.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Row */}
            <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px] text-slate-400 font-medium">
                Direct Tab & Kitchen POS
              </div>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 group-hover:bg-lime-700 transition-colors shadow-sm"
              >
                <span>View Menu</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
