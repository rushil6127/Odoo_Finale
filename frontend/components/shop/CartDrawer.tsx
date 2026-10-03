/**
 * Champions Club — Pro Shop Cart Drawer & Real-Time Server Quote
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <aside aria-label="Shopping Cart Drawer" className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm sm:text-base text-white font-[family-name:var(--font-outfit)]">
                  Shopping Cart
                </h2>
                <p className="text-[11px] text-slate-400">
                  {items.length} unique item{items.length !== 1 ? "s" : ""} in bag
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-slate-800/60">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-500">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Your cart is empty</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Explore our tour rackets, balls, court footwear and club apparel.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20"
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
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 shadow-inner flex items-center justify-center">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-sky-400/80" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-white truncate group-hover:text-sky-400 transition-colors">
                          {item.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.productId)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-mono">{item.sku}</span>
                        <span>•</span>
                        <span>₹{item.price.toLocaleString()} each</span>
                      </div>

                      {/* Line Item Pricing with Live Discount */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-white select-none">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                            disabled={item.quantity >= item.stockQuantity}
                            className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-white font-[family-name:var(--font-outfit)]">
                            ₹{(quoteItem ? quoteItem.total_price : item.price * item.quantity).toLocaleString()}
                          </span>
                          {quoteItem && quoteItem.discount_amount > 0 && (
                            <p className="text-[9px] font-bold text-amber-400">
                              -₹{quoteItem.discount_amount.toLocaleString()} ({quoteItem.discount_pct}% off)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Drawer Footer & Checkout Action */}
          {items.length > 0 && (
            <div className="p-5 border-t border-slate-800 bg-slate-950/80 space-y-3.5">
              {/* Pricing Breakdown */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span className="font-bold text-slate-200">
                    ₹{(quote ? quote.subtotal_amount : rawSubtotal).toLocaleString()}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-amber-400 font-bold">
                    <span className="flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5" />
                      <span>{planName || "Member"} Tier Savings</span>
                    </span>
                    <span>-₹{discountAmount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-400">
                  <span>Estimated Delivery</span>
                  <span className="text-emerald-400 font-bold">Free Club Pickup / Direct Courier</span>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                  <span className="font-extrabold text-sm text-white">Total Amount</span>
                  <div className="flex items-center gap-2">
                    {isQuoteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
                    <span className="font-black text-lg sm:text-xl text-white font-[family-name:var(--font-outfit)]">
                      ₹{totalAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  Real stock & member tier discounts are applied and locked upon order placement.
                </span>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={onProceedToCheckout}
                className="w-full py-3.5 px-4 rounded-2xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
