"use client";

import Image from "next/image";
import Link from "next/link";
import { 
  ShoppingBag, 
  Coffee, 
  Sparkles, 
  Percent, 
  Utensils, 
  Tag, 
  ArrowRight,
  ShieldCheck,
  Check
} from "lucide-react";

export default function ProShopAndCafe() {
  return (
    <section id="facilities" className="py-20 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-3 border border-sky-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Clubhouse Retail & Dining</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Pro Shop & Champions Lounge
          </h2>
          <p className="text-slate-600 text-base mt-3 leading-relaxed">
            Everything you need on and off the court. Stock up on tour-level gear with member discounts, or refuel at our artisan espresso bar and sports lounge with seamless billing tabs.
          </p>
        </div>

        {/* Dual Feature Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Pro Shop Card */}
          <div id="shop" className="glass-card rounded-3xl p-8 border border-slate-200 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-sky-100/60 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>The Pro Shop</span>
                </div>
                <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
                  Member Discount 10% – 20%
                </span>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
                Tour-Grade Gear & Stringing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                Authorized dealers for Head, Wilson, Babolat, Yonex, and Nike. Instant inventory synchronization across counter sales and online member pickup orders.
              </p>

              {/* Product Highlights */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Rackets & Strings</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Professional electronic 24hr stringing</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Footwear & Grip</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Clay & grass court specific outsoles</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Championship Balls</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Slazenger, Dunlop Fort, Head Tour</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Club Apparel</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Custom moisture-wicking jerseys</div>
                </div>
              </div>

              {/* Bullet Features */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Same-day electronic racket stringing & grip customization</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Reserve items online & pick up directly before your court match</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-center text-white bg-slate-900 hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <span>Explore Pro Shop Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Cafeteria & Lounge Card */}
          <div id="cafe" className="glass-card rounded-3xl p-8 border border-slate-200 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-lime-100/60 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-100 text-lime-900 text-xs font-bold">
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Champions Lounge & Bar</span>
                </div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  Member Charge Tab Ready
                </span>
              </div>

              <h3 className="text-2xl font-extrabold text-slate-900 mb-2">
                Athletic Nutrition & Match Viewing
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                Recharge after intense sets with fresh protein smoothies, electrolyte coolers, gourmet salads, and artisanal specialty coffees with panoramic court views.
              </p>

              {/* Menu Highlights */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Recovery Smoothies</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Whey isolate, berries & cold-pressed fruits</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Artisan Espresso</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Single origin roasts & organic teas</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Healthy Kitchen</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Quinoa bowls, wraps, high-protein grill</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
                  <div className="text-xs font-bold text-slate-900">Live Sports Theater</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">4K Grand Slam & Premier League broadcast</div>
                </div>
              </div>

              {/* Bullet Features */}
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Order table-side or charge directly to your digital member account</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Check className="w-4 h-4 text-green-600 shrink-0" />
                  <span>Dedicated kitchen POS system for fast post-match refreshments</span>
                </div>
              </div>
            </div>

            <Link
              href="/login"
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-center text-white bg-slate-900 hover:bg-lime-600 transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              <span>View Cafe & Lounge Menu</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
