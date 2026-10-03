/**
 * Champions Club — Empty State
 *
 * Per design.md §27: every list should have an intentional empty state.
 */

import Button from "./Button";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export default function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {icon ? (
        <div className="w-12 h-12 rounded-full bg-cc-white-warm flex items-center justify-center text-cc-text-muted">
          {icon}
        </div>
      ) : (
        <div className="w-12 h-12 rounded-full bg-cc-white-warm flex items-center justify-center">
          <svg
            className="w-6 h-6 text-cc-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-cc-text-primary">
          {title}
        </h3>
        <p className="text-sm text-cc-text-secondary max-w-sm">{message}</p>
      </div>

      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
