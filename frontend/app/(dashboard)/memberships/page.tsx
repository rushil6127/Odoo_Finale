/**
 * Memberships — Placeholder
 * Will be implemented in Phase 2.
 */

import { EmptyState } from "@/components/ui";

export default function MembershipsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Memberships</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Manage Gold, Silver, and Junior membership plans.
        </p>
      </div>

      <EmptyState
        title="No membership plans configured"
        message="Membership plan management will be available once Phase 2 is complete."
      />
    </div>
  );
}
