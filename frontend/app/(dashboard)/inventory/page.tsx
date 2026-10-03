/**
 * Inventory — Placeholder
 * Will be implemented in Phase 4.
 */

import { EmptyState } from "@/components/ui";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Inventory</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Stock levels, movements, and low-stock alerts.
        </p>
      </div>

      <EmptyState
        title="No inventory data"
        message="Inventory management will be available once Phase 4 is complete."
      />
    </div>
  );
}
