/**
 * Champions Club — Pro Shop Header Navigation & Action Bar
 */

"use client";

import Link from "next/link";
import {
  ShoppingBag,
  Package,
  Sparkles,
  Crown,
  User,
  Zap,
} from "lucide-react";
import { useCurrentUser, getRoleProfilePath } from "@/lib/auth";

interface ProShopHeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
}

export default function ProShopHeader({
  cartCount,
  onOpenCart,
  onOpenOrders,
}: ProShopHeaderProps) {
  const { user, isAuthenticated } = useCurrentUser();
  const profileHref = getRoleProfilePath(user);

  const planName = (user as any)?.membershipPlan || (user as any)?.active_membership?.plan_name || null;
  const isGold = planName?.toUpperCase() === "GOLD";
  const isSilver = planName?.toUpperCase() === "SILVER";
  const isJunior = planName?.toUpperCase() === "JUNIOR";

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-md shadow-sky-500/25 border border-sky-400/40 hover:scale-105 transition-transform"
            title="Return to Club Sanctuary Home"
          >
            <span className="text-[#CCFF00] drop-shadow-sm font-extrabold">CC</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-[family-name:var(--font-outfit)]">
                The Pro Shop
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-extrabold uppercase tracking-wide">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Authorized Retail</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Tour-grade equipment, match gear & racket workshop
            </p>
          </div>
        </div>

        {/* Center: Member Tier Discount Badge */}
        <div className="hidden md:flex items-center">
          {isAuthenticated && user ? (
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm ${
                isGold
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                  : isSilver
                  ? "bg-slate-300/10 border-slate-300/30 text-slate-200"
                  : isJunior
                  ? "bg-lime-500/10 border-lime-500/30 text-lime-300"
                  : "bg-sky-500/10 border-sky-500/30 text-sky-300"
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {isGold
                  ? "Gold Tier • 20% Equipment & Apparel Discount"
                  : isSilver
                  ? "Silver Tier • 10% Pro Shop Equipment Discount"
                  : isJunior
                  ? "Junior Pass • 15% Balls, Shoes & Strings Discount"
                  : "Club Member • Automatic Benefit Applied at Checkout"}
              </span>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-sky-300 hover:border-sky-400 transition-colors"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Sign in as a Member for up to 20% tier savings</span>
            </Link>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* My Orders button */}
          <button
            type="button"
            onClick={onOpenOrders}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-all shadow-sm active:scale-95"
            title="View My Pro Shop Order History"
          >
            <Package className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">My Orders</span>
          </button>

          {/* Cart Trigger */}
          <button
            type="button"
            onClick={onOpenCart}
            className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md shadow-sky-500/20 active:scale-95 transition-all"
            title="Open Shopping Cart"
          >
            <ShoppingBag className="w-4 h-4 text-white" />
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shadow-sm animate-in zoom-in-50">
                {cartCount}
              </span>
            )}
          </button>

          {/* User Profile or Login */}
          {isAuthenticated && user ? (
            <Link
              href={profileHref}
              className="hidden lg:inline-flex items-center gap-2 p-1 pl-2 pr-3 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/40 text-xs font-bold text-slate-200 transition-all"
              title="Open Digital Member Pass"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 text-white font-extrabold text-[10px] flex items-center justify-center">
                {user.name ? user.name.split(" ").map((n) => n[0]).join("") : "M"}
              </div>
              <span className="truncate max-w-[90px]">{user.name?.split(" ")[0] || "Member"}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-all"
            >
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
