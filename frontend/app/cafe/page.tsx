"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Coffee,
  Sparkles,
  Search,
  ArrowRight,
  Clock,
  CheckCircle2,
  UtensilsCrossed,
  Flame,
  ShieldCheck,
  ChevronLeft,
  Crown,
  ChefHat,
  ShoppingBag,
  Plus,
  Check,
  Info,
  Layers,
  Heart,
  ExternalLink,
} from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { apiClient } from "@/lib/api/client";
import { useCurrentUser, isOwner, isStaffOrAdmin } from "@/lib/auth";

interface CafeCategory {
  id: number;
  name: string;
  slug: string;
  display_order?: number;
}

interface CafeMenuItem {
  id: number;
  category_id: number;
  code: string;
  name: string;
  description: string | null;
  price: number;
  preparation_time_minutes?: number;
  is_available: boolean;
  category_name?: string | null;
}

const ITEM_IMAGES: Record<string, string> = {
  // Backend Seeded Item Codes
  "BEV-ESP": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
  "BEV-COOL": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
  "BEV-PROT": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
  "FOOD-BOWL": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
  "FOOD-WRAP": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80",
  "FOOD-PANEER": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",

  // Additional Codes
  B01: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80",
  B02: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80",
  B03: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
  B04: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80",
  S01: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
  S02: "https://images.unsplash.com/photo-1582169505937-b9992bd01ed9?auto=format&fit=crop&w=600&q=80",
  S03: "https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=600&q=80",
  M01: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80",
  M02: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  M03: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
};

const ITEM_TAGS: Record<string, { badge: string; color: string }> = {
  "BEV-ESP": { badge: "Specialty Roast", color: "bg-amber-100 text-amber-900 border-amber-200" },
  "BEV-COOL": { badge: "Electrolyte Hydration", color: "bg-sky-100 text-sky-900 border-sky-200" },
  "BEV-PROT": { badge: "30g Whey Isolate", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  "FOOD-BOWL": { badge: "Superfood Quinoa", color: "bg-teal-100 text-teal-900 border-teal-200" },
  "FOOD-WRAP": { badge: "Grilled Chicken", color: "bg-orange-100 text-orange-900 border-orange-200" },
  "FOOD-PANEER": { badge: "High-Protein Paneer", color: "bg-lime-100 text-lime-900 border-lime-200" },

  B01: { badge: "Specialty Roast", color: "bg-amber-100 text-amber-900 border-amber-200" },
  B02: { badge: "Barista Favorite", color: "bg-orange-100 text-orange-900 border-orange-200" },
  B03: { badge: "Nitro Chilled", color: "bg-sky-100 text-sky-900 border-sky-200" },
  B04: { badge: "30g Whey Isolate", color: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  S01: { badge: "White Truffle Salt", color: "bg-yellow-100 text-yellow-900 border-yellow-200" },
  S02: { badge: "Fresh Guacamole", color: "bg-lime-100 text-lime-900 border-lime-200" },
  S03: { badge: "Smoked Chipotle", color: "bg-rose-100 text-rose-900 border-rose-200" },
  M01: { badge: "Toasted Sourdough", color: "bg-blue-100 text-blue-900 border-blue-200" },
  M02: { badge: "Brioche & Avocado", color: "bg-purple-100 text-purple-900 border-purple-200" },
  M03: { badge: "High-Protein Superfood", color: "bg-teal-100 text-teal-900 border-teal-200" },
};

function getMenuItemImageUrl(item: CafeMenuItem): string {
  if (item.code && ITEM_IMAGES[item.code]) return ITEM_IMAGES[item.code];
  const nameLower = (item.name || "").toLowerCase();
  const codeLower = (item.code || "").toLowerCase();

  if (nameLower.includes("espresso") || codeLower.includes("esp")) {
    return "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("cooler") || nameLower.includes("citrus") || nameLower.includes("electrolyte") || codeLower.includes("cool")) {
    return "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("smoothie") || nameLower.includes("protein") || codeLower.includes("prot")) {
    return "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("wrap") || codeLower.includes("wrap")) {
    return "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("paneer") || nameLower.includes("tikka") || codeLower.includes("paneer")) {
    return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("bowl") || nameLower.includes("quinoa") || codeLower.includes("bowl")) {
    return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("burger")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("sandwich")) {
    return "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("fries")) {
    return "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("nachos")) {
    return "https://images.unsplash.com/photo-1582169505937-b9992bd01ed9?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("onion")) {
    return "https://images.unsplash.com/photo-1639024471283-03518883512d?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("latte") || nameLower.includes("cappuccino")) {
    return "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80";
  }
  if (nameLower.includes("cold brew") || nameLower.includes("nitro")) {
    return "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80";
  }

  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
}

const FALLBACK_CATEGORIES: CafeCategory[] = [
  { id: 1, name: "Beverages & Coffee", slug: "beverages", display_order: 1 },
  { id: 2, name: "Snacks & Appetizers", slug: "snacks", display_order: 2 },
  { id: 3, name: "Meals & Gourmet Bowls", slug: "meals", display_order: 3 },
];

const FALLBACK_MENU: CafeMenuItem[] = [
  {
    id: 1,
    category_id: 1,
    code: "B01",
    name: "Double Shot Espresso",
    description: "Single-origin Arabica roast extracted at 9 bars with thick golden crema.",
    price: 150,
    preparation_time_minutes: 5,
    is_available: true,
  },
  {
    id: 2,
    category_id: 1,
    code: "B02",
    name: "Artisan Café Latte / Cappuccino",
    description: "Silky micro-foam steamed whole or oat milk over rich double-shot espresso.",
    price: 180,
    preparation_time_minutes: 7,
    is_available: true,
  },
  {
    id: 3,
    category_id: 1,
    code: "B03",
    name: "Cascade Nitro Cold Brew",
    description: "Steeped for 24 hours and infused with pure nitrogen for a velvety, stout-like texture.",
    price: 210,
    preparation_time_minutes: 3,
    is_available: true,
  },
  {
    id: 4,
    category_id: 1,
    code: "B04",
    name: "Whey Protein Berry Blast Smoothie",
    description: "30g grass-fed whey isolate, organic blueberries, banana, chia seeds, and almond milk.",
    price: 320,
    preparation_time_minutes: 6,
    is_available: true,
  },
  {
    id: 5,
    category_id: 2,
    code: "S01",
    name: "Truffle Parmesan Crisp Fries",
    description: "Hand-cut Idaho potatoes tossed with white truffle oil, rosemary, and aged Parmigiano.",
    price: 220,
    preparation_time_minutes: 10,
    is_available: true,
  },
  {
    id: 6,
    category_id: 2,
    code: "S02",
    name: "Loaded Guacamole Nachos",
    description: "Stone-ground organic corn chips, fresh pico de gallo, smashed Haas avocado, and warm queso.",
    price: 280,
    preparation_time_minutes: 10,
    is_available: true,
  },
  {
    id: 7,
    category_id: 2,
    code: "S03",
    name: "Crispy Golden Onion Rings",
    description: "Panko & craft-beer battered Vidalia onion rings with smoked chipotle dipping sauce.",
    price: 190,
    preparation_time_minutes: 8,
    is_available: true,
  },
  {
    id: 8,
    category_id: 3,
    code: "M01",
    name: "Champions Club Artisan Sandwich",
    description: "Roasted herb turkey breast, Haas avocado, arugula, aged white cheddar on toasted sourdough.",
    price: 290,
    preparation_time_minutes: 12,
    is_available: true,
  },
  {
    id: 9,
    category_id: 3,
    code: "M02",
    name: "Grilled Chicken & Avocado Burger",
    description: "Free-range marinated chicken breast, smashed avocado, heirloom tomato on a toasted brioche bun.",
    price: 350,
    preparation_time_minutes: 15,
    is_available: true,
  },
  {
    id: 10,
    category_id: 3,
    code: "M03",
    name: "Mediterranean Quinoa & Protein Salad",
    description: "Organic red quinoa, kalamata olives, diced cucumbers, bell peppers, Greek feta, and lemon vinaigrette.",
    price: 340,
    preparation_time_minutes: 10,
    is_available: true,
  },
];

export default function CafePage() {
  const { user, isAuthenticated } = useCurrentUser();
  const [categories, setCategories] = useState<CafeCategory[]>(FALLBACK_CATEGORIES);
  const [menuItems, setMenuItems] = useState<CafeMenuItem[]>(FALLBACK_MENU);
  const [selectedCatId, setSelectedCatId] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderModalItem, setOrderModalItem] = useState<CafeMenuItem | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [tableNumber, setTableNumber] = useState("Lounge Table #4");
  const [orderSuccessMsg, setOrderSuccessMsg] = useState("");

  const fetchCafeMenu = useCallback(async () => {
    try {
      const [catsRes, itemsRes] = await Promise.allSettled([
        apiClient.get<any>("/pos/menu/categories"),
        apiClient.get<any>("/pos/menu"),
      ]);

      if (catsRes.status === "fulfilled" && catsRes.value) {
        const cList = Array.isArray(catsRes.value) ? catsRes.value : catsRes.value?.data || [];
        if (cList.length > 0) setCategories(cList);
      }

      if (itemsRes.status === "fulfilled" && itemsRes.value) {
        const mList = Array.isArray(itemsRes.value) ? itemsRes.value : itemsRes.value?.data || [];
        if (mList.length > 0) setMenuItems(mList);
      }
    } catch {
      // Fallback data is already initialized
    }
  }, []);

  useEffect(() => {
    fetchCafeMenu();
  }, [fetchCafeMenu]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCatId !== "ALL" && item.category_id !== selectedCatId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [menuItems, selectedCatId, searchQuery]);

  const handlePlaceOrder = () => {
    if (!orderModalItem) return;
    setOrderSuccessMsg(
      `Order placed for ${orderQuantity}x ${orderModalItem.name}! Our lounge staff will serve you at ${tableNumber}.`
    );
    setTimeout(() => {
      setOrderSuccessMsg("");
      setOrderModalItem(null);
      setOrderQuantity(1);
    }, 3500);
  };

  const isStaff = isOwner(user) || isStaffOrAdmin(user);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-[family-name:var(--font-inter)] selection:bg-lime-300 selection:text-slate-900">
      {/* Navigation Header */}
      <Navbar />

      {/* Main Content Area */}
      <main className="flex-1 pt-24 sm:pt-28 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Breadcrumb / Back Link */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Link
              href="/#facilities"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Club Amenities</span>
            </Link>

            {isStaff && (
              <Link
                href="/pos"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm"
              >
                <ChefHat className="w-3.5 h-3.5 text-amber-400" />
                <span>Open Kitchen POS Terminal</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </Link>
            )}
          </div>

          {/* Hero Banner Card */}
          <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200 bg-slate-950 text-white min-h-[320px] sm:min-h-[360px] flex flex-col justify-end p-6 sm:p-12">
            <Image
              src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1600&q=85"
              alt="Champions Lounge & Café Ambiance"
              fill
              priority
              className="object-cover opacity-45 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

            <div className="relative z-10 max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-400/20 text-lime-300 border border-lime-400/30 text-xs font-bold uppercase tracking-wider">
                <Coffee className="w-3.5 h-3.5 text-lime-400" />
                <span>Athletic Nutrition & Center-Court Dining</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
                Champions Lounge & Café
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                Post-match recovery protein smoothies, specialty cold-pressed juices, artisan roast espresso, and fresh chef-prepared gourmet bowls with 4K live stadium screenings.
              </p>

              {/* Highlight Perks Strip */}
              <div className="pt-2 flex items-center gap-2 sm:gap-4 flex-wrap text-xs text-slate-200 font-semibold">
                <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                  <CheckCircle2 className="w-3.5 h-3.5 text-lime-400" />
                  100% Organic Ingredients
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Whey Protein & Electrolyte Bar
                </span>
                <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                  <Crown className="w-3.5 h-3.5 text-sky-400" />
                  Direct Member Tab Charging
                </span>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCatId("ALL")}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                  selectedCatId === "ALL"
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                    : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                }`}
              >
                🌟 Complete Menu ({menuItems.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                    selectedCatId === cat.id
                      ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                      : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search food, coffee, smoothies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-lime-600 focus:ring-2 focus:ring-lime-500/20 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Menu Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <Search className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No dishes or beverages match your search.</p>
              <button
                onClick={() => {
                  setSelectedCatId("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-bold text-lime-700 hover:underline"
              >
                Reset filters to view all menu items
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => {
                const tagInfo = ITEM_TAGS[item.code] || {
                  badge: "Chef Specialty",
                  color: "bg-lime-100 text-lime-900 border-lime-200",
                };
                const imgUrl = getMenuItemImageUrl(item);

                return (
                  <div
                    key={item.id}
                    className="group bg-white rounded-3xl overflow-hidden border border-slate-200 hover:border-lime-400 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Top Thumbnail */}
                      <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                        <Image
                          src={imgUrl}
                          alt={item.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                        {/* Top Badge */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-xs ${tagInfo.color}`}
                          >
                            {tagInfo.badge}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white border border-white/20">
                            {item.code}
                          </span>
                        </div>

                        {/* Bottom Prep Time */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] text-white/90 font-medium">
                          <Clock className="w-3.5 h-3.5 text-lime-400" />
                          <span>{item.preparation_time_minutes ?? 10} mins prep</span>
                        </div>
                      </div>

                      {/* Content Card Body */}
                      <div className="p-5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-black text-slate-900 font-[family-name:var(--font-outfit)] leading-snug group-hover:text-lime-700 transition-colors">
                            {item.name}
                          </h3>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {item.description || "Freshly crafted using high-grade organic athletic club ingredients."}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between gap-3 mt-auto">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Price</div>
                        <div className="text-lg font-black text-slate-900">
                          ₹{Number(item.price).toLocaleString("en-IN")}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setOrderModalItem(item);
                          setOrderQuantity(1);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-lime-700 hover:bg-lime-800 active:scale-98 text-white font-extrabold text-xs shadow-md shadow-lime-700/20 transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Order at Lounge</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Member Privileges Notice Card */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-lime-950 via-slate-900 to-slate-950 text-white flex flex-col sm:flex-row items-center justify-between gap-6 border border-lime-800/40 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-lime-500/20 text-lime-400 border border-lime-500/30 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black tracking-tight text-white font-[family-name:var(--font-outfit)]">
                  Seamless Member Charge Tab & Lounge Service
                </h4>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  Club members enjoy cashless table service. Simply mention your Member Code to your server or at the counter to charge meals and drinks directly to your monthly statement.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/membership"
                className="px-5 py-3 rounded-2xl bg-lime-500 hover:bg-lime-400 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Explore Memberships</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* LOUNGE ORDER MODAL */}
      {orderModalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setOrderModalItem(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-slate-900 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-lime-700" />
                <h3 className="text-lg font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  Lounge Table Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOrderModalItem(null)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Selected Item Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3.5">
              {ITEM_IMAGES[orderModalItem.code] && (
                <img
                  src={ITEM_IMAGES[orderModalItem.code]}
                  alt={orderModalItem.name}
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {orderModalItem.code}
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 truncate">{orderModalItem.name}</h4>
                <div className="text-xs font-black text-emerald-600">₹{orderModalItem.price} each</div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-2">Select Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOrderQuantity(Math.max(1, orderQuantity - 1))}
                  className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-black text-base flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-12 text-center text-base font-black text-slate-900 font-mono">
                  {orderQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setOrderQuantity(orderQuantity + 1)}
                  className="w-10 h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-black text-base flex items-center justify-center"
                >
                  +
                </button>
                <div className="ml-auto text-right">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Amount</span>
                  <span className="text-base font-black text-slate-900">
                    ₹{(orderModalItem.price * orderQuantity).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Table / Seating Selection */}
            <div>
              <label className="text-xs font-extrabold text-slate-700 block mb-2">Lounge Table Location</label>
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:border-lime-600"
              >
                <option value="Lounge Table #1 (Center Court View)">Lounge Table #1 (Center Court View)</option>
                <option value="Lounge Table #2 (Padel Arena View)">Lounge Table #2 (Padel Arena View)</option>
                <option value="Lounge Table #3 (Terrace Balcony)">Lounge Table #3 (Terrace Balcony)</option>
                <option value="Lounge Table #4 (Courtside Sofa)">Lounge Table #4 (Courtside Sofa)</option>
                <option value="Lounge Bar Counter #1">Lounge Bar Counter #1</option>
                <option value="Pick-Up at Café Counter">Pick-Up at Café Counter</option>
              </select>
            </div>

            {/* Billing Method Note */}
            <div className="p-3.5 rounded-xl bg-lime-50 border border-lime-200 text-xs text-lime-900 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-lime-700 shrink-0 mt-0.5" />
              <span>
                {isAuthenticated
                  ? `Authenticated as ${user?.name || "Member"}. This order will be charged to your active Member Tab.`
                  : "Walk-in guests can pay instantly at the counter via UPI, Card, or Cash upon delivery."}
              </span>
            </div>

            {/* Success Feedback */}
            {orderSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{orderSuccessMsg}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handlePlaceOrder}
                className="flex-1 py-3 px-4 rounded-xl bg-lime-700 hover:bg-lime-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Confirm Lounge Order (₹{(orderModalItem.price * orderQuantity).toLocaleString("en-IN")})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderModalItem(null)}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}
