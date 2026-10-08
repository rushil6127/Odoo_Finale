/**
 * Champions Club — Member-Facing Pro Shop Main Application (/shop)
 * Luxury Light Theme matching the entire Champions Club design system
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Sparkles,
  Search,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ChevronLeft,
  Package,
  Crown,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth";
import { useCart } from "@/lib/cart/useCart";

import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import CategoryFilterBar, { CategoryOption } from "@/components/shop/CategoryFilterBar";
import ProductCard, { BackendProduct, getProductImage } from "@/components/shop/ProductCard";
import ProductDetailModal from "@/components/shop/ProductDetailModal";
import CartDrawer from "@/components/shop/CartDrawer";
import CheckoutModal, { CreatedOrderResponse } from "@/components/shop/CheckoutModal";
import PaymentModal from "@/components/shop/PaymentModal";
import OrderConfirmationModal from "@/components/shop/OrderConfirmationModal";
import MyOrdersModal from "@/components/shop/MyOrdersModal";
import StockErrorBanner from "@/components/shop/StockErrorBanner";

export default function ProShopPage() {
  const router = useRouter();
  const { user: currentUser, isAuthenticated } = useCurrentUser();

  const {
    items: cartItems,
    quote,
    isQuoteLoading,
    quoteError,
    totalItemsCount,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  // Data states
  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"featured" | "price_asc" | "price_desc" | "stock">("featured");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Modal states
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<BackendProduct | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  // Active Transaction Order
  const [activeOrder, setActiveOrder] = useState<CreatedOrderResponse | null>(null);
  const [stockErrorMessage, setStockErrorMessage] = useState<string | null>(null);

  // Fetch Categories & Products from Backend APIs
  const fetchShopData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const [catRes, prodRes] = await Promise.all([
        apiClient.get<{ categories: Array<{ id: number; name: string; slug: string }> }>("/inventory/categories").catch(() => null),
        apiClient.get<{ products: BackendProduct[] } | BackendProduct[]>("/inventory/products?per_page=100").catch(() => null),
      ]);

      // Set categories
      if (catRes && Array.isArray(catRes.categories)) {
        setCategories(
          catRes.categories.map((c) => ({
            id: String(c.id),
            name: c.name,
            slug: c.slug,
          }))
        );
      } else {
        // Default category tabs
        setCategories([
          { id: "1", name: "Rackets", slug: "rackets" },
          { id: "2", name: "Balls & Shuttles", slug: "balls" },
          { id: "3", name: "Footwear", slug: "shoes" },
          { id: "4", name: "Club Apparel", slug: "apparel" },
          { id: "5", name: "Strings & Gear", slug: "accessories" },
        ]);
      }

      // Set products
      // Set products
      const rawProducts = Array.isArray(prodRes)
        ? prodRes
        : prodRes && Array.isArray((prodRes as any).products)
        ? (prodRes as any).products
        : prodRes && (prodRes as any).data && Array.isArray((prodRes as any).data.products)
        ? (prodRes as any).data.products
        : [];

      // Map backend products
      const mapped = rawProducts.map((p: any) => ({
        id: p.id,
        sku: p.sku || `SKU-${p.id}`,
        name: p.name,
        category_id: p.category_id,
        category: p.category || (p.category_name ? { id: p.category_id, name: p.category_name, slug: p.category_slug || "" } : undefined),
        price: typeof p.price === "number" ? p.price : parseFloat(p.price || "0"),
        cost_price: p.cost_price ? parseFloat(p.cost_price) : undefined,
        stock_quantity: p.stock_quantity ?? 0,
        low_stock_threshold: p.low_stock_threshold || 5,
        description: p.description,
        barcode: p.barcode,
        image_url: p.image_url || getProductImage(p),
        is_active: p.is_active ?? true,
        is_low_stock: (p.stock_quantity ?? 0) <= (p.low_stock_threshold || 5) && (p.stock_quantity ?? 0) > 0,
        is_out_of_stock: (p.stock_quantity ?? 0) <= 0,
      }));

      if (mapped.length > 0) {
        setProducts(mapped);
      } else {
        // Fallback baseline products if database has no products yet
        setProducts([
          {
            id: 1,
            sku: "RCK-WIL-PRO97",
            name: "Wilson Pro Staff 97 v14",
            category_id: 1,
            category: { id: 1, name: "Rackets", slug: "rackets" },
            price: 22000,
            stock_quantity: 12,
            low_stock_threshold: 3,
            description: "Precision and feel for advanced players. 315g unstrung.",
            image_url: "/images/products/wilson-pro-staff.jpg",
            is_active: true,
            is_low_stock: false,
            is_out_of_stock: false,
          },
          {
            id: 2,
            sku: "RCK-BAB-AER",
            name: "Babolat Pure Aero 2023",
            category_id: 1,
            category: { id: 1, name: "Rackets", slug: "rackets" },
            price: 21500,
            stock_quantity: 8,
            low_stock_threshold: 3,
            description: "Maximum spin and power. Rafael Nadal edition.",
            image_url: "/images/products/babolat-pure-aero.jpg",
            is_active: true,
            is_low_stock: false,
            is_out_of_stock: false,
          },
          {
            id: 3,
            sku: "BAL-WIL-US3",
            name: "Wilson US Open Tennis Balls (Can of 3)",
            category_id: 2,
            category: { id: 2, name: "Balls", slug: "balls" },
            price: 650,
            stock_quantity: 120,
            low_stock_threshold: 25,
            description: "Official ball of the US Open. Premium woven felt.",
            image_url: "/images/products/wilson-us-open-balls.jpg",
            is_active: true,
            is_low_stock: false,
            is_out_of_stock: false,
          },
          {
            id: 4,
            sku: "BAL-HEAD-PRO",
            name: "HEAD Padel Pro S (Can of 3)",
            category_id: 2,
            category: { id: 2, name: "Balls", slug: "balls" },
            price: 750,
            stock_quantity: 50,
            low_stock_threshold: 15,
            description: "Faster ball for dynamic padel rallies.",
            image_url: "/images/products/head-padel-pro.jpg",
            is_active: true,
            is_low_stock: false,
            is_out_of_stock: false,
          },
          {
            id: 5,
            sku: "SHOE-ASI-RES8",
            name: "Asics Gel Resolution 8 (Size 10)",
            category_id: 3,
            category: { id: 3, name: "Shoes", slug: "shoes" },
            price: 11999,
            stock_quantity: 4,
            low_stock_threshold: 5,
            description: "Advanced stability and cushioning for competitive tennis.",
            image_url: "/images/products/asics-gel-resolution.jpg",
            is_active: true,
            is_low_stock: true,
            is_out_of_stock: false,
          },
          {
            id: 6,
            sku: "APP-CHAMP-POLO",
            name: "Champions Club Dri-Fit Team Polo (M)",
            category_id: 4,
            category: { id: 4, name: "Apparel", slug: "apparel" },
            price: 1499,
            stock_quantity: 25,
            low_stock_threshold: 10,
            description: "Official club crest moisture-wicking polo.",
            image_url: "/images/products/champions-club-polo.jpg",
            is_active: true,
            is_low_stock: false,
            is_out_of_stock: false,
          },
          {
            id: 7,
            sku: "ACC-YON-OVER3",
            name: "Yonex Super Grap Overgrip (Pack of 3)",
            category_id: 5,
            category: { id: 5, name: "Accessories", slug: "accessories" },
            price: 450,
            stock_quantity: 60,
            low_stock_threshold: 20,
            description: "Tacky feel and excellent shock absorption.",
            image_url: "/images/products/yonex-super-grap.jpg",
            is_active: true,
            is_low_stock: false,
            is_out_of_stock: false,
          },
        ]);
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load boutique catalog. Please verify connection.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (selectedCategory !== "ALL") {
        const prodCatSlug = p.category?.slug?.toLowerCase() || "";
        const prodCatName = p.category?.name?.toLowerCase() || "";
        const sel = selectedCategory.toLowerCase();
        const matchesCategory =
          prodCatSlug.includes(sel) ||
          prodCatName.includes(sel) ||
          (sel === "rackets" && (p.name.toLowerCase().includes("racket") || p.name.toLowerCase().includes("pure") || p.name.toLowerCase().includes("staff") || p.name.toLowerCase().includes("astrox"))) ||
          (sel === "balls" && (p.name.toLowerCase().includes("ball") || p.name.toLowerCase().includes("shuttle"))) ||
          (sel === "shoes" && (p.name.toLowerCase().includes("shoe") || p.name.toLowerCase().includes("barricade"))) ||
          (sel === "apparel" && (p.name.toLowerCase().includes("polo") || p.name.toLowerCase().includes("shirt") || p.name.toLowerCase().includes("wear"))) ||
          (sel === "accessories" && (p.name.toLowerCase().includes("grip") || p.name.toLowerCase().includes("string") || p.name.toLowerCase().includes("dampener")));

        if (!matchesCategory) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // In stock only filter
      if (inStockOnly && p.stock_quantity <= 0) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "stock") return b.stock_quantity - a.stock_quantity;
      return 0; // featured default
    });
  }, [products, selectedCategory, searchQuery, sortBy, inStockOnly]);

  const handleAddToCart = (product: BackendProduct, quantity: number) => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        stockQuantity: product.stock_quantity,
        imageUrl: getProductImage(product),
      },
      quantity
    );
  };

  const handleInstantCheckout = (product: BackendProduct, quantity: number) => {
    handleAddToCart(product, quantity);
    setSelectedDetailProduct(null);
    if (!isAuthenticated) {
      router.push("/login?returnUrl=/shop");
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    if (!isAuthenticated) {
      router.push("/login?returnUrl=/shop");
      return;
    }
    setIsCheckoutOpen(true);
  };

  const handleOrderCreated = (createdOrder: CreatedOrderResponse) => {
    setIsCheckoutOpen(false);
    setActiveOrder(createdOrder);
    
    if (createdOrder.payment_method === "CASH") {
      clearCart();
      setIsConfirmationOpen(true);
      fetchShopData();
    } else {
      setIsPaymentOpen(true);
    }
  };

  const handlePaymentSuccess = (confirmedOrder: CreatedOrderResponse) => {
    setIsPaymentOpen(false);
    setActiveOrder(confirmedOrder);
    clearCart();
    setIsConfirmationOpen(true);
    fetchShopData(); // refresh stock numbers
  };

  const handleOrderCancelled = () => {
    setIsPaymentOpen(false);
    setActiveOrder(null);
    fetchShopData(); // refresh restored stock
    setIsOrdersOpen(true);
  };

  const handleStockError = (msg: string) => {
    setStockErrorMessage(msg);
    fetchShopData();
  };

  const handleOpenMyOrders = () => {
    if (!isAuthenticated) {
      router.push("/login?returnUrl=/shop");
      return;
    }
    setIsOrdersOpen(true);
  };

  const planName = (currentUser as any)?.membershipPlan || null;

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col selection:bg-sky-200 selection:text-sky-900 font-sans">
      {/* Ambient background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-sky-400/5 blur-3xl" />
        <div className="absolute top-1/2 -left-60 w-[500px] h-[500px] rounded-full bg-emerald-400/5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-400/5 blur-3xl" />
      </div>

      {/* Main Global Floating Pill Navbar */}
      <Navbar />

      {/* Main Catalog View Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-16 space-y-6 w-full">
        {/* Navigation Breadcrumb & Quick Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/" className="hover:text-sky-600 transition-colors flex items-center gap-1">
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">The Pro Shop</span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* My Orders button */}
            <button
              type="button"
              onClick={handleOpenMyOrders}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 transition-all shadow-2xs active:scale-95"
              title="View My Pro Shop Order History"
            >
              <Package className="w-4 h-4 text-sky-600" />
              <span>My Orders</span>
            </button>

            {/* Cart Trigger */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-slate-900 hover:bg-sky-600 text-white shadow-sm hover:shadow-md transition-all active:scale-95"
              title="Open Shopping Cart"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
              <span>Cart</span>
              {totalItemsCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-lime-400 text-slate-950 font-black text-[10px] shadow-sm animate-in zoom-in-50">
                  {totalItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hero Banner Showcase — Luxury Light Theme */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-200/90 bg-white p-6 sm:p-10 shadow-sm">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-400/10 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Authorized Performance Boutique</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-[family-name:var(--font-outfit)] tracking-tight leading-tight">
              Tour Equipment, Rackets &{" "}
              <span className="bg-gradient-to-r from-sky-600 via-blue-700 to-sky-800 bg-clip-text text-transparent">
                Club Merchandise
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
              Equip yourself with authorized Wilson, Babolat, Head, and Yonex performance gear with real-time stock allocation and digital member tier discounts.
            </p>

            {/* Member Tier Privilege Callout */}
            {isAuthenticated && currentUser && (
              <div className="pt-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs font-bold text-amber-900 shadow-2xs">
                  <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    {planName?.toUpperCase() === "GOLD"
                      ? "Gold Tier Member • 20% Equipment & Apparel Discount Active"
                      : planName?.toUpperCase() === "SILVER"
                      ? "Silver Tier Member • 10% Pro Shop Equipment Discount Active"
                      : planName?.toUpperCase() === "JUNIOR"
                      ? "Junior Pass Member • 15% Balls, Shoes & Strings Discount Active"
                      : "Club Member • Automatic Tier Savings Calculated at Checkout"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stock Conflict Banner */}
        <StockErrorBanner
          errorMessage={stockErrorMessage}
          onClear={() => setStockErrorMessage(null)}
          onRefresh={fetchShopData}
        />

        {/* Filter, Search & Sorter Controls */}
        <CategoryFilterBar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          sortBy={sortBy}
          onSortChange={(s) => setSortBy(s)}
          inStockOnly={inStockOnly}
          onToggleInStockOnly={() => setInStockOnly((prev) => !prev)}
          totalProductsCount={filteredProducts.length}
        />

        {/* Product Grid Content */}
        {isLoading ? (
          <div className="py-24 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Loading Pro Shop Inventory...</h3>
              <p className="text-xs text-slate-500 mt-1">Connecting to club warehouse database.</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center space-y-4 max-w-md mx-auto p-8 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Unable to Load Inventory</h3>
              <p className="text-xs text-slate-500 mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={fetchShopData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-slate-900 hover:bg-sky-600 text-white transition-all shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center space-y-3 p-8 rounded-3xl bg-white border border-slate-200/90 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Products Matched Your Criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your category filter or search keywords to find available items.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSearchQuery("");
                setInStockOnly(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currentUser={currentUser}
                onAddToCart={(p, qty) => handleAddToCart(p, qty)}
                onClickDetails={(p) => setSelectedDetailProduct(p)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Global Footer matching the rest of the site */}
      <Footer />

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedDetailProduct}
        isOpen={!!selectedDetailProduct}
        onClose={() => setSelectedDetailProduct(null)}
        currentUser={currentUser}
        onAddToCart={(p, qty) => handleAddToCart(p, qty)}
        onInstantCheckout={(p, qty) => handleInstantCheckout(p, qty)}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        quote={quote}
        isQuoteLoading={isQuoteLoading}
        quoteError={quoteError}
        currentUser={currentUser}
        onUpdateQuantity={(pid, qty) => updateQuantity(pid, qty)}
        onRemoveItem={(pid) => removeFromCart(pid)}
        onClearCart={clearCart}
        onProceedToCheckout={handleProceedToCheckout}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        quote={quote}
        currentUser={currentUser}
        onOrderCreated={handleOrderCreated}
        onStockConflict={handleStockError}
      />

      {/* Payment Gateway Modal */}
      <PaymentModal
        order={activeOrder}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
        onOrderCancelled={handleOrderCancelled}
      />

      {/* Order Confirmation Modal */}
      <OrderConfirmationModal
        order={activeOrder}
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onViewMyOrders={() => {
          setIsConfirmationOpen(false);
          setIsOrdersOpen(true);
        }}
      />

      {/* My Orders History Drawer */}
      <MyOrdersModal
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        onPayUnpaidOrder={(order) => {
          setActiveOrder(order);
          setIsPaymentOpen(true);
        }}
      />
    </div>
  );
}
