import { cn } from "./cn";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600",
        className
      )}
    />
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-500">
      <LoadingSpinner className="h-7 w-7" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
