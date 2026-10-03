/**
 * Champions Club — Pro Shop Product Detail Modal
 * Luxury Light Theme matching Champions Club design system
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* Left Media Column */}
          <div className="space-y-3">
            <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200 flex items-center justify-center shadow-inner">
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
                  <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center mx-auto shadow-2xs">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {categoryName}
                  </p>
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-3 left-3">
                {isOutOfStock ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                    Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs animate-pulse">
                    Only {product.stock_quantity} Available
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                    {product.stock_quantity} In Stock
                  </span>
                )}
              </div>
            </div>

            {/* Quality Assurance Badges */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-600">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                <span>100% Genuine Tour Gear</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pickup or Direct Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Product Details & Actions */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 border border-sky-200 text-sky-700">
                  {categoryName}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  SKU: {product.sku}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-[family-name:var(--font-outfit)]">
                {product.name}
              </h2>
            </div>

            {/* Description */}
            <div className="text-xs sm:text-sm text-slate-600 leading-relaxed max-h-36 overflow-y-auto pr-1">
              {product.description ||
                "Official Champions Club pro shop performance gear. Tested and approved for tournament competition and masterclass training."}
            </div>

            {/* Price & Savings */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  List Price:
                </span>
                <span className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  ₹{Number(product.price).toLocaleString()}
                </span>
              </div>
              {estimatedDiscountPct > 0 ? (
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="font-extrabold text-amber-800 flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Member Privilege ({estimatedDiscountPct}% Off)</span>
                  </span>
                  <span className="font-black text-sky-600">
                    ≈ ₹{Math.round(product.price * (1 - estimatedDiscountPct / 100)).toLocaleString()}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 pt-1">
                  Member discounts will be calculated on server at checkout.
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            {!isOutOfStock && (
              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-xs font-bold text-slate-700">Quantity:</span>
                <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 transition-colors shadow-2xs"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-black text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.min(product.stock_quantity, q + 1))
                    }
                    disabled={quantity >= product.stock_quantity}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  isOutOfStock
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : justAdded
                    ? "bg-emerald-600 text-white shadow-md"
                    : "bg-slate-900 hover:bg-slate-800 text-white shadow-sm"
                }`}
              >
                {isOutOfStock ? (
                  <span>Out of Stock</span>
                ) : justAdded ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Added to Cart!</span>
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
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/25 transition-all"
                >
                  Instant Checkout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
