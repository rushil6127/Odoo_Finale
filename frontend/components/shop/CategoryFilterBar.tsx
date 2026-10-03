/**
 * Champions Club — Pro Shop Category Bar, Live Search & Sorter
 */

"use client";

import {
  Search,
  X,
  Sparkles,
  ArrowUpDown,
  Check,
} from "lucide-react";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  icon?: any;
}

interface CategoryFilterBarProps {
  categories: CategoryOption[];
  selectedCategory: string;
  onSelectCategory: (slug: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: "featured" | "price_asc" | "price_desc" | "stock";
  onSortChange: (sort: "featured" | "price_asc" | "price_desc" | "stock") => void;
  inStockOnly: boolean;
  onToggleInStockOnly: () => void;
  totalProductsCount: number;
}

export default function CategoryFilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  inStockOnly,
  onToggleInStockOnly,
  totalProductsCount,
}: CategoryFilterBarProps) {
  return (
    <div className="space-y-4">
      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none select-none">
        <button
          type="button"
          onClick={() => onSelectCategory("ALL")}
          className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all duration-200 ${
            selectedCategory === "ALL"
              ? "bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-[1.02]"
              : "bg-slate-900/90 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>All Collection</span>
        </button>

        {categories.map((cat) => {
          const isActive = selectedCategory === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-[1.02]"
                  : "bg-slate-900/90 text-slate-300 border border-slate-800 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search, Sort & Availability Row */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search gear by name, brand, SKU or specification..."
            className="w-full pl-9 pr-9 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Controls: In-Stock Toggle & Sort */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between md:justify-end">
          {/* In-Stock Toggle */}
          <button
            type="button"
            onClick={onToggleInStockOnly}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              inStockOnly
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                inStockOnly
                  ? "bg-emerald-500 border-emerald-500 text-slate-950"
                  : "border-slate-700 bg-slate-900"
              }`}
            >
              {inStockOnly && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span>In Stock Only</span>
          </button>

          {/* Sort Dropdown */}
          <div className="relative inline-flex items-center">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as any)}
                aria-label="Sort products"
                className="appearance-none pl-8 pr-8 py-2 rounded-xl text-xs font-bold bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
              >
                <option value="featured">Featured Catalog</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="stock">Highest Stock</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <span className="text-[11px] font-bold text-slate-500 hidden lg:inline">
            {totalProductsCount} item{totalProductsCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
