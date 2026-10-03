/**
 * POS / Bar — Placeholder
 * Will be implemented in Phase 5.
 */

import { EmptyState } from "@/components/ui";

export default function POSPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Bar / POS</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Point-of-sale, tables, orders, and tabs.
        </p>
      </div>

      <EmptyState
        title="POS not configured"
        message="The bar and POS system will be available once Phase 5 is complete."
      />
    </div>
  );
}
