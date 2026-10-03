"use client";

import { PosTable } from "./types";

interface TableSelectorProps {
  tables: PosTable[];
  activeTable: PosTable | null;
  onSelectTable: (table: PosTable) => void;
}

export default function TableSelector({ tables, activeTable, onSelectTable }: TableSelectorProps) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
      <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-2">Tables:</span>
      
      {tables.length === 0 ? (
        <span className="text-xs text-slate-400">Loading tables...</span>
      ) : (
        tables.map((t) => {
          const isActive = activeTable?.id === t.id;
          const isOccupied = t.status === "OCCUPIED";
          const isReserved = t.status === "RESERVED";
          const isOutOfService = t.status === "OUT_OF_SERVICE";

          let statusClasses = "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent";
          if (isActive) {
            statusClasses = "bg-slate-900 text-white shadow-md shadow-slate-900/20 border-slate-900";
          } else if (isOccupied) {
            statusClasses = "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100";
          } else if (isReserved) {
            statusClasses = "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100";
          } else if (isOutOfService) {
            statusClasses = "bg-slate-50 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed";
          }

          return (
            <button
              key={t.id}
              type="button"
              disabled={isOutOfService}
              onClick={() => onSelectTable(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${statusClasses}`}
            >
              <span>{t.table_number}</span>
              {isOccupied && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
              )}
              {isReserved && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
