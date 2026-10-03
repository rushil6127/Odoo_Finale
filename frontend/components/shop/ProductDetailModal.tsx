/**
 * Champions Club — Pro Shop Product Detail Modal
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Crown,
  ShieldCheck,
  Truck,
} from "lucide-react";
import type { BackendProduct } from "./ProductCard";
import type { AuthUser } from "@/lib/auth";

interface ProductDetailModalProps {
  product: BackendProduct | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onAddToCart: (product: BackendProduct, quantity: number) => void;
  onInstantCheckout: (product: BackendProduct, quantity: number) => void;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  currentUser,
  onAddToCart,
  onInstantCheckout,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  if (!isOpen || !product) return null;

  const isOutOfStock = product.stock_quantity <= 0;
  const isLowStock =
    !isOutOfStock &&
    product.stock_quantity <= (product.low_stock_threshold || 5);

  const categoryName = product.category?.name || "Equipment";
  const categorySlug = product.category?.slug || "";

  // Member tier discount evaluation
  const planName = (currentUser as any)?.membershipPlan || null;
  let estimatedDiscountPct = 0;
  if (planName?.toUpperCase() === "GOLD") {
    if (["apparel", "rackets", "accessories"].includes(categorySlug.toLowerCase())) {
      estimatedDiscountPct = 20;
    }
  } else if (planName?.toUpperCase() === "SILVER") {
    if (["rackets", "apparel", "accessories"].includes(categorySlug.toLowerCase())) {
      estimatedDiscountPct = 10;
    }
  } else if (planName?.toUpperCase() === "JUNIOR") {
    if (["balls", "shoes", "accessories"].includes(categorySlug.toLowerCase())) {
      estimatedDiscountPct = 15;
    }
  }

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    onInstantCheckout(product, quantity);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* Left Media Column */}
          <div className="space-y-3">
            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto shadow-inner">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {categoryName}
                  </p>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-3 left-3">
                {isOutOfStock ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-rose-500 text-white shadow-sm">
                    Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                    Only {product.stock_quantity} Available
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-slate-950 shadow-sm">
                    {product.stock_quantity} In Stock
                  </span>
                )}
              </div>
            </div>

            {/* Quality Assurance Badges */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-400">
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                <span>100% Authentic</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Club Pickup & Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Product Info Column */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                  {product.sku}
                </span>
                <span className="text-xs font-bold text-sky-400">{categoryName}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)] leading-tight">
                {product.name}
              </h2>
            </div>

            {/* Price Section */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1.5">
              <div className="flex items-baseline gap-2.5">
                <span className="text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
                  ₹{Number(product.price).toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-bold">List Price (Inc. Taxes)</span>
              </div>
              {estimatedDiscountPct > 0 ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>
                    {planName} Member Benefit: {estimatedDiscountPct}% Discount Applied at Checkout
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Member discounts are calculated dynamically by backend rules upon checkout.
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Description</p>
              <p className="text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto pr-1">
                {product.description ||
                  "Tour-grade equipment meeting international sporting federation standards with precision balance and performance durability."}
              </p>
            </div>

            {/* Quantity Controls & Action Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              {!isOutOfStock && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-300">Select Quantity:</span>
                  <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-black text-white select-none">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                      }
                      disabled={quantity >= product.stock_quantity}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isOutOfStock}
                  className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                    isOutOfStock
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : justAdded
                      ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  }`}
                >
                  {justAdded ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Added to Cart</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>

                {!isOutOfStock && (
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md shadow-sky-500/20 transition-all active:scale-95"
                  >
                    Proceed to Checkout
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
