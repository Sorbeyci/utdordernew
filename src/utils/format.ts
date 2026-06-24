import { Timestamp } from "firebase/firestore";

/** Accepts Firestore Timestamp, ISO string, Date, or null. */
export function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  // Firestore Timestamp-like object from JSON
  if (typeof v === "object" && v !== null && "seconds" in v) {
    return new Date((v as { seconds: number }).seconds * 1000);
  }
  return null;
}

export function fmtDate(v: unknown): string {
  const d = toDate(v);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function fmtDateTime(v: unknown): string {
  const d = toDate(v);
  return d
    ? d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}

export function fmtRelative(v: unknown): string {
  const d = toDate(v);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(v);
}

export function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
