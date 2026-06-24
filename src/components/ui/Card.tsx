import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "./cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl2 bg-white shadow-card", className)}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  hint,
  to,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  hint?: string;
  /** When provided, the whole card becomes a link. */
  to?: string;
}) {
  const inner = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular text-ink-900", accent)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-400">{hint}</div>}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="rounded-xl2 bg-white p-4 shadow-card transition hover:shadow-pop hover:ring-1 hover:ring-brand-200"
      >
        {inner}
      </Link>
    );
  }
  return <Card className="p-4">{inner}</Card>;
}
