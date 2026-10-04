/**
 * Champions Club — Pro Shop Luxury Product Card
 * Luxury Light Theme matching Champions Club design system
 */

"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Crown,
  Activity,
  CircleDot,
  Shirt,
  Glasses,
  Footprints,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";

export interface BackendProduct {
  id: number;
  sku: string;
  name: string;
  category_id?: number;
  category?: {
    id: number;
    name: string;
    slug: string;
    description?: string;
  };
  price: number;
  cost_price?: number;
  stock_quantity: number;
  low_stock_threshold?: number;
  description?: string;
  barcode?: string;
  image_url?: string | null;
  is_active: boolean;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
}

interface ProductCardProps {
  product: BackendProduct;
  currentUser: AuthUser | null;
  onAddToCart: (product: BackendProduct, quantity: number) => void;
  onClickDetails: (product: BackendProduct) => void;
}

function renderProductPlaceholder(categorySlug?: string) {
  const slug = (categorySlug || "").toLowerCase();

  let IconComponent = ShoppingBag;
  let bgGradient = "from-sky-50 via-slate-50 to-blue-50";
  let iconColor = "text-sky-600";
  let iconBg = "bg-sky-100/80 border-sky-200 text-sky-700";

  if (slug.includes("racket")) {
    IconComponent = Activity;
    bgGradient = "from-sky-50 via-indigo-50/40 to-blue-100/60";
    iconColor = "text-sky-600";
    iconBg = "bg-sky-100 border-sky-200";
  } else if (slug.includes("ball") || slug.includes("shuttle")) {
    IconComponent = CircleDot;
    bgGradient = "from-lime-50 via-emerald-50/40 to-green-100/60";
    iconColor = "text-emerald-600";
    iconBg = "bg-emerald-100 border-emerald-200";
  } else if (slug.includes("apparel") || slug.includes("cloth")) {
    IconComponent = Shirt;
    bgGradient = "from-indigo-50 via-purple-50/40 to-indigo-100/60";
    iconColor = "text-indigo-600";
    iconBg = "bg-indigo-100 border-indigo-200";
  } else if (slug.includes("shoe") || slug.includes("footwear")) {
    IconComponent = Footprints;
    bgGradient = "from-amber-50 via-orange-50/40 to-amber-100/60";
    iconColor = "text-amber-600";
    iconBg = "bg-amber-100 border-amber-200";
  } else if (slug.includes("access") || slug.includes("string")) {
    IconComponent = Glasses;
    bgGradient = "from-cyan-50 via-teal-50/40 to-cyan-100/60";
    iconColor = "text-cyan-600";
    iconBg = "bg-cyan-100 border-cyan-200";
  }

  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center p-6 text-center relative overflow-hidden group-hover:scale-105 transition-transform duration-500`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_0,transparent_70%)] pointer-events-none" />
      <div className={`w-16 h-16 rounded-2xl ${iconBg} border shadow-sm flex items-center justify-center mb-2`}>
        <IconComponent className={`w-8 h-8 ${iconColor}`} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {categorySlug || "Champions Gear"}
      </span>
    </div>
  );
}

export default function ProductCard({
  product,
  currentUser,
  onAddToCart,
  onClickDetails,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

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

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < product.stock_quantity) {
      setQuantity((prev) => prev + 1);
    }
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  return (
    <div
      onClick={() => onClickDetails(product)}
      className="group relative bg-white hover:bg-white border border-slate-200/90 hover:border-sky-300 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer"
    >
      <div>
        {/* Visual Media Container */}
        <div className="relative w-full h-48 sm:h-52 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 mb-4 shadow-inner">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            renderProductPlaceholder(categorySlug)
          )}

          {/* Top Floating Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
            {/* Category tag */}
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 backdrop-blur-md text-slate-800 border border-slate-200 shadow-2xs">
              {categoryName}
            </span>

            {/* Stock status */}
            {isOutOfStock ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs animate-pulse">
                Only {product.stock_quantity} Left
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                In Stock ({product.stock_quantity})
              </span>
            )}
          </div>

          {/* SKU Sub-tag at bottom */}
          <div className="absolute bottom-2.5 left-3">
            <span className="text-[9px] font-mono font-bold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/60 backdrop-blur-sm shadow-2xs">
              {product.sku}
            </span>
          </div>
        </div>

        {/* Product Title & Description */}
        <div className="space-y-1.5 mb-3">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1 font-[family-name:var(--font-outfit)]">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* Pricing & Cart Action Section */}
      <div className="pt-3 border-t border-slate-100 space-y-3">
        {/* Price Row */}
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                ₹{Number(product.price).toLocaleString()}
              </span>
              {estimatedDiscountPct > 0 && (
                <span className="text-xs text-slate-400 line-through">
                  ₹{Number(product.price).toLocaleString()}
                </span>
              )}
            </div>
            {estimatedDiscountPct > 0 && (
              <p className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1">
                <Crown className="w-2.5 h-2.5 text-amber-600" />
                <span>{estimatedDiscountPct}% Member Discount at Checkout</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Controls: Quantity Stepper + Add to Cart */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!isOutOfStock && (
            <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 shrink-0">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-2xs"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center text-xs font-black text-slate-900 select-none">
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                disabled={quantity >= product.stock_quantity}
                aria-label="Increase quantity"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors shadow-2xs"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition-all ${
              isOutOfStock
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : justAdded
                ? "bg-emerald-600 text-white shadow-sm scale-[1.02]"
                : "bg-slate-900 hover:bg-sky-600 active:scale-95 text-white shadow-sm hover:shadow-md"
            }`}
          >
            {isOutOfStock ? (
              <span>Out of Stock</span>
            ) : justAdded ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
