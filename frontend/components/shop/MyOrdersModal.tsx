/**
 * Champions Club — Pro Shop Member Order History & Order Details Drawer/Modal
 * Luxury Light Theme matching Champions Club design system
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  const fetchMyOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.get<{ orders: CreatedOrderResponse[] }>("/shop/orders/my-orders");
      if (res && Array.isArray(res.orders)) {
        setOrders(res.orders);
      } else {
        setOrders([]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load order history.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMyOrders();
    }
  }, [isOpen, fetchMyOrders]);

  if (!isOpen) return null;

  const handleCancelOrder = async (orderId: number) => {
    try {
      setCancellingOrderId(orderId);
      await apiClient.post<{ order: CreatedOrderResponse }>(`/shop/orders/${orderId}/cancel`, {
        reason: "Cancelled by member from order history",
      });
      await fetchMyOrders();
    } catch (err: any) {
      alert(err?.message || "Failed to cancel order.");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "CONFIRMED" || s === "COMPLETED") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
          {status}
        </span>
      );
    }
    if (s === "PROCESSING" || s === "READY_FOR_PICKUP" || s === "SHIPPED") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-sky-50 text-sky-800 border border-sky-200">
          {status}
        </span>
      );
    }
    if (s === "CANCELLED") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-800 border border-rose-200">
          Cancelled
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <aside aria-label="Member Order History Drawer" className="w-screen max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col pointer-events-auto animate-in slide-in-from-right duration-300 text-slate-900">
          {/* Drawer Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-extrabold text-base text-slate-900 font-[family-name:var(--font-outfit)]">
                  My Pro Shop Orders
                </h2>
                <p className="text-[11px] text-slate-500">
                  Track boutique purchases, fulfillment & invoices
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchMyOrders}
                title="Refresh order history"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close orders"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Orders Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Loading your purchase history...</p>
              </div>
            ) : error ? (
              <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
                <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
                <p className="text-xs text-rose-800">{error}</p>
                <button
                  type="button"
                  onClick={fetchMyOrders}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-rose-700 border border-rose-200"
                >
                  Retry
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3 my-auto">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900">No Pro Shop Orders Found</h3>
                <p className="text-xs text-slate-500 max-w-xs">
                  You have not placed any boutique orders yet. Browse our rackets, balls and club gear.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-sky-600 text-white transition-all shadow-sm"
                >
                  Explore Catalog
                </button>
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
                      className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-2xs"
                    >
                      {/* Top Row: Ref, Date, Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-sky-700">
                              {order.order_reference}
                            </span>
                            {badge}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {new Date(order.created_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-xs text-slate-500 block">Total Amount</span>
                          <span className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                            ₹{order.total_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Items Brief */}
                      <div className="space-y-2">
                        {order.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70"
                          >
                            <div className="truncate pr-2">
                              <span className="font-black text-slate-900 mr-1">
                                {item.quantity}x
                              </span>
                              <span className="font-semibold">{item.product_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono ml-2">
                                ({item.product_sku})
                              </span>
                            </div>
                            <span className="font-bold shrink-0 text-slate-900">
                              ₹{item.total_price.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Fulfillment & Notes info */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          {order.fulfillment_type === "DELIVERY" ? (
                            <>
                              <Truck className="w-3.5 h-3.5 text-sky-600" />
                              <span>Delivery to: {order.delivery_address || "Provided address"}</span>
                            </>
                          ) : (
                            <>
                              <Store className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Club Pro Shop Desk Pickup</span>
                            </>
                          )}
                        </span>

                        <span className="font-bold text-slate-700">
                          Payment: {order.payment_status} ({order.payment_method})
                        </span>
                      </div>

                      {/* Unpaid Action / Cancel Action Row */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        {isUnpaid && order.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onPayUnpaidOrder(order);
                            }}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Now (₹{order.total_amount.toLocaleString()})</span>
                          </button>
                        )}

                        {isCancellable && order.status !== "CANCELLED" && (
                          <button
                            type="button"
                            disabled={cancellingOrderId === order.id}
                            onClick={() => {
                              if (confirm("Are you sure you want to cancel this order and restore stock?")) {
                                handleCancelOrder(order.id);
                              }
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors disabled:opacity-50"
                          >
                            {cancellingOrderId === order.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <span>Cancel Order</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
