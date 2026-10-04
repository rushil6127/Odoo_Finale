/**
 * Champions Club — Pro Shop Cart Drawer & Real-Time Server Quote
 * Luxury Light Theme matching Champions Club design system
 */

"use client";

import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Crown,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import type { CartItem, QuoteData } from "@/lib/cart/useCart";
import type { AuthUser } from "@/lib/auth";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  quote: QuoteData | null;
  isQuoteLoading: boolean;
  quoteError?: string | null;
  currentUser: AuthUser | null;
  onUpdateQuantity: (productId: number, qty: number) => void;
  onRemoveItem: (productId: number) => void;
  onClearCart: () => void;
  onProceedToCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  quote,
  isQuoteLoading,
  currentUser,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onProceedToCheckout,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const rawSubtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalAmount = quote ? quote.total_amount : rawSubtotal;
  const discountAmount = quote ? quote.discount_amount : 0;

  const planName = (currentUser as any)?.membershipPlan || null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <aside aria-label="Shopping Cart Drawer" className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300 text-slate-900">
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900 font-[family-name:var(--font-outfit)]">
                  Shopping Cart
                </h2>
                <p className="text-[11px] text-slate-500">
                  {items.length} unique item{items.length !== 1 ? "s" : ""} in bag
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-slate-100">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Your cart is empty</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Explore our tour rackets, balls, court footwear and club apparel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-sky-600 text-white transition-all shadow-sm"
                >
                  Browse Pro Shop Gear
                </button>
              </div>
            ) : (
              items.map((item) => {
                const quoteItem = quote?.items.find((q) => q.product_id === item.productId);
                return (
                  <div key={item.productId} className="pt-3.5 first:pt-0 flex gap-3.5 items-start group">
                    {/* Item Thumbnail */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0 shadow-inner flex items-center justify-center">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-sky-600" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          aria-label={`Remove ${item.name}`}
                          className="text-slate-400 hover:text-rose-500 p-0.5 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900">
                          ₹{(quoteItem ? quoteItem.unit_price : item.price).toLocaleString()}
                        </div>
                        {quoteItem && quoteItem.discount_amount > 0 && (
                          <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            -{quoteItem.discount_pct}%
                          </span>
                        )}
                      </div>

                      {/* Quantity row */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.stockQuantity}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        <span className="text-xs font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                          ₹{((quoteItem ? quoteItem.total_price : item.price * item.quantity)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer / Live Server Quote Summary */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-200 bg-slate-50/80 space-y-4">
              {/* Quote Breakdown Card */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} units):</span>
                  <span className="font-bold text-slate-900">
                    ₹{(quote ? quote.subtotal_amount : rawSubtotal).toLocaleString()}
                  </span>
                </div>

                {isQuoteLoading ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-sky-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing server member discount...</span>
                  </div>
                ) : discountAmount > 0 ? (
                  <div className="flex justify-between items-center text-amber-800 font-bold bg-amber-50 border border-amber-200/80 p-2 rounded-xl">
                    <span className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-600" />
                      <span>{quote?.plan_code || planName || "Member"} Privilege Savings:</span>
                    </span>
                    <span className="text-emerald-700 font-extrabold">-₹{discountAmount.toLocaleString()}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 italic">
                    Member discounts applied during official order placement.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="font-black text-sm text-slate-900">Estimated Total:</span>
                  <div className="text-right">
                    <span className="text-xl font-black text-sky-600 font-[family-name:var(--font-outfit)]">
                      ₹{totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={onProceedToCheckout}
                className="w-full py-3.5 px-4 rounded-2xl text-xs font-black bg-slate-900 hover:bg-sky-600 text-white shadow-lg shadow-slate-900/10 hover:shadow-sky-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Reserved stock deducted atomically on order creation</span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
