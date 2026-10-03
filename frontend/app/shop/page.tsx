/**
 * Champions Club — Member-Facing Pro Shop Main Application (/shop)
 *
 * Full-featured member commerce boutique:
 * - Real-time inventory synchronization from backend
 * - Category tabs, live search & multi-criterion sorter
 * - Stock availability states (In Stock, Low Stock, Out of Stock)
 * - Persistent Cart with automatic server quote & member tier discounts
 * - Checkout with Pickup & Delivery fulfillment validation
 * - Online payment via Razorpay test gateway with backend verification
 * - Order confirmation and complete order history tracking
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Sparkles,
  Search,
  Filter,
  Package,
  AlertTriangle,
  RotateCcw,
  Loader2,
  Crown,
  Zap,
  ArrowRight,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useCurrentUser } from "@/lib/auth";
import { useCart } from "@/lib/cart/useCart";

import ProShopHeader from "@/components/shop/ProShopHeader";
import CategoryFilterBar, { CategoryOption } from "@/components/shop/CategoryFilterBar";
import ProductCard, { BackendProduct } from "@/components/shop/ProductCard";
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
    refreshQuote,
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
        // Fallback default category tabs
        setCategories([
          { id: "1", name: "Rackets", slug: "rackets" },
          { id: "2", name: "Balls & Shuttles", slug: "balls" },
          { id: "3", name: "Footwear", slug: "shoes" },
          { id: "4", name: "Club Apparel", slug: "apparel" },
          { id: "5", name: "Strings & Gear", slug: "accessories" },
        ]);
      }

      // Set products
      const rawProducts = Array.isArray(prodRes)
        ? prodRes
        : (prodRes as any)?.products || (prodRes as any)?.data || [];

      if (Array.isArray(rawProducts)) {
        setProducts(rawProducts);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      setLoadError(err?.message || "Failed to load Pro Shop products. Ensure backend is active.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  // Filter & Sort Pipeline
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        // Category filter
        if (selectedCategory !== "ALL") {
          const catSlug = product.category?.slug?.toLowerCase() || "";
          if (catSlug !== selectedCategory.toLowerCase()) return false;
        }

        // In stock only filter
        if (inStockOnly && product.stock_quantity <= 0) {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = product.name?.toLowerCase().includes(q);
          const matchSku = product.sku?.toLowerCase().includes(q);
          const matchDesc = product.description?.toLowerCase().includes(q);
          const matchCat = product.category?.name?.toLowerCase().includes(q);
          if (!matchName && !matchSku && !matchDesc && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return Number(a.price) - Number(b.price);
        if (sortBy === "price_desc") return Number(b.price) - Number(a.price);
        if (sortBy === "stock") return b.stock_quantity - a.stock_quantity;
        return a.id - b.id; // default featured
      });
  }, [products, selectedCategory, inStockOnly, searchQuery, sortBy]);

  // Handlers
  const handleAddToCart = (product: BackendProduct, quantity = 1) => {
    addToCart(
      {
        id: product.id,
        sku: product.sku,
        name: product.name,
        categoryName: product.category?.name,
        categorySlug: product.category?.slug,
        price: Number(product.price),
        stockQuantity: product.stock_quantity,
        imageUrl: product.image_url,
      },
      quantity
    );
  };

  const handleInstantCheckout = (product: BackendProduct, quantity = 1) => {
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
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = (confirmedOrder: CreatedOrderResponse) => {
    setIsPaymentOpen(false);
    setActiveOrder(confirmedOrder);
    clearCart();
    setIsConfirmationOpen(true);
    fetchShopData(); // refresh stock numbers
  };

  const handleOrderCancelled = (cancelledOrder: CreatedOrderResponse) => {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Top Header Navigation */}
      <ProShopHeader
        cartCount={totalItemsCount}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenOrders={handleOpenMyOrders}
      />

      {/* Hero Banner Showcase */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800/80 py-10 sm:py-14">
        {/* Glow Spheres */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/20 to-blue-500/20 border border-sky-500/30 text-sky-400 text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Official Match & Workshop Store</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-[family-name:var(--font-outfit)] tracking-tight leading-tight">
              Tour Equipment, Rackets & Club Merchandise
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
              Equip yourself with authorized Wilson, Babolat, Head, and Yonex performance gear with real-time stock allocation and digital member tier discounts.
            </p>
          </div>
        </div>
      </section>

      {/* Main Catalog View Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full">
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
            <Loader2 className="w-10 h-10 text-sky-400 animate-spin mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Loading Pro Shop Inventory...</h3>
              <p className="text-xs text-slate-400 mt-1">Connecting to club warehouse database.</p>
            </div>
          </div>
        ) : loadError ? (
          <div className="py-16 text-center space-y-4 max-w-md mx-auto p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Unable to Load Inventory</h3>
              <p className="text-xs text-slate-400 mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={fetchShopData}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-600/20"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center space-y-3 p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80">
            <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Search className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white">No Products Matched Your Criteria</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Try adjusting your category filter or search keywords to find available items.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("ALL");
                setSearchQuery("");
                setInStockOnly(false);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:text-white"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
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
        onStockError={handleStockError}
      />

      {/* Online Payment Modal */}
      <PaymentModal
        order={activeOrder}
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
        onOrderCancelled={handleOrderCancelled}
      />

      {/* Order Confirmation Screen */}
      <OrderConfirmationModal
        order={activeOrder}
        isOpen={isConfirmationOpen}
        onClose={() => {
          setIsConfirmationOpen(false);
          setActiveOrder(null);
        }}
        onViewMyOrders={() => {
          setIsConfirmationOpen(false);
          setActiveOrder(null);
          setIsOrdersOpen(true);
        }}
      />

      {/* My Orders History Modal */}
      <MyOrdersModal
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        onPayUnpaidOrder={(order) => {
          setIsOrdersOpen(false);
          setActiveOrder(order);
          setIsPaymentOpen(true);
        }}
      />
    </div>
  );
}
