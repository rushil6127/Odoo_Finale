/**
 * Champions Club — Pro Shop Category Bar, Live Search & Sorter
 * Luxury Light Theme matching Champions Club design system
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
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
        <button
          type="button"
          onClick={() => onSelectCategory("ALL")}
          className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all duration-200 ${
            selectedCategory === "ALL"
              ? "bg-slate-900 text-white shadow-sm scale-[1.02]"
              : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
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
                  ? "bg-slate-900 text-white shadow-sm scale-[1.02]"
                  : "bg-white text-slate-700 border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search, Sort & Availability Row */}
      <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search gear by name, brand, SKU or specification..."
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
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
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              inStockOnly
                ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <div
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                inStockOnly
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-slate-300 bg-white"
              }`}
            >
              {inStockOnly && <Check className="w-3 h-3 stroke-[3]" />}
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
                className="appearance-none pl-8 pr-8 py-2.5 rounded-xl text-xs font-bold bg-slate-50 border border-slate-200 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer transition-all"
              >
                <option value="featured">Featured Catalog</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="stock">Highest Stock</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <span className="text-[11px] font-bold text-slate-500 hidden lg:inline pl-1">
            {totalProductsCount} item{totalProductsCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
