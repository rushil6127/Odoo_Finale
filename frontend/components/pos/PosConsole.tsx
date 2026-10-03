"use client";

import { useState, useEffect } from "react";
import { UtensilsCrossed, ChefHat } from "lucide-react";
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

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const [tablesData, catData, menuData, shiftData] = await Promise.all([
        apiClient.get<PosTable[]>("/pos/tables"),
        apiClient.get<PosMenuCategory[]>("/pos/menu/categories"),
        apiClient.get<PosMenuItem[]>("/pos/menu"),
        apiClient.get<any>("/pos/shifts/current")
      ]);
      if (tablesData) setTables(tablesData);
      if (catData) setCategories(catData);
      if (menuData) setMenuItems(menuData);
      if (shiftData) setActiveShift(shiftData);
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <UtensilsCrossed className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Champions Café & Lounge
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sports nutrition, café favourites & game-day refreshments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKitchenModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100"
          >
            <ChefHat className="w-4 h-4" />
            Kitchen Queue
          </button>
          
          <button onClick={refreshTables} className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition">
            Refresh
          </button>

          {activeShift && (
            <span className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 text-xs font-bold border border-sky-100">
              Shift: {activeShift.shift_reference}
            </span>
          )}
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
