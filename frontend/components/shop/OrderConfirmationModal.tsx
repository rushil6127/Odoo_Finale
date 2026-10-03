/**
 * Champions Club — Pro Shop Order Confirmation View
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
    navigator.clipboard.writeText(order.order_reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDelivery = order.fulfillment_type === "DELIVERY";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8 text-center"
      >
        {/* Confetti / Glow Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Success Icon */}
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 mb-4 animate-in zoom-in-50 duration-300">
          <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
        </div>

        {/* Title */}
        <div className="space-y-1 mb-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            <span>Payment Verified & Confirmed</span>
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-[family-name:var(--font-outfit)] tracking-tight">
            Order Placed Successfully!
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your Pro Shop order has been recorded by the club management system and inventory has been allocated.
          </p>
        </div>

        {/* Order Reference Badge with Copy Button */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-left mb-5 shadow-inner">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Order Reference</p>
            <p className="text-base font-black font-mono text-sky-400 mt-0.5">
              {order.order_reference}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyRef}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-750 text-xs font-bold transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Fulfillment & Delivery Notice Card */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-left space-y-2.5 text-xs mb-5">
          <div className="flex items-center gap-2">
            {isDelivery ? (
              <Truck className="w-4 h-4 text-sky-400 shrink-0" />
            ) : (
              <Store className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-extrabold text-white">
              {isDelivery ? "Direct Courier Delivery" : "Pro Shop Counter Pickup"}
            </span>
          </div>

          {isDelivery ? (
            <div className="space-y-1 text-slate-400">
              <p className="text-slate-300 font-medium">Delivery Address:</p>
              <p className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                {order.delivery_address || "Provided during checkout"}
              </p>
              <p className="text-[11px] text-slate-400">
                Tracking updates will be dispatched to {order.customer_email || "your registered email"}.
              </p>
            </div>
          ) : (
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Your gear is available for pickup at the <strong>Champions Club Pro Shop Reception</strong>. Show your digital member pass or order reference {order.order_reference} to the front desk.
            </p>
          )}
        </div>

        {/* Items Summary */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-left space-y-2 text-xs mb-6">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Items in Order ({order.items?.length || 0})
          </p>
          <div className="max-h-36 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
            {order.items?.map((item, idx) => (
              <div key={idx} className="pt-2 first:pt-0 flex justify-between items-center text-[11px]">
                <div className="truncate max-w-[240px]">
                  <span className="font-bold text-slate-200">{item.product_name}</span>
                  <span className="text-slate-500 font-mono ml-1.5">x{item.quantity}</span>
                </div>
                <span className="font-mono font-bold text-slate-200">
                  ₹{Number(item.total_price).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline font-black">
            <span className="text-white">Amount Paid</span>
            <span className="text-base text-emerald-400 font-mono">
              ₹{Number(order.total_amount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Bottom CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onViewMyOrders}
            className="flex-1 py-3 px-4 rounded-2xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4 text-sky-400" />
            <span>View in My Orders</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 px-6 rounded-2xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <span>Continue Shopping</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
