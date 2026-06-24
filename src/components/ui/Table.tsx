import type { ReactNode } from "react";
import { cn } from "./cn";

/** Desktop table wrapper. On mobile, pages render cards instead (see usage). */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl2 bg-white shadow-card">
      <table className={cn("w-full text-left text-sm", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-ink-100 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-400",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-ink-50 px-3 py-2.5 text-ink-700", className)}>{children}</td>;
}
