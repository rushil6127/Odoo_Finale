/**
 * Dashboard — Placeholder
 * Business logic will be implemented in Phase 7.
 */

import { Card } from "@/components/ui";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Dashboard</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Club performance overview — coming soon.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["Revenue", "Active Members", "Today's Bookings"].map((label) => (
          <Card key={label}>
            <p className="text-xs text-cc-text-muted uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold text-cc-text-primary mt-1">—</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
