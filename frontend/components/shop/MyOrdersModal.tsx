/**
 * Champions Club — Pro Shop Member Order History & Order Details Drawer/Modal
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Package,
  AlertTriangle,
  RotateCcw,
  Store,
  Truck,
  CreditCard,
  Loader2,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { CreatedOrderResponse } from "./CheckoutModal";

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPayUnpaidOrder: (order: CreatedOrderResponse) => void;
}

export default function MyOrdersModal({
  isOpen,
  onClose,
  onPayUnpaidOrder,
}: MyOrdersModalProps) {
  const [orders, setOrders] = useState<CreatedOrderResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<CreatedOrderResponse | null>(null);

  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.get<{ orders: CreatedOrderResponse[] }>("/shop/orders/my-orders?per_page=50");
      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load your order history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  const handleCancelOrder = async (orderId: number) => {
    try {
      setIsSubmittingCancel(true);
      const res = await apiClient.post<{ order: CreatedOrderResponse }>(
        `/shop/orders/${orderId}/cancel`,
        {
          reason: cancelReason.trim() || "Customer requested cancellation from portal",
        }
      );

      if (res?.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(res.order);
        }
      }
      setCancellingOrderId(null);
      setCancelReason("");
    } catch (err: any) {
      alert(err?.message || "Failed to cancel order.");
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case "CONFIRMED":
        return { label: "Confirmed", bg: "bg-sky-500/10 border-sky-500/30 text-sky-400" };
      case "PROCESSING":
        return { label: "Preparing", bg: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" };
      case "READY_FOR_PICKUP":
        return { label: "Ready for Pickup", bg: "bg-lime-500/10 border-lime-500/30 text-lime-400" };
      case "SHIPPED":
        return { label: "Shipped", bg: "bg-teal-500/10 border-teal-500/30 text-teal-400" };
      case "COMPLETED":
        return { label: "Completed", bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" };
      case "CANCELLED":
        return { label: "Cancelled", bg: "bg-rose-500/10 border-rose-500/30 text-rose-400" };
      default:
        return { label: "Pending Payment", bg: "bg-amber-500/10 border-amber-500/30 text-amber-400" };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white font-[family-name:var(--font-outfit)]">
                My Pro Shop Orders
              </h2>
              <p className="text-xs text-slate-400">
                Track live fulfillment, receipts, and order statuses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrders}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Refresh Orders"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? "animate-spin text-sky-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-1">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading your order history...</p>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-300">{error}</p>
              <button
                type="button"
                onClick={fetchOrders}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-white"
              >
                Retry
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-800/60 border border-slate-750 flex items-center justify-center mx-auto text-slate-500">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white">No Pro Shop Orders Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven&apos;t placed any Pro Shop orders yet. Browse our racket and gear catalog to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const badge = getStatusBadge(order.status);
                const isCancellable =
                  ["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status.toUpperCase());
                const isUnpaid = order.payment_status?.toUpperCase() === "PENDING";

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-4 shadow-sm"
                  >
                    {/* Top Row: Ref, Date, Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-sky-400">
                            {order.order_reference}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>
                            {(order as any).created_at
                              ? new Date((order as any).created_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Recent Order"}
                          </span>
                          <span>•</span>
                          <span>{order.fulfillment_type}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-base font-black text-white font-[family-name:var(--font-outfit)]">
                          ₹{Number(order.total_amount).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Purchased Items ({order.items?.length || 0})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.items?.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 flex justify-between items-center text-xs"
                          >
                            <div className="truncate max-w-[190px]">
                              <span className="font-bold text-slate-200 block truncate">
                                {item.product_name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                SKU: {item.product_sku} (Qty: {item.quantity})
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-200 shrink-0">
                              ₹{Number(item.total_price).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Status & Actions Bar */}
                    <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        {order.fulfillment_type === "DELIVERY" ? (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-sky-400" />
                            <span>Courier to: {order.delivery_address || "Provided Address"}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Hold for Pro Shop Counter Pickup</span>
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 ml-auto">
                        {isUnpaid && order.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => onPayUnpaidOrder(order)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20 hover:scale-102 transition-all flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Now</span>
                          </button>
                        )}

                        {isCancellable && (
                          <div>
                            {cancellingOrderId === order.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={cancelReason}
                                  onChange={(e) => setCancelReason(e.target.value)}
                                  placeholder="Reason"
                                  className="px-2.5 py-1 rounded-lg text-xs bg-slate-900 border border-slate-700 text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleCancelOrder(order.id)}
                                  disabled={isSubmittingCancel}
                                  className="px-3 py-1 rounded-lg text-xs font-black bg-rose-600 text-white hover:bg-rose-500 transition-colors"
                                >
                                  {isSubmittingCancel ? "Cancelling..." : "Confirm"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCancellingOrderId(null)}
                                  className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                >
                                  Back
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setCancellingOrderId(order.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-slate-800 transition-colors"
                              >
                                Cancel Order
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
