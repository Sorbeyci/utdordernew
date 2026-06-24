/**
 * Single source of truth for name/UPC normalization. Used by both the app
 * (duplicate detection, customer matching) and the migration script, so the
 * same string always produces the same key everywhere.
 */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** Parse a price like "$23.00", "21", "50." into a number, or null. */
export function parsePrice(s: string | number | null | undefined): number | null {
  if (s == null || s === "") return null;
  const m = String(s).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Math.round(parseFloat(m[0]) * 100) / 100 : null;
}

export function normalizeUpc(s: string | null | undefined): string {
  return (s ?? "").trim();
}
