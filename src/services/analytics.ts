import {
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ordersCol } from "./firestore";
import { toDate } from "@/utils/format";
import type { Order } from "@/types";

export interface ProductRow {
  name: string;
  units: number;
  orders: number;
}

/** A product derived from one handwritten order line (line = one product). */
export interface FreeformProduct {
  name: string;
  units: number; // summed trailing quantities ("black mamba 5" -> 5)
  count: number; // how many order-lines mention it
  recentUnits: number; // within the recent window
  recentCount: number;
}

export interface ProductAnalytics {
  scanned: number;
  structuredOrders: number;
  freeformOrders: number;
  recentWindowDays: number;
  // Structured (catalog-linked) orders
  structuredUnits: number;
  structuredTopByUnits: ProductRow[];
  structuredTopByOrders: ProductRow[];
  // Handwritten orders, one product per line
  distinctFreeformProducts: number;
  freeformAllTime: FreeformProduct[]; // best sellers, all time
  freeformRecent: FreeformProduct[]; // selling now (recent window)
  freeformTrending: FreeformProduct[]; // gaining momentum
  byUser: { user: string; count: number }[];
}

const RECENT_DAYS = 30;
const FOOTER = /^\s*total\s+(quantity|items)\s*:/i;
// Trailing quantity: " 5", " x5", " x 5" — but NOT product numbers like "6mg" or "15k".
const TRAILING_QTY = /\s+x?\s*(\d{1,4})\s*$/i;

/** Turn one handwritten line into { name, qty }, or null if it isn't a product. */
function parseLine(raw: string): { name: string; qty: number } | null {
  let line = raw.trim();
  if (!line || FOOTER.test(line)) return null;
  let qty = 1;
  const m = line.match(TRAILING_QTY);
  if (m) {
    qty = parseInt(m[1], 10) || 1;
    line = line.slice(0, m.index).trim();
  }
  // Drop a trailing colon from header-style lines ("backwoods pack:" -> "backwoods pack")
  line = line.replace(/:+\s*$/, "").trim();
  const name = line.replace(/\s+/g, " ").toLowerCase();
  if (name.length < 2) return null;
  return { name, qty };
}

export async function getProductAnalytics(
  onProgress?: (scanned: number) => void
): Promise<ProductAnalytics> {
  const PAGE = 500;
  let cursor: QueryDocumentSnapshot<Order> | null = null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  const cutoffMs = cutoff.getTime();

  const structured = new Map<string, { units: number; orders: number }>();
  const free = new Map<string, FreeformProduct>();
  const users = new Map<string, number>();
  let scanned = 0,
    structuredOrders = 0,
    freeformOrders = 0,
    structuredUnits = 0;

  for (;;) {
    const constraints: QueryConstraint[] = [
      orderBy("orderNumber"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE),
    ];
    const snap: QuerySnapshot<Order> = await getDocs(query(ordersCol, ...constraints));

    for (const d of snap.docs) {
      const o = d.data();
      scanned++;
      const by = o.createdBy || "—";
      users.set(by, (users.get(by) || 0) + 1);
      const createdMs = toDate(o.createdAt)?.getTime() ?? 0;
      const isRecent = createdMs >= cutoffMs;
      const items = o.items ?? [];

      if (items.length > 0) {
        structuredOrders++;
        for (const it of items) {
          const name = (it.productName || "").trim();
          if (!name) continue;
          const cur = structured.get(name) ?? { units: 0, orders: 0 };
          cur.units += it.quantity || 0;
          cur.orders += 1;
          structured.set(name, cur);
          structuredUnits += it.quantity || 0;
        }
      } else {
        freeformOrders++;
        const text =
          o.customLines && o.customLines.length > 0
            ? o.customLines.join("\n")
            : o.legacyOutputText || "";
        for (const rawLine of text.split("\n")) {
          const parsed = parseLine(rawLine);
          if (!parsed) continue;
          const cur =
            free.get(parsed.name) ??
            { name: parsed.name, units: 0, count: 0, recentUnits: 0, recentCount: 0 };
          cur.units += parsed.qty;
          cur.count += 1;
          if (isRecent) {
            cur.recentUnits += parsed.qty;
            cur.recentCount += 1;
          }
          free.set(parsed.name, cur);
        }
      }
    }

    onProgress?.(scanned);
    if (snap.docs.length < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  const structuredRows: ProductRow[] = [...structured.entries()].map(([name, v]) => ({
    name,
    units: v.units,
    orders: v.orders,
  }));
  const freeRows = [...free.values()];

  // Trending: products doing more recently than their older baseline.
  const trending = freeRows
    .filter((p) => p.count >= 3 && p.recentCount > 0)
    .map((p) => ({ p, score: p.recentCount * 2 - (p.count - p.recentCount) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map((x) => x.p);

  return {
    scanned,
    structuredOrders,
    freeformOrders,
    recentWindowDays: RECENT_DAYS,
    structuredUnits,
    structuredTopByUnits: [...structuredRows].sort((a, b) => b.units - a.units).slice(0, 15),
    structuredTopByOrders: [...structuredRows].sort((a, b) => b.orders - a.orders).slice(0, 15),
    distinctFreeformProducts: freeRows.length,
    freeformAllTime: [...freeRows].sort((a, b) => b.units - a.units).slice(0, 30),
    freeformRecent: freeRows
      .filter((p) => p.recentCount > 0)
      .sort((a, b) => b.recentUnits - a.recentUnits)
      .slice(0, 20),
    freeformTrending: trending,
    byUser: [...users.entries()]
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count),
  };
}
