/**
 * Champions Club — Error State
 *
 * User-friendly error display per design.md §26.
 * Never exposes raw backend errors or stack traces.
 */

import Button from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't complete your request. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      {/* Error icon */}
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-cc-error"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-cc-text-primary">
          {title}
        </h3>
        <p className="text-sm text-cc-text-secondary max-w-sm">{message}</p>
      </div>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
