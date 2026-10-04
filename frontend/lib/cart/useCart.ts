/**
 * Champions Club — Pro Shop Cart Client Store & Reactive Hook
 *
 * Provides persistent cart management (localStorage: "cc_pro_shop_cart")
 * with cross-component reactivity, stock bounds checking, and
 * real-time quote preview integration with POST /api/v1/shop/quote.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

export interface CartItem {
  productId: number;
  sku: string;
  name: string;
  brand?: string;
  categoryName?: string;
  categorySlug?: string;
  price: number;
  stockQuantity: number;
  imageUrl?: string | null;
  quantity: number;
}

export interface QuoteItem {
  product_id: number;
  product_sku: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  stock_quantity: number;
  is_out_of_stock: boolean;
  discount_pct: number;
  discount_amount: number;
  total_price: number;
}

export interface QuoteData {
  items: QuoteItem[];
  subtotal_amount: number;
  discount_amount: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  plan_code: string | null;
  member_discount_applied: boolean;
}

const CART_STORAGE_KEY = "cc_pro_shop_cart";
const CART_CHANGE_EVENT = "cc_cart_updated";

function getStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(CART_CHANGE_EVENT, { detail: items }));
  } catch (err) {
    console.error("Failed to save cart to localStorage:", err);
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Sync state on mount and subscribe to cross-component updates
  useEffect(() => {
    setItems(getStoredCart());

    const handleCartUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<CartItem[]>;
      if (customEvent.detail) {
        setItems(customEvent.detail);
      } else {
        setItems(getStoredCart());
      }
    };

    window.addEventListener(CART_CHANGE_EVENT, handleCartUpdate);
    window.addEventListener("storage", handleCartUpdate);
    return () => {
      window.removeEventListener(CART_CHANGE_EVENT, handleCartUpdate);
      window.removeEventListener("storage", handleCartUpdate);
    };
  }, []);

  // Fetch real-time server quote whenever cart items change
  const fetchQuote = useCallback(async (cartItems: CartItem[]) => {
    if (cartItems.length === 0) {
      setQuote(null);
      setIsQuoteLoading(false);
      return;
    }

    try {
      setIsQuoteLoading(true);
      setQuoteError(null);
      const res = await apiClient.post<{ quote: QuoteData }>("/shop/quote", {
        items: cartItems.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      });

      if (res && res.quote) {
        setQuote(res.quote);
      }
    } catch (err: any) {
      setQuoteError(err?.message || "Failed to calculate live quote.");
    } finally {
      setIsQuoteLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuote(items);
  }, [items, fetchQuote]);

  const addToCart = useCallback(
    (product: {
      id: number;
      sku: string;
      name: string;
      brand?: string;
      categoryName?: string;
      categorySlug?: string;
      price: number;
      stockQuantity: number;
      imageUrl?: string | null;
    }, quantityToAdd = 1): { success: boolean; message?: string } => {
      if (product.stockQuantity <= 0) {
        return { success: false, message: `"${product.name}" is currently out of stock.` };
      }

      const current = getStoredCart();
      const existingIndex = current.findIndex((i) => i.productId === product.id);

      if (existingIndex > -1) {
        const existing = current[existingIndex];
        const newQty = existing.quantity + quantityToAdd;
        if (newQty > product.stockQuantity) {
          return {
            success: false,
            message: `Cannot add more. Only ${product.stockQuantity} item(s) available in stock.`,
          };
        }
        current[existingIndex] = {
          ...existing,
          quantity: newQty,
          stockQuantity: product.stockQuantity,
          price: product.price,
        };
      } else {
        if (quantityToAdd > product.stockQuantity) {
          return {
            success: false,
            message: `Only ${product.stockQuantity} item(s) available in stock.`,
          };
        }
        current.push({
          productId: product.id,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          categoryName: product.categoryName,
          categorySlug: product.categorySlug,
          price: product.price,
          stockQuantity: product.stockQuantity,
          imageUrl: product.imageUrl,
          quantity: quantityToAdd,
        });
      }

      saveStoredCart(current);
      return { success: true, message: `Added "${product.name}" to cart.` };
    },
    []
  );

  const updateQuantity = useCallback((productId: number, newQty: number) => {
    const current = getStoredCart();
    const itemIndex = current.findIndex((i) => i.productId === productId);
    if (itemIndex === -1) return;

    if (newQty <= 0) {
      current.splice(itemIndex, 1);
    } else {
      const item = current[itemIndex];
      const boundedQty = Math.min(newQty, item.stockQuantity || newQty);
      current[itemIndex] = { ...item, quantity: boundedQty };
    }

    saveStoredCart(current);
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    const current = getStoredCart();
    const filtered = current.filter((i) => i.productId !== productId);
    saveStoredCart(filtered);
  }, []);

  const clearCart = useCallback(() => {
    saveStoredCart([]);
    setQuote(null);
  }, []);

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    items,
    quote,
    isQuoteLoading,
    quoteError,
    totalItemsCount,
    rawSubtotal,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshQuote: () => fetchQuote(items),
  };
}
