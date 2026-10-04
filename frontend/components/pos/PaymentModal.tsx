"use client";

import { useState } from "react";
import { Receipt, QrCode, Wallet, CreditCard, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { PosTab } from "./types";

interface PaymentModalProps {
  currentTab: PosTab;
  onClose: () => void;
  onPaymentSuccess: (updatedTab: PosTab) => void;
}

export default function PaymentModal({ currentTab, onClose, onPaymentSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePayment = async (method: "CASH" | "CARD" | "UPI") => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const updatedTab = await apiClient.post<PosTab>(`/pos/tabs/${currentTab.id}/pay`, {
        payment_method: method
      });
      if (updatedTab) {
        setSuccess(true);
        setTimeout(() => {
          onPaymentSuccess(updatedTab);
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Unable to complete payment. The server did not record this payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h3 className="font-black text-base">Settle POS Tab • {currentTab.table_number || "Walk-in"}</h3>
          </div>
          {!loading && !success && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl animate-in zoom-in">
              ✓
            </div>
            <h4 className="font-black text-lg text-slate-900">Payment Recorded</h4>
            <p className="text-xs text-slate-500">
              ₹{currentTab.total_amount} settled for {currentTab.tab_reference}.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl">
                {errorMsg}
              </div>
            )}
            
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
              <div>
                <p className="text-[11px] text-slate-500 font-bold uppercase">Total Due</p>
                <p className="text-2xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  ₹{currentTab.total_amount}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                Ready for Checkout
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-slate-700">Select Settlement Method:</p>

              <button
                type="button"
                disabled={loading}
                onClick={() => handlePayment("UPI")}
                className="w-full p-3 rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="w-5 h-5 text-sky-600" />
                  <div className="text-left">
                    <p className="font-black text-slate-900">Instant UPI QR Code</p>
                    <p className="text-[11px] text-slate-500">GPay, PhonePe, Paytm</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handlePayment("CASH")}
                className="w-full p-3 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-black text-slate-900">Cash Payment</p>
                    <p className="text-[11px] text-slate-500">Receive cash over counter</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handlePayment("CARD")}
                className="w-full p-3 rounded-2xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                  <div className="text-left">
                    <p className="font-black text-slate-900">Credit / Debit Card Terminal</p>
                    <p className="text-[11px] text-slate-500">Tap to pay on POS machine</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
