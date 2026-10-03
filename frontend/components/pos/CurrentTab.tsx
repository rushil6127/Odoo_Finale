"use client";

import { useState } from "react";
import { Receipt, Trash2, Minus, Plus, ChefHat, Wallet, Clock, UtensilsCrossed } from "lucide-react";
import { PosTable, PosTab, CartItem } from "./types";

interface CurrentTabProps {
  activeTable: PosTable | null;
  currentTab: PosTab | null;
  cart: CartItem[];
  onOpenTab: (customerName: string) => void;
  onUpdateCartQty: (id: number, delta: number) => void;
  onSendToKitchen: () => void;
  onPay: () => void;
  onCloseTab: () => void;
  onVoidTab: (reason: string) => void;
}

export default function CurrentTab({
  activeTable,
  currentTab,
  cart,
  onOpenTab,
  onUpdateCartQty,
  onSendToKitchen,
  onPay,
  onCloseTab,
  onVoidTab
}: CurrentTabProps) {
  const [customerName, setCustomerName] = useState("");

  if (!activeTable) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center min-h-[400px] text-center sticky top-6">
        <Receipt className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-400">Select a table to begin</p>
      </div>
    );
  }

  if (!currentTab) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center justify-center min-h-[400px] text-center space-y-4 sticky top-6">
        <div>
          <h2 className="font-black text-lg text-slate-900 font-[family-name:var(--font-outfit)]">
            Table {activeTable.table_number}
          </h2>
          <p className="text-xs text-slate-500">Currently Available</p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <input 
            type="text" 
            placeholder="Guest / Customer Name (Optional)" 
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
          />
          <button 
            onClick={() => onOpenTab(customerName)}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition"
          >
            Open New Tab
          </button>
        </div>
      </div>
    );
  }

  const isPaid = currentTab.status === "PAID";
  const isClosed = currentTab.status === "CLOSED";
  const isVoided = currentTab.status === "VOIDED";
  const readOnly = isPaid || isClosed || isVoided;

  // Local pending calculations
  const pendingSubtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5 sticky top-6 flex flex-col max-h-[85vh]">
      <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-sky-600" />
            <h2 className="font-black text-sm text-slate-900 font-[family-name:var(--font-outfit)]">
              CURRENT TAB • {activeTable.table_number}
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Tab {currentTab.tab_reference}</p>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">
            Customer: {currentTab.customer_name || (currentTab.member_id ? `Member #${currentTab.member_id}` : "Guest")}
          </p>
        </div>
        <div className="text-right">
          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
            currentTab.status === "OPEN" ? "bg-amber-100 text-amber-800" :
            currentTab.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
            "bg-slate-100 text-slate-600"
          }`}>
            {currentTab.status}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[200px]">
        {/* Saved Items */}
        {currentTab.items && currentTab.items.length > 0 && (
          <div className="space-y-2">
            {currentTab.items.map((item) => (
              <div key={item.id} className="flex flex-col p-2.5 rounded-xl bg-slate-50 border border-slate-100 gap-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black text-slate-900">{item.item_name}</p>
                    <p className="text-[10px] text-slate-500">₹{item.unit_price} × {item.quantity}</p>
                  </div>
                  <span className="text-xs font-black text-slate-900">₹{item.total_amount}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    item.kitchen_status === "PENDING" ? "bg-slate-200 text-slate-600" :
                    item.kitchen_status === "READY" ? "bg-emerald-100 text-emerald-700" :
                    item.kitchen_status === "SERVED" ? "bg-slate-100 text-slate-400" :
                    "bg-sky-100 text-sky-700"
                  }`}>
                    {item.kitchen_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending Cart Items */}
        {cart.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider pt-2 border-t border-amber-100">
              Unsaved Items
            </h4>
            {cart.map((item) => (
              <div key={`cart-${item.id}`} className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex-1">
                  <p className="text-[11px] font-black text-slate-900">{item.name}</p>
                  <p className="text-[10px] text-slate-500">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1 shadow-sm">
                    <button onClick={() => onUpdateCartQty(item.id, -1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-black text-xs"><Minus className="w-2.5 h-2.5"/></button>
                    <span className="text-xs font-black px-1">{item.qty}</span>
                    <button onClick={() => onUpdateCartQty(item.id, 1)} className="w-5 h-5 flex items-center justify-center text-slate-500 hover:text-slate-900 font-black text-xs"><Plus className="w-2.5 h-2.5"/></button>
                  </div>
                  <span className="text-[11px] font-black text-slate-900 w-12 text-right">₹{item.price * item.qty}</span>
                  <button onClick={() => onUpdateCartQty(item.id, -item.qty)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(!currentTab.items || currentTab.items.length === 0) && cart.length === 0 && (
          <div className="py-10 text-center text-slate-400">
            <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">Tab is empty</p>
            <p className="text-[11px]">Add items from the menu</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3 space-y-2 text-xs shrink-0 bg-white">
        <div className="flex justify-between text-slate-500">
          <span>Subtotal</span>
          <span className="font-bold text-slate-800">₹{currentTab.subtotal_amount}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>GST & Taxes</span>
          <span>₹{currentTab.tax_amount}</span>
        </div>
        {currentTab.discount_amount > 0 && (
          <div className="flex justify-between text-emerald-600 font-bold">
            <span>Discount</span>
            <span>-₹{currentTab.discount_amount}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
          <span>Total (Backend Authoritative)</span>
          <span className="text-emerald-600 font-[family-name:var(--font-outfit)] text-base">
            ₹{currentTab.total_amount}
          </span>
        </div>
        
        {cart.length > 0 && (
          <p className="text-[10px] text-amber-600 italic text-right mt-1">
            + ₹{pendingSubtotal} in unsaved items
          </p>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-3">
          {currentTab.status === "OPEN" && (
            <>
              <button
                type="button"
                onClick={onSendToKitchen}
                disabled={cart.length === 0}
                className={`py-2.5 px-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                  cart.length > 0
                    ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Save & Send ({cart.length})</span>
              </button>

              <button
                type="button"
                onClick={onPay}
                disabled={cart.length > 0 || (currentTab.items?.length === 0)}
                className={`py-2.5 px-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                  cart.length > 0 || (currentTab.items?.length === 0)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20"
                }`}
                title={cart.length > 0 ? "Save pending items first" : "Settle Bill"}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Settle Bill</span>
              </button>
            </>
          )}

          {isPaid && (
            <button
              type="button"
              onClick={onCloseTab}
              className="col-span-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition"
            >
              Close Tab & Free Table
            </button>
          )}

          {currentTab.status === "OPEN" && cart.length === 0 && (!currentTab.items || currentTab.items.length === 0) && (
            <button
              type="button"
              onClick={() => onVoidTab("Empty tab voided")}
              className="col-span-2 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-xs rounded-xl transition"
            >
              Void Empty Tab
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
