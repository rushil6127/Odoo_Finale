/**
 * Bookings — Placeholder
 * Will be implemented in Phase 3.
 */

import { EmptyState } from "@/components/ui";

export default function BookingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Bookings</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Court availability and booking management.
        </p>
      </div>

      <EmptyState
        title="No bookings yet"
        message="Court booking will be available once Phase 3 is complete."
      />
    </div>
  );
}
