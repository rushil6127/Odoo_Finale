/**
 * CRM — Placeholder
 * Will be implemented in Phase 6.
 */

import { EmptyState } from "@/components/ui";

export default function CRMPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">CRM</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Lead tracking, enquiries, and follow-ups.
        </p>
      </div>

      <EmptyState
        title="No leads yet"
        message="CRM and lead management will be available once Phase 6 is complete."
      />
    </div>
  );
}
