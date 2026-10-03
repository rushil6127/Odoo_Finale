/**
 * Members — Placeholder
 * Will be implemented in Phase 2.
 */

import { EmptyState } from "@/components/ui";

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-cc-text-primary">Members</h2>
        <p className="text-sm text-cc-text-secondary mt-1">
          Manage club members and their profiles.
        </p>
      </div>

      <EmptyState
        title="No members yet"
        message="Member management will be available once Phase 2 is complete."
      />
    </div>
  );
}
