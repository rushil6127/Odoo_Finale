/**
 * Champions Club — Café Bar & Sports Lounge Console
 * Touch POS terminal, café ingredient inventory audit, orders ledger, and category revenue.
 */

"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import {
  UtensilsCrossed,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  QrCode,
  CreditCard,
  Wallet,
  Sparkles,
  Receipt,
  ChefHat,
  Clock,
  ArrowRight,
  DollarSign,
  Coffee,
  Wine,
  CupSoda,
  Salad,
  Sandwich,
  Check,
  X,
  Utensils,
  Boxes,
  AlertTriangle,
  BarChart3,
  Search,
  Package
} from "lucide-react";

interface MenuItem {
  id: number;
  name: string;
  category: "SMOOTHIES" | "BOWLS" | "MAINS" | "COFFEE" | "DRINKS";
  price: number;
  image?: string;
  isPopular?: boolean;
  calories?: string;
}

interface CafeInventoryItem {
  id: number;
  sku: string;
  name: string;
  category: "BEVERAGES" | "FRESH_PRODUCE" | "DAIRY_OATS" | "SUPPLEMENTS" | "BAKERY";
  currentStock: number;
  minThreshold: number;
  unit: string;
  supplier: string;
  status: "ADEQUATE" | "LOW_STOCK" | "CRITICAL";
}

interface CafeOrderRecord {
  id: string;
  tableOrMember: string;
  items: string;
  time: string;
  amount: number;
  paymentMethod: "MEMBER_WALLET" | "CARD" | "UPI" | "CASH";
  status: "PAID" | "ACTIVE_TAB";
}

const getMenuItemIcon = (category: string) => {
  switch (category) {
    case "COFFEE":
      return <Coffee className="w-4 h-4 text-amber-700" />;
    case "SMOOTHIES":
      return <CupSoda className="w-4 h-4 text-emerald-600" />;
    case "BOWLS":
      return <Salad className="w-4 h-4 text-teal-600" />;
    case "MAINS":
      return <Sandwich className="w-4 h-4 text-orange-600" />;
    case "DRINKS":
      return <Wine className="w-4 h-4 text-indigo-600" />;
    default:
      return <Utensils className="w-4 h-4 text-slate-700" />;
  }
};

const getItemImage = (id: number, name: string = "", category: string = "") => {
  const itemMap: Record<number, string> = {
    1: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=200&h=200&fit=crop&q=80",
    2: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop&q=80",
    3: "https://images.unsplash.com/photo-1534778101976-62847782c213?w=200&h=200&fit=crop&q=80",
    4: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=200&h=200&fit=crop&q=80",
    5: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=200&h=200&fit=crop&q=80",
    6: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?w=200&h=200&fit=crop&q=80",
    7: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=200&h=200&fit=crop&q=80",
    8: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=200&h=200&fit=crop&q=80",
    9: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=200&h=200&fit=crop&q=80",
    10: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200&h=200&fit=crop&q=80",
  };
  if (itemMap[id]) return itemMap[id];
  const catUpper = category.toUpperCase();
  if (catUpper.includes("SMOOTHIE")) return "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=200&h=200&fit=crop&q=80";
  if (catUpper.includes("BOWL")) return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop&q=80";
  if (catUpper.includes("COFFEE")) return "https://images.unsplash.com/photo-1534778101976-62847782c213?w=200&h=200&fit=crop&q=80";
  if (catUpper.includes("MAINS") || catUpper.includes("SANDWICH") || catUpper.includes("WRAP")) return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=200&h=200&fit=crop&q=80";
  if (catUpper.includes("BEER")) return "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200&h=200&fit=crop&q=80";
  return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=200&h=200&fit=crop&q=80";
};

const SEED_CAFE_INVENTORY: CafeInventoryItem[] = [
  { id: 201, sku: "CF-BEV-01", name: "Single Origin Ethiopian Arabica Beans", category: "BEVERAGES", currentStock: 9, minThreshold: 5, unit: "kg Bags", supplier: "Blue Tokai Roasters", status: "ADEQUATE" },
  { id: 202, sku: "CF-DRY-02", name: "Barista Oat Milk (1L Tetrapak)", category: "DAIRY_OATS", currentStock: 4, minThreshold: 12, unit: "Cartons", supplier: "Oatly Foodservice", status: "LOW_STOCK" },
  { id: 203, sku: "CF-SUP-03", name: "Hydrolyzed Whey Isolate (Chocolate)", category: "SUPPLEMENTS", currentStock: 14, minThreshold: 6, unit: "2kg Tubs", supplier: "Optimum Nutrition", status: "ADEQUATE" },
  { id: 204, sku: "CF-FRS-04", name: "Organic Acai Puree Packs (Frozen)", category: "FRESH_PRODUCE", currentStock: 2, minThreshold: 8, unit: "Boxes", supplier: "Amazonia Bio", status: "CRITICAL" },
  { id: 205, sku: "CF-BAK-05", name: "Artisan Sourdough Boule & Panini Loaves", category: "BAKERY", currentStock: 18, minThreshold: 10, unit: "Loaves", supplier: "The Daily Crust", status: "ADEQUATE" },
  { id: 206, sku: "CF-BEV-06", name: "Craft Cold Brew Ready Kegs (20L)", category: "BEVERAGES", currentStock: 3, minThreshold: 2, unit: "Kegs", supplier: "Roast Master Ltd", status: "ADEQUATE" },
  { id: 207, sku: "CF-BEV-07", name: "Electrolyte Coconut Water Boosters", category: "BEVERAGES", currentStock: 42, minThreshold: 20, unit: "Cans", supplier: "Raw Pressery", status: "ADEQUATE" },
];

const SEED_CAFE_ORDERS: CafeOrderRecord[] = [
  { id: "CB-4012", tableOrMember: "Table 2 (Vikramaditya S.)", items: "1x Blue Superfood Smoothie, 1x Avocado Toast", time: "11:42 AM", amount: 850, paymentMethod: "MEMBER_WALLET", status: "PAID" },
  { id: "CB-4011", tableOrMember: "Table 5 (Rohan Varma)", items: "2x Double Espresso, 1x Whey Bar", time: "11:20 AM", amount: 480, paymentMethod: "UPI", status: "PAID" },
  { id: "CB-4010", tableOrMember: "Bar Counter (Meera Patel)", items: "1x Green Detox Cooler", time: "10:55 AM", amount: 380, paymentMethod: "CARD", status: "PAID" },
  { id: "CB-4009", tableOrMember: "Table 1 (Aarav Sharma)", items: "1x Acai Power Bowl, 1x Iced Oat Latte", time: "10:30 AM", amount: 920, paymentMethod: "MEMBER_WALLET", status: "ACTIVE_TAB" },
  { id: "CB-4008", tableOrMember: "Table 4 (Devendra Rao)", items: "1x Grilled Chicken Panini, 1x Cold Brew", time: "09:50 AM", amount: 650, paymentMethod: "CASH", status: "PAID" },
];

interface CartItem extends MenuItem {
  qty: number;
}

export default function POSPage() {
  const [activeMainTab, setActiveMainTab] = useState<"pos" | "inventory" | "orders">("pos");
  const [tables, setTables] = useState<{ id: string; name: string; status: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeTable, setActiveTable] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderSent, setOrderSent] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Inventory & Orders states
  const [cafeInventory, setCafeInventory] = useState<CafeInventoryItem[]>(SEED_CAFE_INVENTORY);
  const [cafeOrders] = useState<CafeOrderRecord[]>(SEED_CAFE_ORDERS);
  const [searchInv, setSearchInv] = useState("");

  const fetchPosData = async () => {
    try {
      setLoading(true);
      const [tablesRes, menuRes] = await Promise.allSettled([
        apiClient.get<any>("/pos/tables"),
        apiClient.get<any>("/pos/menu"),
      ]);

      if (tablesRes.status === "fulfilled" && tablesRes.value) {
        const tList = Array.isArray(tablesRes.value) ? tablesRes.value : tablesRes.value?.tables || tablesRes.value?.data || [];
        if (tList && tList.length > 0) {
          const mappedTables = tList.map((t: any) => ({
            id: `T${t.table_number || t.id}`,
            name: t.name || `Table ${t.table_number}`,
            status: t.status === "OCCUPIED" ? "OCCUPIED" : "OPEN",
          }));
          setTables(mappedTables);
          if (mappedTables.length > 0) {
            setActiveTable(mappedTables[0].id);
          }
        }
      }

      if (menuRes.status === "fulfilled" && menuRes.value) {
        const mList = Array.isArray(menuRes.value) ? menuRes.value : menuRes.value?.menu || menuRes.value?.data || [];
        if (mList && mList.length > 0) {
          const mappedMenu: MenuItem[] = mList.map((m: any) => {
            const category = m.category?.name?.toUpperCase()?.includes("SMOOTHIE")
              ? "SMOOTHIES"
              : m.category?.name?.toUpperCase()?.includes("BOWL")
              ? "BOWLS"
              : m.category?.name?.toUpperCase()?.includes("COFFEE")
              ? "COFFEE"
              : m.category?.name?.toUpperCase()?.includes("DRINK")
              ? "DRINKS"
              : "MAINS";
            return {
              id: m.id,
              name: m.name,
              category,
              price: Number(m.price) || 350,
              isPopular: m.is_popular || false,
              calories: `${m.calories || 300} kcal`,
              image: getItemImage(m.id, m.name, category),
            };
          });
          setMenuItems(mappedMenu);
        }
      }
    } catch {
      // Keep seeded data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosData();
  }, []);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const gst = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + gst;

  const addItem = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
    setOrderSent(false);
  };

  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
    setOrderSent(false);
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
    setOrderSent(false);
  };

  const handleCompletePayment = async (method: string) => {
    try {
      setActionLoading(true);
      await new Promise((r) => setTimeout(r, 600));
      setPaymentSuccess(true);
      setTimeout(() => {
        setCart([]);
        setShowPayModal(false);
        setPaymentSuccess(false);
      }, 1400);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCat === "ALL") return true;
    return item.category === selectedCat;
  });

  const filteredInv = cafeInventory.filter((item) =>
    item.name.toLowerCase().includes(searchInv.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchInv.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 border border-teal-500/20 flex items-center justify-center font-bold">
              <UtensilsCrossed className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                Commerce &amp; Hospitality
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 font-[family-name:var(--font-outfit)] mt-0.5">
                Café Bar &amp; Sports Lounge
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Touch POS terminal, member tabs, barista orders, ingredient stock audit, and live food &amp; beverage sales.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Kitchen Terminal Connected
          </span>
        </div>
      </div>

      {/* 2. Top Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Café Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Today&apos;s Café Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₹32,450
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-bold text-teal-600">+12.6%</span>
              <span className="text-xs text-slate-400">vs daily avg</span>
            </div>
          </div>
        </div>

        {/* Active Open Tabs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Active Open Tabs</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              3 Open Tabs
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Across <span className="font-bold text-slate-700">8 dining tables</span>
            </div>
          </div>
        </div>

        {/* Café Inventory Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Ingredient Inventory</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {cafeInventory.length} Supplies
            </div>
            <div className="mt-1 text-xs text-amber-600 font-bold">
              2 items near threshold
            </div>
          </div>
        </div>

        {/* Top Product Category */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Top Selling Category</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CupSoda className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xl font-black text-slate-900">
              Protein Smoothies
            </div>
            <div className="mt-1 text-xs text-slate-400">
              ₹14,200 revenue today (44%)
            </div>
          </div>
        </div>
      </div>

      {/* 3. Section Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveMainTab("pos")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === "pos"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Touch POS &amp; Order Terminal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("inventory")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === "inventory"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Café Bar Inventory &amp; Supplies ({cafeInventory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab("orders")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeMainTab === "orders"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Orders &amp; Revenue Ledger</span>
        </button>
      </div>

      {/* 4. TAB 1: TOUCH POS TERMINAL */}
      {activeMainTab === "pos" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Menu Catalog (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Table Selector Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2 overflow-x-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 px-2">
                Table / Area:
              </span>
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTable(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTable === t.id
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: "ALL", label: "All Items" },
                { id: "SMOOTHIES", label: "Smoothies & Bowls" },
                { id: "COFFEE", label: "Barista Coffee" },
                { id: "MAINS", label: "Paninis & Wraps" },
                { id: "DRINKS", label: "Cold Hydration" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCat(c.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCat === c.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => addItem(item)}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200/90 hover:border-teal-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                      {getMenuItemIcon(item.category)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate group-hover:text-teal-600 transition-colors">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.calories}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-slate-900">
                      ₹{item.price}
                    </span>
                    <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-bold group-hover:scale-105 transition-transform">
                      +
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart Sidebar (4 Cols) */}
          <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between h-[600px]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-black text-slate-900">Current Tab</h3>
                </div>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
                  {activeTable || "Counter"}
                </span>
              </div>

              {/* Items List */}
              <div className="overflow-y-auto max-h-[350px] space-y-3 pt-3">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Utensils className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No items in tab yet</p>
                    <p className="text-[10px]">Click any item from the menu to add</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">₹{item.price} each</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold w-4 text-center">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="w-5 h-5 rounded bg-slate-100 text-slate-600 flex items-center justify-center font-bold"
                        >
                          +
                        </button>
                        <span className="font-mono font-bold text-slate-900 ml-1.5">
                          ₹{item.price * item.qty}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Checkout & Bill Summary */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (5%)</span>
                  <span className="font-mono">₹{gst}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-100">
                  <span>Total Due</span>
                  <span className="font-mono text-teal-600">₹{grandTotal}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => setShowPayModal(true)}
                className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Charge Tab / Pay ₹{grandTotal}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: CAFÉ INVENTORY & INGREDIENT SUPPLIES */}
      {activeMainTab === "inventory" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search cafe supplies or ingredients..."
                value={searchInv}
                onChange={(e) => setSearchInv(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-teal-500 font-medium"
              />
            </div>
            <span className="text-xs font-bold text-slate-500">
              {filteredInv.length} tracked supplies
            </span>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">SKU &amp; Supply Name</th>
                    <th className="py-4 px-4">Category</th>
                    <th className="py-4 px-4">Primary Supplier</th>
                    <th className="py-4 px-4">Current Stock</th>
                    <th className="py-4 px-4">Min Threshold</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-6 text-right">Quick Restock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInv.map((item) => (
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
                        {item.supplier}
                      </td>

                      <td className="py-4 px-4">
                        <span className="text-sm font-black text-slate-900 font-mono">
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
                            CRITICAL
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setCafeInventory((prev) =>
                              prev.map((i) =>
                                i.id === item.id
                                  ? { ...i, currentStock: i.currentStock + 10, status: "ADEQUATE" }
                                  : i
                              )
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-700 border border-teal-200 font-black text-[11px] transition-all cursor-pointer"
                        >
                          + Restock 10
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

      {/* 6. TAB 3: ORDERS & REVENUE LEDGER */}
      {activeMainTab === "orders" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  Live Café Orders &amp; Tab Ledger
                </h3>
                <p className="text-xs text-slate-500">Real-time table orders, member charging, and POS receipts</p>
              </div>
              <span className="text-xs font-bold text-slate-500">{cafeOrders.length} orders served today</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Order ID</th>
                    <th className="py-4 px-4">Table / Member</th>
                    <th className="py-4 px-4">Items Ordered</th>
                    <th className="py-4 px-4">Timestamp</th>
                    <th className="py-4 px-4">Payment Method</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-6 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cafeOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-teal-600">
                        {ord.id}
                      </td>
                      <td className="py-4 px-4 font-black text-slate-900">
                        {ord.tableOrMember}
                      </td>
                      <td className="py-4 px-4 text-slate-600 max-w-xs truncate">
                        {ord.items}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        {ord.time}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {ord.paymentMethod.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {ord.status === "PAID" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-600" />
                            OPEN TAB
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-black text-slate-900 text-sm">
                        ₹{ord.amount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                Complete Settlement
              </h3>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-center">
              <span className="text-xs text-teal-700 font-bold">Total Bill Due</span>
              <p className="text-2xl font-black text-teal-900 font-mono mt-0.5">₹{grandTotal}</p>
            </div>

            {paymentSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 text-center font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Payment Processed Successfully!</span>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleCompletePayment("MEMBER_WALLET")}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Charge Member Wallet
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleCompletePayment("UPI")}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    Instant UPI QR
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleCompletePayment("CARD")}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Credit / Debit Card
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
