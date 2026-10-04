"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ShoppingBag,
  Coffee,
  Sparkles,
  ArrowRight,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Tv,
  Apple,
  Clock,
  Flame
} from "lucide-react";

export default function ProShopAndCafe() {
  const shopFeatures = [
    { label: "Tour Rackets & Match Balls", detail: "Head, Wilson, Babolat & Yonex" },
    { label: "Court-Specific Footwear Fitting", detail: "Grass, Sand & Indoor Soles" },
    { label: "Online Reservation & Locker Pick-Up", detail: "Instant member checkout" },
  ];

  const cafeFeatures = [
    { label: "Recovery Whey & Electrolyte Bar", detail: "Custom post-workout formulas" },
    { label: "Artisan Specialty Espresso", detail: "Single-origin roast & nitro brews" },
    { label: "High-Protein Bowls & Grills", detail: "Designed with sports nutritionists" }

  ];

  return (
    <section id="facilities" className="py-20 bg-slate-50/70 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-sky-200/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-lime-200/25 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            <span>Club Amenities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
            Pro Shop & Champions Lounge
          </h2>
          <p className="text-slate-600 text-sm mt-2">
            Tour-level gear and post-match athletic nutrition with seamless digital member account charging.
          </p>
        </div>

        {/* Dual Visual Feature Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1: Pro Shop */}
          <div
            id="shop"
            className="group relative bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              {/* Card Image Banner */}
              <div className="relative h-56 w-full overflow-hidden bg-slate-900">
                <Image
                  src="https://i.pinimg.com/736x/f4/31/f2/f431f2b73dcd75236333388b185e3c04.jpg"
                  alt="Champions Club Pro Shop & Rackets"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent" />

                {/* Image Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold border border-white/20">
                    Wilson • Head • Babolat
                  </span>
                  <span className="px-3 py-1 rounded-full bg-lime-400 text-slate-950 text-xs font-black shadow-sm">
                    10% – 20% Member Discount
                  </span>
                </div>

                {/* Image Bottom Caption */}
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-0.5">
                    Authorized Retail & Workshop
                  </div>
                  <h3 className="text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                    The Pro Shop
                  </h3>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 sm:p-7">
                <p className="text-sm text-slate-600 font-normal leading-relaxed mb-6">
                  Official Head, Wilson, Babolat, and Nike equipment with certified same-day racket stringing, precision weight matching, and instant digital inventory synchronization.
                </p>

                {/* Professional Feature List */}
                <div className="space-y-3 mb-6">
                  {shopFeatures.map((feature, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{feature.label}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 shrink-0">{feature.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="p-6 sm:p-7 pt-0 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="text-[11px] text-slate-500 font-medium">
                Live Inventory Connected
              </div>
              <Link
                href="/shop"
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
            className="group relative bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              {/* Card Image Banner */}
              <div className="relative h-56 w-full overflow-hidden bg-slate-900">
                <Image
                  src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80"
                  alt="Champions Lounge & Café"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-transparent" />

                {/* Image Top Badges */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold border border-white/20">
                    Organic • Espresso • Smoothies
                  </span>
                  <span className="px-3 py-1 rounded-full bg-sky-400 text-slate-950 text-xs font-black shadow-sm">
                    Member Charge Tab Enabled
                  </span>
                </div>

                {/* Image Bottom Caption */}
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-lime-400 mb-0.5">
                    Athletic Nutrition & Dining
                  </div>
                  <h3 className="text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                    Champions Lounge & Café
                  </h3>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-6 sm:p-7">
                <p className="text-sm text-slate-600 font-normal leading-relaxed mb-6">
                  Post-match recovery smoothies, organic cold-pressed juices, and healthy gourmet bowls overlooking center court with 4K live sports match screenings.
                </p>

                {/* Professional Feature List */}
                <div className="space-y-3 mb-6">
                  {cafeFeatures.map((feature, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-lime-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{feature.label}</span>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 shrink-0">{feature.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Row */}
            <div className="p-6 sm:p-7 pt-0 border-t border-slate-100 flex items-center justify-between mt-auto">
              <div className="text-[11px] text-slate-500 font-medium">
                Direct Tab & Kitchen POS
              </div>
              <Link
                href="/cafe"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-lime-700 hover:bg-lime-800 transition-colors shadow-sm"
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
