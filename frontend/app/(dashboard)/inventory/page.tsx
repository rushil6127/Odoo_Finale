/**
 * Champions Club — Pro Shop & Equipment Console
 * Displays product inventory, sales revenue, stock audits, and category revenue breakdown.
 */

"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import {
  ShoppingBag,
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Receipt,
  BarChart3,
  Package,
  Layers,
  Sparkles,
  ArrowRight,
  Filter
} from "lucide-react";

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: "RACKETS" | "SHUTTLES_BALLS" | "APPAREL" | "STRINGS_GRIPS" | "COURT_MAINTENANCE";
  currentStock: number;
  minThreshold: number;
  unitPrice: number;
  unit: string;
  location: string;
  lastRestocked: string;
  status: "ADEQUATE" | "LOW_STOCK" | "CRITICAL";
}

interface SaleRecord {
  id: string;
  member: string;
  items: string;
  date: string;
  amount: number;
  paymentMethod: "MEMBER_WALLET" | "CARD" | "UPI" | "CASH";
  status: "COMPLETED";
}

const DEFAULT_SALES: SaleRecord[] = [
  { id: "PS-8091", member: "Rohan Varma (Elite Member)", items: "Yonex Astrox 99 Pro + 2x BG65 Strings", date: "Today, 11:30 AM", amount: 14200, paymentMethod: "MEMBER_WALLET", status: "COMPLETED" },
  { id: "PS-8090", member: "Aarav Sharma", items: "Wilson US Open Extra Duty Balls (3-Can Tube)", date: "Today, 10:45 AM", amount: 1350, paymentMethod: "UPI", status: "COMPLETED" },
  { id: "PS-8089", member: "Meera Patel", items: "Champions Club Pro Tech T-Shirt (Navy, M)", date: "Today, 09:15 AM", amount: 2400, paymentMethod: "CARD", status: "COMPLETED" },
  { id: "PS-8088", member: "Devendra Rao", items: "Yonex Aerosensa 30 Feather Shuttles (Tube of 12)", date: "Yesterday, 07:40 PM", amount: 3200, paymentMethod: "MEMBER_WALLET", status: "COMPLETED" },
  { id: "PS-8087", member: "Vikramaditya S.", items: "Babolat Pure Drive Tennis Racket (300g)", date: "Yesterday, 05:20 PM", amount: 18900, paymentMethod: "CARD", status: "COMPLETED" },
  { id: "PS-8086", member: "Pooja Malhotra", items: "Grip Tape Pack of 3 + Wristbands", date: "Yesterday, 03:10 PM", amount: 750, paymentMethod: "CASH", status: "COMPLETED" },
];

const SEED_PRO_SHOP_ITEMS: InventoryItem[] = [
  { id: 101, sku: "PS-RK-01", name: "Yonex Astrox 99 Pro Badminton Racket", category: "RACKETS", currentStock: 8, minThreshold: 5, unitPrice: 13500, unit: "Pcs", location: "Showcase Bay A", lastRestocked: "Oct 02, 2026", status: "ADEQUATE" },
  { id: 102, sku: "PS-SH-02", name: "Yonex Aerosensa 30 Feather Shuttles (12pk)", category: "SHUTTLES_BALLS", currentStock: 3, minThreshold: 10, unitPrice: 3200, unit: "Tubes", location: "Storage Bin 2", lastRestocked: "Sep 28, 2026", status: "CRITICAL" },
  { id: 103, sku: "PS-BL-03", name: "Wilson US Open Extra Duty Tennis Balls (3-can)", category: "SHUTTLES_BALLS", currentStock: 6, minThreshold: 8, unitPrice: 1350, unit: "Cans", location: "Storage Bin 3", lastRestocked: "Oct 01, 2026", status: "LOW_STOCK" },
  { id: 104, sku: "PS-RK-04", name: "Babolat Pure Drive Tennis Racket (300g)", category: "RACKETS", currentStock: 5, minThreshold: 4, unitPrice: 18900, unit: "Pcs", location: "Showcase Bay B", lastRestocked: "Sep 25, 2026", status: "ADEQUATE" },
  { id: 105, sku: "PS-AP-05", name: "Champions Club Pro Tech Jersey (S/M/L)", category: "APPAREL", currentStock: 24, minThreshold: 12, unitPrice: 2400, unit: "Pcs", location: "Apparel Rack 1", lastRestocked: "Oct 03, 2026", status: "ADEQUATE" },
  { id: 106, sku: "PS-ST-06", name: "Yonex BG65 Titanium Badminton String Reel", category: "STRINGS_GRIPS", currentStock: 4, minThreshold: 6, unitPrice: 6800, unit: "Reels", location: "Stringing Workshop", lastRestocked: "Sep 20, 2026", status: "LOW_STOCK" },
  { id: 107, sku: "PS-GR-07", name: "Super Tacky Overgrip Multi-Pack (6-pack)", category: "STRINGS_GRIPS", currentStock: 35, minThreshold: 15, unitPrice: 750, unit: "Packs", location: "Accessory Display", lastRestocked: "Oct 02, 2026", status: "ADEQUATE" },
  { id: 108, sku: "PS-MN-08", name: "Clay Court Sweep Brush & Drag Mat Set", category: "COURT_MAINTENANCE", currentStock: 2, minThreshold: 2, unitPrice: 8500, unit: "Sets", location: "Grounds Shed", lastRestocked: "Sep 15, 2026", status: "ADEQUATE" },
];

export default function ProShopPage() {
  const [activeTab, setActiveTab] = useState<"inventory" | "sales" | "revenue">("inventory");
  const [items, setItems] = useState<InventoryItem[]>(SEED_PRO_SHOP_ITEMS);
  const [sales] = useState<SaleRecord[]>(DEFAULT_SALES);
  const [shopTotalRevenue, setShopTotalRevenue] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [loading, setLoading] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [prodRes, revRes] = await Promise.allSettled([
        apiClient.get<any>("/inventory/products"),
        apiClient.get<any>("/reports/revenue?item_type=SHOP_ORDER&period=month"),
      ]);

      if (prodRes.status === "fulfilled" && prodRes.value) {
        const res = prodRes.value;
        const list = Array.isArray(res) ? res : res?.products || res?.data?.products || res?.data || [];
        if (list && list.length > 0) {
          const mapped: InventoryItem[] = list.map((p: any) => {
            const qty = p.stock_quantity ?? p.stock ?? 10;
            const minT = p.min_threshold ?? p.low_stock_threshold ?? 5;
            const price = Number(p.price || p.unit_price || 1500);
            let cat: InventoryItem["category"] = "RACKETS";
            const catName = (p.category?.name || p.category_name || p.category || "").toUpperCase();
            if (catName.includes("SHUTTLE") || catName.includes("BALL") || p.name?.toLowerCase().includes("ball")) {
              cat = "SHUTTLES_BALLS";
            } else if (catName.includes("APPAREL") || catName.includes("SHIRT") || p.name?.toLowerCase().includes("polo") || p.name?.toLowerCase().includes("shirt")) {
              cat = "APPAREL";
            } else if (catName.includes("STRING") || catName.includes("GRIP") || catName.includes("GEAR") || p.name?.toLowerCase().includes("grip")) {
              cat = "STRINGS_GRIPS";
            } else if (catName.includes("COURT") || catName.includes("MAINTENANCE")) {
              cat = "COURT_MAINTENANCE";
            }

            return {
              id: p.id,
              sku: p.sku || `PS-${p.id.toString().padStart(4, "0")}`,
              name: p.name,
              category: cat,
              currentStock: qty,
              minThreshold: minT,
              unitPrice: price,
              unit: p.unit || "Pcs",
              location: p.location || "Central Pro Shop Store",
              lastRestocked: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "Recent",
              status: qty <= 2 ? "CRITICAL" : qty < minT ? "LOW_STOCK" : "ADEQUATE",
            };
          });
          setItems(mapped);
        }
      }

      if (revRes.status === "fulfilled" && revRes.value) {
        const rData = revRes.value?.data || revRes.value;
        const gross = rData?.financial_summary?.gross_revenue ?? rData?.gross_revenue ?? 0;
        setShopTotalRevenue(Number(gross));
      }
    } catch {
      // Keep seeded fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCat === "ALL" || item.category === selectedCat;
    const matchesQ =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQ;
  });

  const totalStockUnits = items.reduce((sum, item) => sum + item.currentStock, 0);
  const totalStockValuation = items.reduce((sum, item) => sum + item.currentStock * item.unitPrice, 0);
  const lowStockCount = items.filter((i) => i.status !== "ADEQUATE").length;
  const totalSalesRevenue = shopTotalRevenue;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Commerce &amp; Hospitality
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-[family-name:var(--font-outfit)] mt-0.5">
                Pro Shop &amp; Equipment
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Real-time shop catalog, stock audits, equipment merchandise sales, and departmental revenue ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Shop Total Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹{totalSalesRevenue.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-600">+18.4%</span>
              <span className="text-xs text-slate-400">vs last month</span>
            </div>
          </div>
        </div>

        {/* Total Stock in Hand */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Inventory Units</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {totalStockUnits} Units
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Across <span className="font-bold text-slate-700">{items.length} active SKUs</span>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Low Stock Reorder</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-amber-600 font-mono tracking-tight">
              {lowStockCount} Items
            </div>
            <div className="mt-1 text-xs text-amber-700 font-bold">
              Below replenishment threshold
            </div>
          </div>
        </div>

        {/* Total Inventory Asset Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Stock Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹{totalStockValuation.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Current store asset valuation
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "inventory"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Product Inventory ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sales")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "sales"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Recent Sales Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "revenue"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Category Revenue Breakdown</span>
        </button>
      </div>

      {/* 4. TAB 1: PRODUCT INVENTORY TABLE */}
      {activeTab === "inventory" && (
        <div className="space-y-4">
          {/* Search & Category Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
              {[
                { id: "ALL", label: "All Catalog" },
                { id: "RACKETS", label: "Rackets & Gear" },
                { id: "SHUTTLES_BALLS", label: "Shuttles & Balls" },
                { id: "APPAREL", label: "Apparel" },
                { id: "STRINGS_GRIPS", label: "Strings & Grips" },
                { id: "COURT_MAINTENANCE", label: "Court Gear" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCat(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedCat === cat.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Embedded Inventory Table */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">SKU &amp; Product Name</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Location</th>
                    <th className="py-4 px-4">Stock Level</th>
                    <th className="py-4 px-4">Unit Price</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-black text-slate-900">{item.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {item.category.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-600 font-medium">
                        {item.location}
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-sm font-black text-slate-900 font-mono">
                          {item.currentStock} {item.unit}
                        </span>
                        <p className="text-[10px] text-slate-400">Min: {item.minThreshold}</p>
                      </td>

                      <td className="py-4 px-4 text-slate-900 font-mono font-bold">
                        ₹{item.unitPrice.toLocaleString("en-IN")}
                      </td>

                      <td className="py-4 px-4">
                        {item.status === "ADEQUATE" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            IN STOCK
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
                            CRITICAL
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
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 font-black text-[11px] transition-all cursor-pointer"
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
      )}

      {/* 5. TAB 2: RECENT SALES LEDGER */}
      {activeTab === "sales" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                Pro Shop Direct Sales &amp; Invoices
              </h3>
              <p className="text-xs text-slate-500">Live feed of store checkout transactions and member account debits</p>
            </div>
            <span className="text-xs font-bold text-slate-500">{sales.length} transactions today</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Receipt ID</th>
                  <th className="py-4 px-4">Member / Patron</th>
                  <th className="py-4 px-4">Items Purchased</th>
                  <th className="py-4 px-4">Timestamp</th>
                  <th className="py-4 px-4">Payment Method</th>
                  <th className="py-4 px-6 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-indigo-600">
                      {sale.id}
                    </td>
                    <td className="py-4 px-4 font-black text-slate-900">
                      {sale.member}
                    </td>
                    <td className="py-4 px-4 text-slate-600 max-w-xs truncate">
                      {sale.items}
                    </td>
                    <td className="py-4 px-4 text-slate-500">
                      {sale.date}
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {sale.paymentMethod.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-black text-slate-900 text-sm">
                      ₹{sale.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: CATEGORY REVENUE BREAKDOWN */}
      {activeTab === "revenue" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-5">
            <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Revenue by Product Category
            </h3>
            <div className="space-y-4">
              {[
                { cat: "Rackets & Arenas Gear", rev: 86400, pct: 42, color: "bg-indigo-500" },
                { cat: "Feather & Synthetic Shuttles", rev: 41200, pct: 28, color: "bg-sky-500" },
                { cat: "Pro Apparel & Footwear", rev: 28500, pct: 18, color: "bg-emerald-500" },
                { cat: "Strings, Grips & Accessories", rev: 14600, pct: 12, color: "bg-amber-500" },
              ].map((item) => (
                <div key={item.cat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.cat}</span>
                    <span className="font-mono font-black text-slate-900">
                      ₹{item.rev.toLocaleString("en-IN")} ({item.pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                Pro Shop Margin &amp; Performance
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Net operational profit and restocking velocity across club merchandise.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">Gross Margin</span>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-1">38.6%</p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">+2.4% vs target</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">Inventory Turnover</span>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-1">4.2x</p>
                  <p className="text-[10px] text-slate-400 mt-1">Annualized velocity</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/70 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-indigo-900">Need Bulk Restock?</p>
                <p className="text-[11px] text-indigo-700">Auto-generate purchase order for supplier Yonex &amp; Wilson</p>
              </div>
              <button
                type="button"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-sm hover:bg-indigo-700 transition-all cursor-pointer"
              >
                Generate PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
