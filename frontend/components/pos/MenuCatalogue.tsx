"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { PosMenuCategory, PosMenuItem } from "./types";

const ITEM_IMAGES: Record<string, string> = {
  "B01": "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=150&q=80", // Espresso
  "B02": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=150&q=80", // Latte
  "B03": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=150&q=80", // Cold Brew
  "S01": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=150&q=80", // Fries
  "S02": "https://images.unsplash.com/photo-1582169505937-b9992bd01ed9?w=150&q=80", // Nachos
  "S03": "https://images.unsplash.com/photo-1639024471283-03518883512d?w=150&q=80", // Onion Rings
  "M01": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=150&q=80", // Sandwich
  "M02": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=150&q=80", // Burger
  "M03": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=150&q=80", // Salad
};

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
    <div className="space-y-5">
      <div className="glass-card p-3 rounded-2xl flex items-center shadow-sm">
        <Search className="w-5 h-5 text-sky-400 ml-2" />
        <input 
          type="text" 
          placeholder="Search food, drinks or snacks..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-sm px-4 py-2 font-medium"
        />
      </div>

      <div className="flex flex-wrap gap-2.5">
        <button
          onClick={() => setSelectedCatId("ALL")}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all transform hover:-translate-y-0.5 ${
            selectedCatId === "ALL"
              ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30 border border-sky-500"
              : "glass-card text-slate-600 hover:text-sky-600 hover:border-sky-300"
          }`}
        >
          🌟 All Items
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all transform hover:-translate-y-0.5 ${
              selectedCatId === cat.id
                ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30 border border-sky-500"
                : "glass-card text-slate-600 hover:text-sky-600 hover:border-sky-300"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl text-slate-400 text-sm flex flex-col items-center justify-center">
          <Search className="w-8 h-8 text-slate-300 mb-3" />
          <p className="font-bold">No menu items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className={`group p-4 rounded-2xl transition-all flex items-center justify-between ${
                  isUnavailable || disabled
                    ? "opacity-60 bg-slate-50 border border-slate-200 cursor-not-allowed" 
                    : "glass-card glass-card-hover cursor-pointer border-transparent"
                }`}
              >
                <div className="flex items-center gap-4">
                  {ITEM_IMAGES[item.code] ? (
                    <img src={ITEM_IMAGES[item.code]} alt={item.name} className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0 border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-50 to-indigo-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0 font-black uppercase text-sm shadow-sm group-hover:shadow-md transition-shadow">
                      {item.name.substring(0, 2)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-black text-slate-900 leading-tight font-[family-name:var(--font-display)] tracking-tight">{item.name}</h3>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 font-medium" title={item.description}>{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <p className="text-sm font-black text-emerald-600">₹{item.price}</p>
                      {isUnavailable && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">
                          Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isUnavailable || disabled}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all transform ${
                    isUnavailable || disabled
                      ? "bg-slate-100 text-slate-400"
                      : "bg-sky-50 group-hover:bg-sky-500 group-hover:text-white text-sky-600 shadow-sm group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:scale-105"
                  }`}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
