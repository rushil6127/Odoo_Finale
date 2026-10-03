/**
 * Champions Club — Pro Shop Order Confirmation View
 * Luxury Light Theme matching Champions Club design system
 */

"use client";

import {
  CheckCircle2,
  Package,
  Store,
  Truck,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { CreatedOrderResponse } from "./CheckoutModal";

interface OrderConfirmationModalProps {
  order: CreatedOrderResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onViewMyOrders: () => void;
}

export default function OrderConfirmationModal({
  order,
  isOpen,
  onClose,
  onViewMyOrders,
}: OrderConfirmationModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const handleCopyRef = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(order.order_reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 text-slate-900 text-center space-y-5"
      >
        {/* Animated Celebration Icon */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm animate-in zoom-in-50">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        {/* Title */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase tracking-wider mb-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>Order Confirmed & Paid</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
            Thank you for your order!
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Your Pro Shop order has been placed and inventory reserved. A digital invoice has been sent to your account.
          </p>
        </div>

        {/* Order Reference Pill */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Order Reference:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-200">
                {order.order_reference}
              </span>
              <button
                type="button"
                onClick={handleCopyRef}
                title="Copy reference number"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <span className="text-slate-500 font-semibold">Fulfillment Method:</span>
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              {order.fulfillment_type === "DELIVERY" ? (
                <>
                  <Truck className="w-3.5 h-3.5 text-sky-600" />
                  <span>Club Courier Delivery</span>
                </>
              ) : (
                <>
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pro Shop Desk Pickup</span>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
            <span className="text-slate-500 font-semibold">Total Paid:</span>
            <span className="font-black text-base text-slate-900 font-[family-name:var(--font-outfit)]">
              ₹{order.total_amount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Itemised brief */}
        {order.items && order.items.length > 0 && (
          <div className="max-h-36 overflow-y-auto space-y-2 text-left text-xs bg-slate-50/60 p-3 rounded-2xl border border-slate-200/80">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-slate-700">
                <span className="truncate pr-2">
                  <span className="font-bold text-slate-900">{item.quantity}x</span> {item.product_name}
                </span>
                <span className="font-semibold shrink-0 text-slate-900">₹{item.total_price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onViewMyOrders}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center justify-center gap-1.5"
          >
            <Package className="w-4 h-4 text-sky-600" />
            <span>View All Orders</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-slate-900 hover:bg-sky-600 text-white transition-all shadow-sm flex items-center justify-center gap-1.5"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
