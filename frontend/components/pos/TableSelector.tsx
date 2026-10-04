"use client";

import { PosTable } from "./types";

interface TableSelectorProps {
  tables: PosTable[];
  activeTable: PosTable | null;
  onSelectTable: (table: PosTable) => void;
}

export default function TableSelector({ tables, activeTable, onSelectTable }: TableSelectorProps) {
  return (
    <div className="glass-card p-5 rounded-3xl flex flex-wrap items-center gap-3 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-400"></div>
      <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-2">Select Table:</span>
      
      {tables.length === 0 ? (
        <span className="text-xs text-slate-400">Loading tables...</span>
      ) : (
        <div className="flex flex-wrap gap-2 w-full mt-2">
          {tables.map((t) => {
            const isActive = activeTable?.id === t.id;
            const isOccupied = t.status === "OCCUPIED";
            const isReserved = t.status === "RESERVED";
            const isOutOfService = t.status === "OUT_OF_SERVICE";
            const isAvailable = t.status === "AVAILABLE";

            let statusClasses = "";
            
            if (isActive) {
              statusClasses = "bg-slate-900 text-white shadow-lg shadow-slate-900/30 border-slate-900 transform scale-105";
            } else if (isAvailable) {
              statusClasses = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 shadow-sm hover:shadow-md";
            } else if (isOccupied) {
              statusClasses = "bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 shadow-sm hover:shadow-md";
            } else if (isReserved) {
              statusClasses = "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-sm";
            } else if (isOutOfService) {
              statusClasses = "bg-slate-50 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed";
            }

            return (
              <button
                key={t.id}
                type="button"
                disabled={isOutOfService}
                onClick={() => onSelectTable(t)}
                className={`px-4 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2 border ${statusClasses}`}
              >
                <span>{t.table_number}</span>
                {isOccupied && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-sky-500 inline-block animate-pulse" />
                )}
                {isReserved && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                )}
                {isAvailable && !isActive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
