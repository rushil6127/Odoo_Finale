"use client";

import { useState, useEffect } from "react";
import { UtensilsCrossed, ChefHat, Activity, Coffee, IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { PosTable, PosMenuCategory, PosMenuItem, PosTab, CartItem } from "./types";
import TableSelector from "./TableSelector";
import MenuCatalogue from "./MenuCatalogue";
import CurrentTab from "./CurrentTab";
import PaymentModal from "./PaymentModal";
import KitchenQueueModal from "./KitchenQueueModal";

export default function PosConsole() {
  const [tables, setTables] = useState<PosTable[]>([]);
  const [categories, setCategories] = useState<PosMenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<PosMenuItem[]>([]);
  
  const [activeTable, setActiveTable] = useState<PosTable | null>(null);
  const [currentTab, setCurrentTab] = useState<PosTab | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showKitchenModal, setShowKitchenModal] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);
  const [dailySales, setDailySales] = useState<any>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [tablesData, catData, menuData, shiftData, salesData] = await Promise.all([
        apiClient.get<PosTable[]>("/pos/tables"),
        apiClient.get<PosMenuCategory[]>("/pos/menu/categories"),
        apiClient.get<PosMenuItem[]>("/pos/menu"),
        apiClient.get<any>("/pos/shifts/current"),
        apiClient.get<any>("/pos/daily-sales").catch(() => null)
      ]);
      if (tablesData) setTables(tablesData);
      if (catData) setCategories(catData);
      if (menuData) setMenuItems(menuData);
      if (shiftData) setActiveShift(shiftData);
      if (salesData) setDailySales(salesData);
    } catch (err) {
      console.error("Failed to load POS data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTables = async () => {
    try {
      const tablesData = await apiClient.get<PosTable[]>("/pos/tables");
      if (tablesData) {
        setTables(tablesData);
        if (activeTable) {
          const updated = tablesData.find(t => t.id === activeTable.id);
          if (updated) {
            setActiveTable(updated);
            if (!currentTab && updated.current_tab) {
              loadTab(updated.current_tab.id);
            }
          }
        }
      }
      const salesData = await apiClient.get<any>("/pos/daily-sales").catch(() => null);
      if (salesData) setDailySales(salesData);
    } catch (err) {}
  };

  const loadTab = async (tabId: number) => {
    try {
      const tabData = await apiClient.get<PosTab>(`/pos/tabs/${tabId}`);
      if (tabData) setCurrentTab(tabData);
    } catch (err) {
      console.error("Failed to load tab", err);
    }
  };

  const handleSelectTable = (table: PosTable) => {
    setActiveTable(table);
    setCart([]);
    if (table.current_tab) {
      loadTab(table.current_tab.id);
    } else {
      setCurrentTab(null);
    }
  };

  const handleOpenTab = async (customerName: string) => {
    if (!activeTable) return;
    try {
      const newTab = await apiClient.post<PosTab>("/pos/tabs", {
        table_id: activeTable.id,
        customer_name: customerName || "Guest",
        shift_id: activeShift?.id
      });
      if (newTab) {
        setCurrentTab(newTab);
        refreshTables();
      }
    } catch (err) {
      console.error("Failed to open tab", err);
      alert("Failed to open tab. See console for details.");
    }
  };

  const handleAddToCart = (item: PosMenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const handleUpdateCartQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const handleSendToKitchen = async () => {
    if (!currentTab || cart.length === 0) return;
    try {
      // 1. Add items to tab
      const itemsPayload = cart.map(c => ({
        menu_item_id: c.id,
        quantity: c.qty
      }));
      
      const updatedTab = await apiClient.post<PosTab>(`/pos/tabs/${currentTab.id}/items`, {
        items: itemsPayload
      });
      
      if (updatedTab) {
        // 2. Send to kitchen
        const sentTab = await apiClient.post<PosTab>(`/pos/tabs/${currentTab.id}/kitchen/send`, {});
        if (sentTab) {
          setCurrentTab(sentTab);
          setCart([]);
        }
      }
    } catch (err) {
      console.error("Failed to send to kitchen", err);
      alert("Failed to send to kitchen.");
    }
  };

  const handleVoidTab = async (reason: string) => {
    if (!currentTab) return;
    try {
      const voidedTab = await apiClient.post<PosTab>(`/pos/tabs/${currentTab.id}/void`, { reason });
      if (voidedTab) {
        setCurrentTab(voidedTab);
        refreshTables();
      }
    } catch (err) {
      alert("Failed to void tab.");
    }
  };

  const handleCloseTab = async () => {
    if (!currentTab) return;
    try {
      await apiClient.post<PosTab>(`/pos/tabs/${currentTab.id}/close`, {});
      setCurrentTab(null);
      setActiveTable(null);
      refreshTables();
    } catch (err) {
      alert("Failed to close tab. Ensure it is fully paid.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-600 rounded-full animate-spin mb-4"></div>
        <p>Loading POS Console...</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalTables = tables.length;
  const availableTables = tables.filter(t => t.status === "AVAILABLE").length;
  const occupiedTables = tables.filter(t => t.status === "OCCUPIED").length;
  const activeOrders = tables.filter(t => t.current_tab && t.current_tab.status === "OPEN").length;
  const todaysSales = dailySales?.total_sales || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 hero-gradient-bg min-h-screen p-4 sm:p-6 lg:p-8 rounded-3xl">
      {/* Header */}
      <div className="glass-card p-5 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-sky-500"></div>
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600 shadow-sm border border-sky-100">
              <Coffee className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-900 font-[family-name:var(--font-display)] tracking-tight">
              Champions Café & Lounge
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Manage tables, orders, kitchen service and payments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowKitchenModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white border border-amber-600 text-sm font-bold shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all transform hover:-translate-y-0.5"
          >
            <ChefHat className="w-4 h-4" />
            Kitchen Queue
          </button>
          
          <button 
            onClick={refreshTables} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-sm font-bold shadow-sm hover:border-sky-300 hover:text-sky-600 transition-all"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Operational Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-center border-b-4 border-b-slate-300 hover:border-b-sky-400 transition-colors">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Tables</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{totalTables}</span>
          </div>
        </div>
        
        <div className="glass-card p-4 rounded-2xl flex flex-col justify-center border-b-4 border-b-emerald-400 hover:border-b-emerald-500 transition-colors">
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Available
          </p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{availableTables}</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex flex-col justify-center border-b-4 border-b-sky-400 hover:border-b-sky-500 transition-colors">
          <p className="text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
            Occupied
          </p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{occupiedTables}</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex flex-col justify-center border-b-4 border-b-amber-400 hover:border-b-amber-500 transition-colors">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Activity className="w-3 h-3" /> Active Orders
          </p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">{activeOrders}</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex flex-col justify-center border-b-4 border-b-indigo-400 hover:border-b-indigo-500 transition-colors">
          <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
            <IndianRupee className="w-3 h-3" /> Today's Sales
          </p>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-2xl font-black text-slate-900">₹{todaysSales.toLocaleString()}</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl flex flex-col justify-center border-b-4 border-b-slate-400 hover:border-b-slate-500 transition-colors">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" /> Shift Status
          </p>
          <div className="flex items-end gap-2 mt-1">
            {activeShift ? (
              <span className="text-sm font-black text-slate-900 truncate" title={activeShift.shift_reference}>
                Active ({activeShift.shift_reference.split("-")[1]})
              </span>
            ) : (
              <span className="text-sm font-black text-slate-400">Closed</span>
            )}
          </div>
        </div>
      </div>

      <TableSelector 
        tables={tables} 
        activeTable={activeTable} 
        onSelectTable={handleSelectTable} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <MenuCatalogue 
            categories={categories} 
            menuItems={menuItems} 
            onAddItem={handleAddToCart}
            disabled={!currentTab || currentTab.status !== "OPEN"}
          />
        </div>

        <div className="lg:col-span-5 relative">
          <CurrentTab
            activeTable={activeTable}
            currentTab={currentTab}
            cart={cart}
            onOpenTab={handleOpenTab}
            onUpdateCartQty={handleUpdateCartQty}
            onSendToKitchen={handleSendToKitchen}
            onPay={() => setShowPayModal(true)}
            onCloseTab={handleCloseTab}
            onVoidTab={handleVoidTab}
          />
        </div>
      </div>

      {showPayModal && currentTab && (
        <PaymentModal
          currentTab={currentTab}
          onClose={() => setShowPayModal(false)}
          onPaymentSuccess={(updatedTab) => {
            setCurrentTab(updatedTab);
            setShowPayModal(false);
          }}
        />
      )}

      {showKitchenModal && (
        <KitchenQueueModal onClose={() => setShowKitchenModal(false)} />
      )}
    </div>
  );
}
