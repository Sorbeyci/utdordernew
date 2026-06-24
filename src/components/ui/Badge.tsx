import type { ReactNode } from "react";
import { cn } from "./cn";
import type { OrderStatus, Importance } from "@/types";
import { IMPORTANCE_LABELS } from "@/types";

type Tone = "gray" | "blue" | "green" | "red" | "amber" | "violet";

const TONES: Record<Tone, string> = {
  gray: "bg-ink-100 text-ink-600",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<OrderStatus, Tone> = {
  open: "red",
  closed: "green",
  archived: "gray",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

const IMPORTANCE_TONE: Record<Importance, Tone> = {
  urgent: "red",
  tomorrow: "amber",
  anytime_this_week: "blue",
  hold: "violet",
};

export function ImportanceBadge({ importance }: { importance: Importance }) {
  return <Badge tone={IMPORTANCE_TONE[importance]}>{IMPORTANCE_LABELS[importance]}</Badge>;
}

/** The signature element: a colored left spine encoding status at a glance. */
export function statusSpine(status: OrderStatus, importance?: Importance): string {
  if (status === "archived") return "border-l-4 border-ink-300";
  if (status === "closed") return "border-l-4 border-emerald-400";
  if (importance === "tomorrow") return "border-l-4 border-amber-400";
  return "border-l-4 border-red-400"; // open / urgent
}
