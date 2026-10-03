/**
 * Champions Club — Stock Insufficiency Error Banner & Refresh Trigger
 */

"use client";

import { AlertCircle, RotateCcw, X } from "lucide-react";

interface StockErrorBannerProps {
  errorMessage: string | null;
  onClear: () => void;
  onRefresh: () => void;
}

export default function StockErrorBanner({
  errorMessage,
  onClear,
  onRefresh,
}: StockErrorBannerProps) {
  if (!errorMessage) return null;

  return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-300">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-black text-white font-[family-name:var(--font-outfit)]">
            Inventory Stock Conflict
          </h4>
          <p className="text-xs text-rose-300 mt-0.5 leading-relaxed">{errorMessage}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Real Stock</span>
        </button>
        <button
          type="button"
          onClick={onClear}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
