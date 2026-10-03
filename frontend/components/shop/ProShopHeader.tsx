/**
 * Champions Club — Pro Shop Header Navigation & Action Bar
 * Luxury Light Theme matching Champions Club design system
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
    <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
      {/* Left: Brand / Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white font-black text-sm tracking-wider shadow-md shadow-sky-500/25 border border-white hover:scale-105 transition-transform shrink-0"
          title="Return to Club Sanctuary Home"
        >
          <span className="text-[#CCFF00] drop-shadow-sm font-extrabold">CC</span>
        </Link>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 font-[family-name:var(--font-outfit)]">
              The Pro Shop
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-extrabold uppercase tracking-wide">
              <Sparkles className="w-2.5 h-2.5 text-sky-600" />
              <span>Authorized Boutique</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
            Tour equipment, match gear & custom stringing
          </p>
        </div>
      </div>

      {/* Center: Member Tier Discount Badge */}
      <div className="hidden lg:flex items-center">
        {isAuthenticated && user ? (
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-2xs ${
              isGold
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : isSilver
                ? "bg-slate-100 border-slate-200 text-slate-800"
                : isJunior
                ? "bg-lime-50 border-lime-200 text-lime-900"
                : "bg-sky-50 border-sky-200 text-sky-900"
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
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
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-bold text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <Zap className="w-3 h-3 text-amber-600" />
            <span>Sign in as a Member for up to 20% tier savings</span>
          </Link>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5 justify-end">
        {/* My Orders button */}
        <button
          type="button"
          onClick={onOpenOrders}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all shadow-2xs active:scale-95"
          title="View My Pro Shop Order History"
        >
          <Package className="w-4 h-4 text-sky-600" />
          <span className="hidden sm:inline">My Orders</span>
        </button>

        {/* Cart Trigger */}
        <button
          type="button"
          onClick={onOpenCart}
          className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-sky-600 text-white shadow-sm hover:shadow-md transition-all active:scale-95"
          title="Open Shopping Cart"
        >
          <ShoppingBag className="w-4 h-4 text-white" />
          <span>Cart</span>
          {cartCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-lime-400 text-slate-950 font-black text-[10px] shadow-sm animate-in zoom-in-50">
              {cartCount}
            </span>
          )}
        </button>

        {/* User Profile or Login */}
        {isAuthenticated && user ? (
          <Link
            href={profileHref}
            className="hidden md:inline-flex items-center gap-2 p-1 pl-2 pr-3 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition-all"
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
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
          >
            <User className="w-3.5 h-3.5 text-sky-600" />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </div>
  );
}
