/**
 * Champions Club — Pro Equipment & Merchandise Store Management
 */

"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";
import {
  ShoppingBag,
  Search,
  Plus,
  Tag,
  Star,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  Wrench,
  Percent,
  Activity,
  CircleDot,
  Shirt,
  Glasses,
  Layers
} from "lucide-react";

interface Product {
  id: number;
  name: string;
  category: "RACKETS" | "BALLS_SHUTTLES" | "APPAREL" | "ACCESSORIES" | "SERVICES";
  brand: string;
  price: number;
  stock: number;
  rating: number;
  image?: string;
  inStock: boolean;
}

const getProductCategoryIcon = (category: string) => {
  switch (category) {
    case "RACKETS":
      return <Activity className="w-6 h-6 text-sky-600" />;
    case "BALLS_SHUTTLES":
      return <CircleDot className="w-6 h-6 text-emerald-600" />;
    case "APPAREL":
      return <Shirt className="w-6 h-6 text-indigo-600" />;
    case "ACCESSORIES":
      return <Glasses className="w-6 h-6 text-cyan-600" />;
    case "SERVICES":
      return <Wrench className="w-6 h-6 text-rose-600" />;
    default:
      return <ShoppingBag className="w-6 h-6 text-slate-700" />;
  }
};

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("Yonex");
  const [newPrice, setNewPrice] = useState("1200");
  const [newStock, setNewStock] = useState("10");
  const [newCategory, setNewCategory] = useState<Product["category"]>("RACKETS");

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>("/inventory/products");
      const list = Array.isArray(res) ? res : res?.products || res?.data || [];
      if (list && list.length > 0) {
        const mapped: Product[] = list.map((p: any) => ({
          id: p.id,
          name: p.name,
          category: p.category?.name?.toUpperCase()?.includes("RACKET")
            ? "RACKETS"
            : p.category?.name?.toUpperCase()?.includes("SHUTTLE") || p.category?.name?.toUpperCase()?.includes("BALL")
            ? "BALLS_SHUTTLES"
            : p.category?.name?.toUpperCase()?.includes("APPAREL")
            ? "APPAREL"
            : "ACCESSORIES",
          brand: p.brand || "Champions Club",
          price: Number(p.price) || 1200,
          stock: p.stock_quantity ?? p.stock ?? 10,
          rating: 4.9,
          inStock: (p.stock_quantity ?? p.stock ?? 1) > 0,
        }));
        setProducts(mapped);
      } else {
        setProducts([]);
      }
    } catch (err) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setActionLoading(true);
      await apiClient.post<any>("/inventory/products", {
        name: newName.trim(),
        price: Number(newPrice),
        sku: `SKU-${Date.now().toString().slice(-6)}`,
        initial_stock: Number(newStock),
        brand: newBrand,
      });
      setShowAddModal(false);
      setNewName("");
      await fetchProducts();
    } catch (err: any) {
      alert(err?.message || "Failed to create product in database.");
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = selectedCat === "ALL" || p.category === selectedCat;
    const matchQ = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 font-[family-name:var(--font-outfit)]">
              Pro Shop & Equipment Store Management
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage sports gear catalogue, racket stringing intake, merchandise pricing, and sales.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Gear / Service</span>
        </button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Catalogue Items</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{products.length} SKUs</p>
          <p className="text-[11px] text-indigo-600 font-bold mt-1">Rackets, Apparel, Strings</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Today&apos;s Pro Shop Sales</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">₹34,200</p>
          <p className="text-[11px] text-slate-500 mt-1">11 items sold</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Active Stringing Requests</p>
          <p className="text-2xl font-black text-amber-600 mt-1">6 Rackets</p>
          <p className="text-[11px] text-slate-500 mt-1">In workshop queue</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase">Total Inventory Value</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            ₹{products.reduce((acc, p) => acc + p.price * p.stock, 0).toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">At retail price</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search gear by name or brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
          {[
            { id: "ALL", label: "All Gear" },
            { id: "RACKETS", label: "Rackets & Bats" },
            { id: "BALLS_SHUTTLES", label: "Shuttles & Balls" },
            { id: "APPAREL", label: "Apparel" },
            { id: "ACCESSORIES", label: "Accessories" },
            { id: "SERVICES", label: "Stringing & Care" },
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

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-indigo-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group-hover:scale-105 transition-transform shrink-0 shadow-sm">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      {getProductCategoryIcon(product.category)}
                    </div>
                  )}
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700">
                  {product.brand}
                </span>
              </div>

              <div className="mt-4">
                <h3 className="font-black text-xs text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                  {product.name}
                </h3>
                <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-500 font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{product.rating}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold">Price</p>
                <p className="text-sm font-black text-slate-900 font-[family-name:var(--font-outfit)]">
                  ₹{product.price.toLocaleString()}
                </p>
              </div>

              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${product.stock < 10 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {product.stock} in stock
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
