/**
 * Shared Razorpay payment helper.
 *
 * Used by ALL payment flows (memberships, bookings, pro-shop) to ensure:
 *  - The Razorpay Checkout SDK is loaded before opening a checkout.
 *  - Only REAL signatures from the Razorpay handler reach the backend.
 *  - No mock/fallback payloads are sent when real credentials are configured.
 *
 * Backend signature verification (HMAC-SHA256 over `order_id|payment_id`)
 * is the ONLY trusted source for payment status. The frontend success
 * callback result is never trusted on its own.
 */

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

const RAZORPAY_CHECKOUT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Ensure the Razorpay Checkout SDK is available as `window.Razorpay`.
 *
 * Returns true when the SDK is ready, false if loading failed.
 * Safe to call multiple times — resolves immediately when already loaded.
 */
export function loadRazorpaySDK(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    // The script may already be injected by layout.tsx (afterInteractive).
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_URL}"]`
    );
    if (existing) {
      // Attach listeners and also poll once in case the load event already fired.
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      setTimeout(() => resolve(!!window.Razorpay), 1500);
      return;
    }
    // Inject dynamically as a last resort (should not be needed if layout.tsx is correct).
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Whether the order_id represents a real Razorpay gateway order.
 * Mock/fallback orders created by the backend when gateway credentials are
 * absent start with "order_rzp_" and do not require signature verification.
 */
export function isRealRazorpayOrder(orderId: string): boolean {
  return orderId.startsWith("order_") && !orderId.startsWith("order_rzp_");
}

export interface RazorpayCheckoutOptions {
  /** Razorpay public key (rzp_test_... or rzp_live_...) */
  keyId: string;
  /** Amount in RUPEES (NOT paise — this helper converts internally) */
  amountRupees: number;
  currency?: string;
  /** Gateway order ID returned by the backend create-order endpoint */
  orderId: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  themeColor?: string;
  /**
   * Called AFTER a successful payment with REAL Razorpay response fields.
   * Do NOT substitute or mock these values.
   * Always verify with the backend before trusting the payment.
   */
  onSuccess: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  /** Called when the user closes/dismisses the checkout modal. */
  onDismiss?: () => void;
  /** Called on payment failure. */
  onFailure?: (error: { description: string; code?: string }) => void;
}

/**
 * Open the Razorpay Checkout modal.
 *
 * Returns:
 *  - `"opened"`      — SDK ready, modal opened successfully.
 *  - `"sdk_missing"` — SDK failed to load (real order → surface error to user).
 *  - `"mock_order"`  — Dev-fallback mock order (no real gateway credentials).
 *
 * IMPORTANT: Never send fake signatures for real orders.
 * `"mock_order"` is ONLY for dev environments where no gateway credentials exist.
 */
export async function openRazorpayCheckout(
  opts: RazorpayCheckoutOptions
): Promise<"opened" | "sdk_missing" | "mock_order"> {
  if (!isRealRazorpayOrder(opts.orderId)) {
    return "mock_order";
  }

  const sdkReady = await loadRazorpaySDK();
  if (!sdkReady || !window.Razorpay) {
    return "sdk_missing";
  }

  const rzpOptions = {
    key: opts.keyId,
    amount: Math.round(opts.amountRupees * 100),
    currency: opts.currency ?? "INR",
    name: opts.name ?? "The Champions Club",
    description: opts.description,
    order_id: opts.orderId,
    prefill: opts.prefill ?? {},
    theme: { color: opts.themeColor ?? "#0ea5e9" },
    handler: (response: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      // Use response.razorpay_order_id from Razorpay; fall back to opts.orderId only
      // as a safety net — both should be identical for a correctly completed payment.
      opts.onSuccess({
        razorpay_order_id: response.razorpay_order_id ?? opts.orderId,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
    },
    modal: {
      ondismiss: () => opts.onDismiss?.(),
    },
  };

  const rzp = new window.Razorpay(rzpOptions);
  rzp.on(
    "payment.failed",
    (r: { error?: { description: string; code?: string } }) => {
      opts.onFailure?.({
        description: r.error?.description ?? "Payment failed.",
        code: r.error?.code,
      });
    }
  );
  rzp.open();
  return "opened";
}
