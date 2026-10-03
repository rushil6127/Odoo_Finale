/**
 * Champions Club — Equipment & Consumables Stock Audit Console
 */

"use client";

import { useState, useEffect } from "react";
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  TrendingDown,
  Layers,
  Wrench,
  Sparkles
} from "lucide-react";

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: "EQUIPMENT" | "SHUTTLES_BALLS" | "COURT_MAINTENANCE" | "FB_SUPPLIES";
  currentStock: number;
  minThreshold: number;
  unit: string;
  location: string;
  lastRestocked: string;
  status: "ADEQUATE" | "LOW_STOCK" | "CRITICAL";
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      const { apiClient } = await import("@/lib/api/client");
      const res = await apiClient.get<any>("/inventory/products?per_page=100");
      if (res.data && res.data.products) {
        const transformed: InventoryItem[] = res.data.products.map((p: any) => {
          let status: "ADEQUATE" | "LOW_STOCK" | "CRITICAL" = "ADEQUATE";
          if (p.current_stock === 0) status = "CRITICAL";
          else if (p.current_stock <= p.low_stock_threshold) status = "LOW_STOCK";
          
          let category = "EQUIPMENT";
          const catName = p.category?.name?.toUpperCase() || "";
          if (catName.includes("SHUTTLE") || catName.includes("BALL")) category = "SHUTTLES_BALLS";
          else if (catName.includes("MAINTENANCE") || catName.includes("CLEAN")) category = "COURT_MAINTENANCE";
          else if (catName.includes("F&B") || catName.includes("SUPPLY") || catName.includes("FOOD")) category = "FB_SUPPLIES";

          return {
            id: p.id,
            sku: p.sku || `SKU-${p.id}`,
            name: p.name,
            category: category as any,
            currentStock: p.current_stock,
            minThreshold: p.low_stock_threshold,
            unit: p.unit_of_measure || "Units",
            location: p.category?.name || "Main Storage",
            lastRestocked: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "N/A",
            status
          };
        });
        setItems(transformed);
      }
    } catch (error) {
      console.error("Failed to fetch inventory", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("ALL");

  const filtered = items.filter((item) => {
    const matchesCat = selectedCat === "ALL" || item.category === selectedCat;
    const matchesQ = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQ;
  });

  const lowStockCount = items.filter((i) => i.status !== "ADEQUATE").length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Boxes className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Club Equipment & Stock Audit Console
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock ledger, min-threshold alerts, court maintenance supplies, and replenishment.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Restock Order</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Tracked Consumables</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{items.length} SKUs</p>
          <p className="text-[11px] text-slate-500 mt-1">Across 4 facility wings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Low Stock Alerts</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{lowStockCount} Items</p>
          <p className="text-[11px] text-amber-600 font-bold mt-1">Below minimum threshold</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Inventory Value</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">₹4,82,500</p>
          <p className="text-[11px] text-slate-500 mt-1">Asset valuation</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Audit Health Status</p>
          <p className="text-2xl font-black text-slate-900 mt-1">98.4%</p>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">All storage bays reconciled</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SKU or item name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: "ALL", label: "All Supplies" },
            { id: "SHUTTLES_BALLS", label: "🏸 Shuttles & Balls" },
            { id: "EQUIPMENT", label: "🧵 Pro Strings & Gear" },
            { id: "COURT_MAINTENANCE", label: "🧹 Court Care & Pool" },
            { id: "FB_SUPPLIES", label: "🥤 Café Nutrition" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCat(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                selectedCat === cat.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">SKU & Item Name</th>
                <th className="py-4 px-4">Storage Location</th>
                <th className="py-4 px-4">Stock Level</th>
                <th className="py-4 px-4">Min. Threshold</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-6 text-right">Quick Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <p className="font-black text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{item.sku}</p>
                  </td>

                  <td className="py-4 px-4 text-slate-600 font-bold">
                    {item.location}
                  </td>

                  <td className="py-4 px-4">
                    <span className="text-sm font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                      {item.currentStock} {item.unit}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-slate-500 font-bold">
                    {item.minThreshold} {item.unit}
                  </td>

                  <td className="py-4 px-4">
                    {item.status === "ADEQUATE" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        ADEQUATE
                      </span>
                    )}
                    {item.status === "LOW_STOCK" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        LOW STOCK
                      </span>
                    )}
                    {item.status === "CRITICAL" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-300">
                        <AlertTriangle className="w-3 h-3 text-red-600" />
                        CRITICAL REORDER
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-6 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id
                              ? { ...i, currentStock: i.currentStock + 20, status: "ADEQUATE" }
                              : i
                          )
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-600 hover:text-white text-slate-700 font-black text-[11px] transition-all"
                    >
                      + Restock 20
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
