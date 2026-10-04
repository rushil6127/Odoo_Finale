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
      <div className="glass-card rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[500px] text-center sticky top-6">
        <div className="w-20 h-20 rounded-full bg-slate-100/50 flex items-center justify-center mb-4 border border-slate-200">
          <Receipt className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-lg font-black text-slate-400 font-[family-name:var(--font-display)]">Select a table</p>
        <p className="text-sm text-slate-500 mt-1">To view orders or open a new tab</p>
      </div>
    );
  }

  if (!currentTab) {
    return (
      <div className="glass-card rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[500px] text-center space-y-6 sticky top-6">
        <div>
          <div className="inline-block p-3 rounded-2xl bg-sky-50 text-sky-500 mb-4 shadow-sm border border-sky-100">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <h2 className="font-black text-2xl text-slate-900 font-[family-name:var(--font-display)]">
            Table {activeTable.table_number}
          </h2>
          <p className="text-sm font-bold text-emerald-500 mt-1 uppercase tracking-wider">Available for Service</p>
        </div>
        <div className="w-full max-w-sm space-y-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Guest Name / Member ID (Optional)" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-shadow shadow-sm"
            />
          </div>
          <button 
            onClick={() => onOpenTab(customerName)}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-xl transition-all shadow-md shadow-sky-600/30 transform hover:-translate-y-0.5"
          >
            Start New Tab
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
  const pendingTax = cart.reduce((acc, item) => acc + (item.price * item.tax_rate) * item.qty, 0);
  
  const displaySubtotal = (Number(currentTab.subtotal_amount) || 0) + pendingSubtotal;
  const displayTax = (Number(currentTab.tax_amount) || 0) + pendingTax;
  const displayTotal = displaySubtotal + displayTax - (Number(currentTab.discount_amount) || 0);

  return (
    <div className="glass-card rounded-3xl p-6 shadow-md shadow-slate-200/50 space-y-5 sticky top-6 flex flex-col max-h-[85vh] relative overflow-hidden">
      {/* Decorative accent */}
      <div className={`absolute top-0 left-0 w-full h-1 ${
        currentTab.status === "OPEN" ? "bg-sky-500" :
        currentTab.status === "PAID" ? "bg-emerald-500" :
        "bg-slate-300"
      }`}></div>

      <div className="flex items-start justify-between border-b border-slate-200/60 pb-4 shrink-0 mt-1">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className={`w-5 h-5 ${currentTab.status === "PAID" ? "text-emerald-500" : "text-sky-600"}`} />
            <h2 className="font-black text-base text-slate-900 font-[family-name:var(--font-display)]">
              TABLE {activeTable.table_number}
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 uppercase font-bold tracking-wider">Ref: {currentTab.tab_reference}</p>
          <p className="text-xs text-slate-600 font-bold mt-1 bg-slate-50 inline-block px-2 py-1 rounded-md border border-slate-100">
            {currentTab.customer_name || (currentTab.member_id ? `Member #${currentTab.member_id}` : "Guest")}
          </p>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm border ${
            currentTab.status === "OPEN" ? "bg-sky-50 text-sky-700 border-sky-200" :
            currentTab.status === "PAID" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            "bg-slate-50 text-slate-600 border-slate-200"
          }`}>
            {currentTab.status}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-[200px] custom-scrollbar">
        {/* Saved Items */}
        {currentTab.items && currentTab.items.length > 0 && (
          <div className="space-y-2.5">
            {currentTab.items.map((item) => (
              <div key={item.id} className="flex flex-col p-3 rounded-xl bg-white border border-slate-100 shadow-sm gap-1.5 transition-colors hover:border-sky-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-black text-slate-900">{item.item_name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">₹{item.unit_price} × {item.quantity}</p>
                  </div>
                  <span className="text-sm font-black text-slate-900">₹{item.total_amount}</span>
                </div>
                <div className="flex justify-between items-center mt-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    item.kitchen_status === "PENDING" ? "bg-slate-100 text-slate-600 border border-slate-200" :
                    item.kitchen_status === "QUEUED" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                    item.kitchen_status === "PREPARING" ? "bg-sky-50 text-sky-600 border border-sky-200 animate-pulse" :
                    item.kitchen_status === "READY" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                    item.kitchen_status === "SERVED" ? "bg-slate-50 text-slate-400 border border-slate-100" :
                    "bg-red-50 text-red-600 border border-red-200"
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
          <div className="space-y-2.5 mt-4">
            <div className="flex items-center gap-2 pt-3 border-t border-dashed border-amber-200">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
              <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                Unsaved Items
              </h4>
            </div>
            
            {cart.map((item) => (
              <div key={`cart-${item.id}`} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100 shadow-sm">
                <div className="flex-1">
                  <p className="text-[11px] font-black text-slate-900">{item.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">₹{item.price} each</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                    <button onClick={() => onUpdateCartQty(item.id, -1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"><Minus className="w-3 h-3"/></button>
                    <span className="text-xs font-black px-1.5 min-w-[20px] text-center">{item.qty}</span>
                    <button onClick={() => onUpdateCartQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-md transition-colors"><Plus className="w-3 h-3"/></button>
                  </div>
                  <span className="text-[12px] font-black text-slate-900 w-12 text-right">₹{item.price * item.qty}</span>
                  <button onClick={() => onUpdateCartQty(item.id, -item.qty)} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {(!currentTab.items || currentTab.items.length === 0) && cart.length === 0 && (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <UtensilsCrossed className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">Tab is empty</p>
            <p className="text-xs mt-1 text-slate-400">Add items from the menu</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200/60 pt-4 space-y-2.5 text-xs shrink-0">
        <div className="flex justify-between text-slate-500 font-medium px-1">
          <span>Subtotal</span>
          <span className="font-bold text-slate-800">₹{displaySubtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-500 font-medium px-1">
          <span>Taxes & Fees</span>
          <span>₹{displayTax.toFixed(2)}</span>
        </div>
        {Number(currentTab.discount_amount) > 0 && (
          <div className="flex justify-between text-emerald-600 font-bold px-1 bg-emerald-50 rounded px-2 py-1">
            <span>Discount</span>
            <span>-₹{Number(currentTab.discount_amount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-3 pb-1 border-t border-slate-100 mt-2 px-1">
          <span className="uppercase tracking-wide text-xs">Total</span>
          <span className="text-sky-600 font-[family-name:var(--font-display)] text-xl">
            ₹{displayTotal.toFixed(2)}
          </span>
        </div>
        
        {cart.length > 0 && (
          <p className="text-[11px] font-bold text-amber-600 bg-amber-50 py-1.5 px-3 rounded-lg text-right">
            + ₹{pendingSubtotal.toFixed(2)} in unsaved items (Included above)
          </p>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          {currentTab.status === "OPEN" && (
            <>
              <button
                type="button"
                onClick={onSendToKitchen}
                disabled={cart.length === 0}
                className={`py-3 px-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all ${
                  cart.length > 0
                    ? "bg-amber-500 hover:bg-amber-400 text-white shadow-md shadow-amber-500/20 transform hover:-translate-y-0.5"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                }`}
              >
                <ChefHat className="w-4 h-4" />
                <span>Save & Send {cart.length > 0 ? `(${cart.length})` : ""}</span>
              </button>

              <button
                type="button"
                onClick={onPay}
                disabled={cart.length > 0 || (currentTab.items?.length === 0)}
                className={`py-3 px-2 rounded-xl font-black text-[12px] flex items-center justify-center gap-2 transition-all ${
                  cart.length > 0 || (currentTab.items?.length === 0)
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transform hover:-translate-y-0.5"
                }`}
                title={cart.length > 0 ? "Save pending items first" : "Settle Bill"}
              >
                <Wallet className="w-4 h-4" />
                <span>Settle Bill</span>
              </button>
            </>
          )}

          {isPaid && (
            <button
              type="button"
              onClick={onCloseTab}
              className="col-span-2 py-3.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-xl shadow-md shadow-sky-600/30 transition-all transform hover:-translate-y-0.5"
            >
              Close Tab & Free Table
            </button>
          )}

          {currentTab.status === "OPEN" && cart.length === 0 && (!currentTab.items || currentTab.items.length === 0) && (
            <button
              type="button"
              onClick={() => onVoidTab("Empty tab voided")}
              className="col-span-2 py-2.5 mt-2 text-red-500 hover:bg-red-50 font-bold text-xs rounded-xl transition-colors border border-transparent hover:border-red-100"
            >
              Void Empty Tab
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
