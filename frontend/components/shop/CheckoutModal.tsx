/**
 * Champions Club — Pro Shop Checkout Modal & Order Placement
 * Luxury Light Theme matching Champions Club design system
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
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  delivery_address?: string;
  notes?: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: Array<{
    id: number;
    product_id: number;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit_price: number;
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
  onStockConflict: (errorMsg: string) => void;
}

export default function CheckoutModal({
  isOpen,
  onClose,
  items,
  quote,
  currentUser,
  onOrderCreated,
  onStockConflict,
}: CheckoutModalProps) {
  const [fulfillmentType, setFulfillmentType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Auto-fill customer profile details
  useEffect(() => {
    if (currentUser) {
      const u = currentUser as any;
      setCustomerName(u.full_name || u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim());
      setCustomerEmail(currentUser.email || "");
      setCustomerPhone(u.phone || "");
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const rawSubtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const estimatedDiscount = quote ? quote.discount_amount : 0;
  const estimatedTotal = quote ? quote.total_amount : rawSubtotal;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!customerName.trim()) {
      setFormError("Recipient full name is required.");
      return;
    }

    if (fulfillmentType === "DELIVERY" && !deliveryAddress.trim()) {
      setFormError("Delivery street address is required for club courier fulfillment.");
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        order_type: "ONLINE",
        fulfillment_type: fulfillmentType,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || undefined,
        customer_email: customerEmail.trim() || undefined,
        delivery_address: fulfillmentType === "DELIVERY" ? deliveryAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        payment_method: "ONLINE",
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      };

      const res = await apiClient.post<{ order: CreatedOrderResponse }>("/shop/orders", payload);

      if (res && res.order) {
        onOrderCreated(res.order);
      } else {
        throw new Error("Unable to create order. Please try again.");
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        onClose();
        onStockConflict(err.message || "Insufficient stock for one or more items in your bag.");
      } else {
        setFormError(err?.message || "Failed to place order. Please review your bag and connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                Pro Shop Checkout
              </h2>
              <p className="text-[11px] text-slate-500">
                Finalize fulfillment & digital order placement
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notice */}
        {formError && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleCreateOrder} className="py-5 space-y-4 text-xs">
          {/* Fulfillment Toggle */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 block">
              Fulfillment Method:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Pickup Option */}
              <button
                type="button"
                onClick={() => setFulfillmentType("PICKUP")}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  fulfillmentType === "PICKUP"
                    ? "bg-sky-50 border-sky-400 text-sky-950 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    fulfillmentType === "PICKUP"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-xs">Club Desk Pickup</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Collect at Pro Shop counter (No fee)
                  </p>
                </div>
              </button>

              {/* Delivery Option */}
              <button
                type="button"
                onClick={() => setFulfillmentType("DELIVERY")}
                className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                  fulfillmentType === "DELIVERY"
                    ? "bg-sky-50 border-sky-400 text-sky-950 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    fulfillmentType === "DELIVERY"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-xs">Club Courier Delivery</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Direct to residence address
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-slate-700">Recipient Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Member Name"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="member@club.com"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* Delivery Address (Strictly required if DELIVERY selected) */}
          {fulfillmentType === "DELIVERY" && (
            <div className="space-y-1 animate-in fade-in duration-200">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                Delivery Address *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-sky-600 absolute left-3 top-3" />
                <textarea
                  required
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Villa / Flat number, Street, Landmark, City & Pincode..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* Special Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">
              Order Notes / Racket String Tension (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. String racket at 54 lbs, gift packaging..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>

          {/* Order Summary Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Bag Items Subtotal:</span>
              <span className="font-bold text-slate-900">₹{rawSubtotal.toLocaleString()}</span>
            </div>
            {estimatedDiscount > 0 && (
              <div className="flex justify-between text-amber-800 font-bold">
                <span className="flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-600" />
                  <span>Member Tier Discount:</span>
                </span>
                <span className="text-emerald-700">-₹{estimatedDiscount.toLocaleString()}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-black text-slate-900">Final Order Amount:</span>
              <span className="text-xl font-black text-sky-600 font-[family-name:var(--font-outfit)]">
                ₹{estimatedTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Action Trigger */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-2xl text-xs font-black bg-slate-900 hover:bg-sky-600 text-white shadow-lg shadow-slate-900/10 hover:shadow-sky-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deducting Stock & Creating Order...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Place Order & Proceed to Payment (₹{estimatedTotal.toLocaleString()})</span>
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
