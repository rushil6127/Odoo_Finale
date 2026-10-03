/**
 * Champions Club — Loading State
 *
 * Provides a branded loading indicator for API-driven screens.
 * Per design.md §25: avoid blank screens while data loads.
 */

interface LoadingStateProps {
  message?: string;
}

export default function LoadingState({
  message = "Loading...",
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {/* Animated spinner using brand green */}
      <div className="relative w-10 h-10">
        <div
          className="absolute inset-0 rounded-full border-2 border-cc-border"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-cc-green-deep animate-spin"
          aria-hidden="true"
        />
      </div>
      <p className="text-sm text-cc-text-muted">{message}</p>
    </div>
  );
}
