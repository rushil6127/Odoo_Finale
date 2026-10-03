"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PosMenuCategory, PosMenuItem } from "./types";

interface MenuCatalogueProps {
  categories: PosMenuCategory[];
  menuItems: PosMenuItem[];
  onAddItem: (item: PosMenuItem) => void;
  disabled: boolean;
}

export default function MenuCatalogue({ categories, menuItems, onAddItem, disabled }: MenuCatalogueProps) {
  const [selectedCatId, setSelectedCatId] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = menuItems.filter((item) => {
    if (selectedCatId !== "ALL" && item.category_id !== selectedCatId) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center">
        <input 
          type="text" 
          placeholder="Search food, drinks or snacks..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-3 py-1.5"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCatId("ALL")}
          className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all ${
            selectedCatId === "ALL"
              ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          🌟 All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all ${
              selectedCatId === cat.id
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 text-slate-400 text-sm">
          No menu items found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {filteredItems.map((item) => {
            const isUnavailable = !item.is_available;
            
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!isUnavailable && !disabled) {
                    onAddItem(item);
                  }
                }}
                className={`group bg-white p-4 rounded-2xl border shadow-sm transition-all flex items-center justify-between ${
                  isUnavailable || disabled
                    ? "opacity-60 border-slate-200 cursor-not-allowed" 
                    : "border-slate-200 hover:border-sky-400 hover:shadow-md cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 shrink-0 font-bold uppercase text-xs">
                    {item.name.substring(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-black text-slate-900 leading-tight">{item.name}</h3>
                    </div>
                    {item.description && (
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1" title={item.description}>{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs font-black text-emerald-600">₹{item.price}</p>
                      {isUnavailable && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUnavailable || disabled}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    isUnavailable || disabled
                      ? "bg-slate-100 text-slate-400"
                      : "bg-slate-100 group-hover:bg-sky-600 group-hover:text-white text-slate-700"
                  }`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
