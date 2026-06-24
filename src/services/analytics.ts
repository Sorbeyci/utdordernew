import {
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ordersCol } from "./firestore";
import type { Order } from "@/types";

export interface ProductRow {
  name: string;
  units: number;
  orders: number;
}

export interface ProductAnalytics {
  scanned: number;
  structuredOrders: number;
  freeformOrders: number;
  totalUnits: number;
  distinctProducts: number;
  topByUnits: ProductRow[];
  topByOrders: ProductRow[];
  /** Approximate historical demand mined from handwritten (freeform) orders. */
  topFreeformTerms: { term: string; count: number }[];
}

// Generic words to ignore when mining handwritten lists for product signal.
const STOP = new Set([
  "the", "and", "for", "with", "each", "get", "got", "need", "take", "from",
  "good", "date", "also", "new", "old", "off", "out", "all", "per", "box",
  "pack", "case", "count", "single", "singles", "pcs", "total", "qty", "items",
  "item", "quantity", "order", "please", "thanks", "thank", "you", "have",
]);

export async function getProductAnalytics(
  onProgress?: (scanned: number) => void
): Promise<ProductAnalytics> {
  const PAGE = 500;
  let cursor: QueryDocumentSnapshot<Order> | null = null;

  const byName = new Map<string, { units: number; orders: number }>();
  const terms = new Map<string, number>();
  let scanned = 0,
    structuredOrders = 0,
    freeformOrders = 0,
    totalUnits = 0;

  for (;;) {
    const constraints = [
      orderBy("orderNumber"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE),
    ];
    const snap = await getDocs(query(ordersCol, ...constraints));

    for (const d of snap.docs) {
      const o = d.data();
      scanned++;
      const items = o.items ?? [];

      if (items.length > 0) {
        structuredOrders++;
        for (const it of items) {
          const name = (it.productName || "").trim();
          if (!name) continue;
          const cur = byName.get(name) ?? { units: 0, orders: 0 };
          cur.units += it.quantity || 0;
          cur.orders += 1;
          byName.set(name, cur);
          totalUnits += it.quantity || 0;
        }
      } else {
        freeformOrders++;
        const text =
          o.customLines && o.customLines.length > 0
            ? o.customLines.join("\n")
            : o.legacyOutputText || "";
        for (let line of text.split("\n")) {
          line = line.toLowerCase().replace(/total\s+(quantity|items).*/g, "");
          for (const w of line.split(/[^a-z0-9]+/)) {
            if (w.length < 3) continue;
            if (/^\d+$/.test(w)) continue; // pure numbers (quantities)
            if (STOP.has(w)) continue;
            terms.set(w, (terms.get(w) || 0) + 1);
          }
        }
      }
    }

    onProgress?.(scanned);
    if (snap.docs.length < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  const rows: ProductRow[] = [...byName.entries()].map(([name, v]) => ({
    name,
    units: v.units,
    orders: v.orders,
  }));

  return {
    scanned,
    structuredOrders,
    freeformOrders,
    totalUnits,
    distinctProducts: rows.length,
    topByUnits: [...rows].sort((a, b) => b.units - a.units).slice(0, 20),
    topByOrders: [...rows].sort((a, b) => b.orders - a.orders).slice(0, 20),
    topFreeformTerms: [...terms.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([term, count]) => ({ term, count })),
  };
}
