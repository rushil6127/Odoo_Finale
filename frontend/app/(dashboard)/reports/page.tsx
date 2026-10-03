/**
 * Reports — Placeholder
 * Will be implemented in Phase 7.
 */

import { EmptyState } from "@/components/ui";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Reports</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Revenue, operational KPIs, and exportable reports.
        </p>
      </div>

      <EmptyState
        title="No reports available"
        message="Reporting and analytics will be available once Phase 7 is complete."
      />
    </div>
  );
}
