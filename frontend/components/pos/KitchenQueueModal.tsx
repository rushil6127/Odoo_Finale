"use client";

import { useState, useEffect } from "react";
import { ChefHat, RefreshCcw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { PosTabItem } from "./types";

interface KitchenQueueModalProps {
  onClose: () => void;
}

export default function KitchenQueueModal({ onClose }: KitchenQueueModalProps) {
  const [items, setItems] = useState<PosTabItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<PosTabItem[]>("/pos/kitchen/queue");
      if (data) {
        setItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    // Optional polling
    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (item: PosTabItem, newStatus: string) => {
    try {
      await apiClient.post(`/pos/kitchen/items/${item.id}/status`, {
        kitchen_status: newStatus
      });
      fetchQueue();
    } catch (err) {
      alert("Failed to update status. Check permissions and workflow rules.");
    }
  };

  const getNextStatus = (current: string) => {
    switch (current) {
      case "PENDING": return "QUEUED";
      case "QUEUED": return "PREPARING";
      case "PREPARING": return "READY";
      case "READY": return "SERVED";
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-600" />
            <h3 className="font-black text-base">Kitchen Display Queue</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchQueue}
              className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
              title="Refresh Queue"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {loading && items.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm font-bold">Loading...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm font-bold">Kitchen queue is empty</div>
          ) : (
            <div className="grid gap-3">
              {items.map(item => {
                const nextStatus = getNextStatus(item.kitchen_status);
                
                return (
                  <div key={item.id} className="p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between bg-white">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{item.quantity} × {item.item_name}</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${
                          item.kitchen_status === "QUEUED" ? "bg-amber-100 text-amber-800" :
                          item.kitchen_status === "PREPARING" ? "bg-sky-100 text-sky-800" :
                          item.kitchen_status === "READY" ? "bg-emerald-100 text-emerald-800" :
                          "bg-slate-100 text-slate-600"
                        }`}>
                          {item.kitchen_status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tab {item.tab_id}
                      </p>
                    </div>
                    
                    {nextStatus && (
                      <button
                        onClick={() => updateStatus(item, nextStatus)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black"
                      >
                        Mark {nextStatus}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
