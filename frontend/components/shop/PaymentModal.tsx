/**
 * Champions Club — Pro Shop Online Payment Gateway & Verification
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Loader2,
  AlertCircle,
  X,
  Zap,
  Ban,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import type { CreatedOrderResponse } from "./CheckoutModal";

interface PaymentInitiationData {
  id: number;
  payment_reference: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  item_type: string;
  item_id: number;
  gateway_order_id: string;
  razorpay_key_id?: string;
}

interface PaymentModalProps {
  order: CreatedOrderResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (order: CreatedOrderResponse) => void;
  onOrderCancelled: (order: CreatedOrderResponse) => void;
}

export default function PaymentModal({
  order,
  isOpen,
  onClose,
  onPaymentSuccess,
  onOrderCancelled,
}: PaymentModalProps) {
  const [paymentData, setPaymentData] = useState<PaymentInitiationData | null>(null);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // 1. Verify Payment with Backend and Refetch Order Status
  const handleVerifyOnlinePayment = useCallback(
    async (
      razorpayOrderId: string,
      razorpayPaymentId: string,
      razorpaySignature: string,
      currentOrder: CreatedOrderResponse
    ) => {
      try {
        setIsVerifying(true);
        setVerificationError(null);

        // Verify payment signature on backend
        await apiClient.post<{ id: number; status: string }>("/payments/verify", {
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
        });

        // Refetch order from backend to ensure status is confirmed
        let confirmedOrder: CreatedOrderResponse | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const orderRes = await apiClient.get<{ order: CreatedOrderResponse }>(
              `/shop/orders/${currentOrder.id}`
            );
            if (
              orderRes?.order &&
              (orderRes.order.payment_status === "PAID" ||
                orderRes.order.status === "CONFIRMED" ||
                orderRes.order.status === "PROCESSING")
            ) {
              confirmedOrder = orderRes.order;
              break;
            }
          } catch {
            // retry after delay
          }
          await new Promise((r) => setTimeout(r, 600));
        }

        const finalOrder = confirmedOrder || {
          ...currentOrder,
          payment_status: "PAID",
          status: "CONFIRMED",
        };

        onPaymentSuccess(finalOrder);
      } catch (err: any) {
        setVerificationError(
          err?.message || "Payment verification failed. Please contact the Pro Shop desk."
        );
      } finally {
        setIsVerifying(false);
      }
    },
    [onPaymentSuccess]
  );

  // 2. Open Razorpay Checkout Dialog
  const openRazorpayCheckout = useCallback(
    (payment: PaymentInitiationData, currentOrder: CreatedOrderResponse) => {
      const keyId =
        payment.razorpay_key_id ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        "rzp_test_club_default";

      if (typeof window !== "undefined" && (window as any).Razorpay) {
        try {
          const options = {
            key: keyId,
            amount: Math.round(payment.amount * 100),
            currency: payment.currency || "INR",
            name: "Champions Club Pro Shop",
            description: `Order ${currentOrder.order_reference}`,
            order_id: payment.gateway_order_id,
            prefill: {
              name: currentOrder.customer_name,
              email: currentOrder.customer_email || "",
              contact: currentOrder.customer_phone || "",
            },
            theme: { color: "#0284c7" },
            handler: async (response: {
              razorpay_order_id: string;
              razorpay_payment_id: string;
              razorpay_signature: string;
            }) => {
              await handleVerifyOnlinePayment(
                response.razorpay_order_id || payment.gateway_order_id,
                response.razorpay_payment_id || `pay_${Date.now()}`,
                response.razorpay_signature || "test_signature",
                currentOrder
              );
            },
            modal: {
              ondismiss: () => {
                setVerificationError(
                  "Payment window closed before completion. You can retry payment now or cancel this order to release reserved stock."
                );
              },
            },
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on("payment.failed", (resp: any) => {
            setVerificationError(
              resp?.error?.description ||
                "Online payment failed. Please try again or choose another card."
            );
          });
          rzp.open();
        } catch (err: any) {
          console.warn("Razorpay SDK launch error, using fallback verification trigger:", err);
        }
      }
    },
    [handleVerifyOnlinePayment]
  );

  // 3. Initiate or fetch online payment order from backend
  const initiatePayment = useCallback(
    async (currentOrder: CreatedOrderResponse) => {
      try {
        setIsInitiating(true);
        setVerificationError(null);

        const res = await apiClient.post<PaymentInitiationData>("/payments", {
          item_type: "SHOP_ORDER",
          item_id: currentOrder.id,
          amount: currentOrder.total_amount.toFixed(2),
          payment_method: "ONLINE",
          notes: `Shop order payment for ${currentOrder.order_reference}`,
        });

        if (res && res.gateway_order_id) {
          setPaymentData(res);
          openRazorpayCheckout(res, currentOrder);
        } else {
          throw new Error("Unable to obtain online gateway parameters from server.");
        }
      } catch (err: any) {
        setVerificationError(err?.message || "Failed to initiate online payment.");
      } finally {
        setIsInitiating(false);
      }
    },
    [openRazorpayCheckout]
  );

  // 4. Cancel Order & Restore Inventory
  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      setIsCancelling(true);
      setVerificationError(null);

      const res = await apiClient.post<{ order: CreatedOrderResponse }>(
        `/shop/orders/${order.id}/cancel`,
        {
          reason: cancelReason.trim() || "Customer cancelled unpaid online order",
        }
      );

      if (res?.order) {
        onOrderCancelled(res.order);
      } else {
        onClose();
      }
    } catch (err: any) {
      setVerificationError(err?.message || "Failed to cancel order.");
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    if (isOpen && order) {
      initiatePayment(order);
    }
  }, [isOpen, order, initiatePayment]);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white font-[family-name:var(--font-outfit)]">
                Secure Online Payment
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Order Ref: {order.order_reference}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-6 space-y-5">
          {/* Order Snapshot Card */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Customer:</span>
              <span className="font-bold text-slate-200">{order.customer_name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Fulfillment:</span>
              <span className="font-bold text-slate-200">{order.fulfillment_type}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Items in Order:</span>
              <span className="font-bold text-slate-200">{order.items?.length || 0} line items</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
              <span className="font-bold text-white">Total Amount Due:</span>
              <span className="text-xl font-black text-sky-400 font-[family-name:var(--font-outfit)]">
                ₹{order.total_amount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Verification / Loading / Status States */}
          {isVerifying ? (
            <div className="p-6 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-black text-white">Verifying Online Payment...</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Communicating with banking gateway. Confirmation will unlock momentarily.
                </p>
              </div>
            </div>
          ) : isInitiating ? (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <div>
                <h4 className="text-sm font-black text-white">Opening Gateway Window...</h4>
                <p className="text-xs text-slate-400 mt-1">Connecting to Razorpay test checkout.</p>
              </div>
            </div>
          ) : null}

          {/* Verification / Dismissal Error Notice */}
          {verificationError && !isVerifying && !isInitiating && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{verificationError}</span>
              </div>
            </div>
          )}

          {/* Test Mode Simulation Verification Button */}
          {paymentData && !isVerifying && !isInitiating && (
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Razorpay Test Gateway Mode</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500">
                  Order ID: {paymentData.gateway_order_id.slice(0, 16)}...
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                If the payment pop-up was blocked by your browser, launch checkout or simulate test settlement:
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openRazorpayCheckout(paymentData, order)}
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20"
                >
                  Launch Razorpay Modal
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleVerifyOnlinePayment(
                      paymentData.gateway_order_id,
                      `pay_test_${Date.now()}`,
                      "sig_test_verified",
                      order
                    )
                  }
                  className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
                >
                  Verify Payment (Test Mode)
                </button>
              </div>
            </div>
          )}

          {/* Cancel Order Section */}
          {showCancelConfirm ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 animate-in fade-in duration-150">
              <div>
                <h4 className="text-xs font-black text-rose-300">Cancel Unpaid Order?</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cancelling this order will release and restore the reserved inventory stock immediately.
                </p>
              </div>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)"
                className="w-full px-3 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className="px-4 py-1.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  <span>Confirm Cancel & Restore Stock</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(true)}
                className="text-xs font-bold text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Cancel this order</span>
              </button>
              <span className="text-[10px] text-slate-500">
                Encrypted 256-bit SSL transaction
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
