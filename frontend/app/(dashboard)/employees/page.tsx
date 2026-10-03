/**
 * Employees — Placeholder
 * Will be implemented in Phase 7.
 */

import { EmptyState } from "@/components/ui";

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Employees</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Staff records, roles, shifts, and leave management.
        </p>
      </div>

      <EmptyState
        title="No employee records"
        message="Employee management will be available once Phase 7 is complete."
      />
    </div>
  );
}
