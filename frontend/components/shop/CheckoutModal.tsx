/**
 * Champions Club — Pro Shop Checkout Modal & Order Placement
 */

"use client";

import { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Store,
  Truck,
  Crown,
  AlertCircle,
  Loader2,
  Lock,
  ArrowRight,
  User,
  Phone,
  Mail,
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api/client";
import type { CartItem, QuoteData } from "@/lib/cart/useCart";
import type { AuthUser } from "@/lib/auth";

export interface CreatedOrderResponse {
  id: number;
  order_reference: string;
  order_type: string;
  fulfillment_type: string;
  status: string;
  member_id: number;
  user_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string | null;
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  notes?: string | null;
  items: Array<{
    id: number;
    product_id: number;
    product_sku: string;
    product_name: string;
    unit_price: number;
    quantity: number;
    discount_pct: number;
    discount_amount: number;
    total_price: number;
  }>;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  quote: QuoteData | null;
  currentUser: AuthUser | null;
  onOrderCreated: (order: CreatedOrderResponse) => void;
  onStockError: (errorMessage: string) => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  items,
  quote,
  currentUser,
  onOrderCreated,
  onStockError,
}: CheckoutModalProps) {
  const [fulfillmentType, setFulfillmentType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Prefill member credentials
  useEffect(() => {
    if (currentUser) {
      setCustomerName(currentUser.full_name || (currentUser as any).name || "");
      setCustomerEmail(currentUser.email || "");
      setCustomerPhone((currentUser as any).phone || (currentUser as any).member_profile?.phone || "");
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const rawSubtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalAmount = quote ? quote.total_amount : rawSubtotal;
  const discountAmount = quote ? quote.discount_amount : 0;
  const planName = (currentUser as any)?.membershipPlan || null;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // 1. Validation
    if (items.length === 0) {
      setValidationError("Your cart is empty.");
      return;
    }

    if (fulfillmentType === "DELIVERY" && !deliveryAddress.trim()) {
      setValidationError("Please provide a complete delivery address for courier delivery.");
      return;
    }

    if (!customerName.trim()) {
      setValidationError("Please enter your full name.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        order_type: "ONLINE",
        fulfillment_type: fulfillmentType,
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        delivery_address: fulfillmentType === "DELIVERY" ? deliveryAddress.trim() : undefined,
        payment_method: "ONLINE",
        notes: notes.trim() || undefined,
      };

      const res = await apiClient.post<{ order: CreatedOrderResponse }>("/shop/orders", payload);

      if (res && res.order) {
        onOrderCreated(res.order);
      } else {
        throw new Error("Invalid response from order creation endpoint.");
      }
    } catch (err: any) {
      if (err instanceof ApiError && (err.code === "INSUFFICIENT_STOCK" || err.status === 409)) {
        onStockError(err.message || "Some items in your cart exceed available stock. Please adjust quantities.");
        onClose();
      } else {
        setValidationError(err?.message || "Failed to place shop order. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-[family-name:var(--font-outfit)]">
              Pro Shop Checkout
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select fulfillment, review member discounts & confirm order
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmitOrder} className="mt-6 space-y-6">
          {/* Validation Error Alert */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Fulfillment Method Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
              1. Fulfillment Choice
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pickup Option */}
              <button
                type="button"
                onClick={() => {
                  setFulfillmentType("PICKUP");
                  setValidationError(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                  fulfillmentType === "PICKUP"
                    ? "bg-sky-500/10 border-sky-500 text-white shadow-md shadow-sky-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    fulfillmentType === "PICKUP"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">Club Reception Pickup</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                      FREE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Collect at Champions Club Pro Shop reception counter same-day.
                  </p>
                </div>
              </button>

              {/* Delivery Option */}
              <button
                type="button"
                onClick={() => {
                  setFulfillmentType("DELIVERY");
                  setValidationError(null);
                }}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                  fulfillmentType === "DELIVERY"
                    ? "bg-sky-500/10 border-sky-500 text-white shadow-md shadow-sky-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    fulfillmentType === "DELIVERY"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">Direct Courier Delivery</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Secure doorstep delivery with tracking. Address required.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Delivery Address (Conditional) */}
          {fulfillmentType === "DELIVERY" && (
            <div className="space-y-2 animate-in fade-in duration-200">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
                Delivery Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Apartment/Flat, Building, Street, City, State, Pincode..."
                  rows={3}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all resize-none"
                />
              </div>
            </div>
          )}

          {/* 3. Customer Info */}
          <div className="space-y-2.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
              2. Member & Contact Details
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Full Name</span>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    placeholder="Full Name"
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Mobile Phone</span>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 Phone"
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block mb-1">Email Address</span>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="member@club.com"
                    className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Notes / Instructions */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Special Handling / Stringing Tension Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Racket stringing tension 26 lbs, gift wrapping..."
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>

          {/* 5. Summary Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Items Subtotal ({items.length} SKUs)</span>
              <span className="font-bold text-slate-200">
                ₹{(quote ? quote.subtotal_amount : rawSubtotal).toLocaleString()}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-amber-400 font-bold">
                <span className="flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" />
                  <span>{planName || "Member"} Plan Discount</span>
                </span>
                <span>-₹{discountAmount.toLocaleString()}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-400">
              <span>Fulfillment ({fulfillmentType})</span>
              <span className="text-emerald-400 font-bold">Free</span>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="font-black text-sm text-white">Final Amount Payable</span>
              <span className="text-xl font-black text-white font-[family-name:var(--font-outfit)]">
                ₹{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-2xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              Back to Bag
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 px-6 rounded-2xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Shop Order...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirm Order & Pay (₹{totalAmount.toLocaleString()})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
