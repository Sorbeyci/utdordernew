import {
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { customersCol, productsCol, ordersCol } from "./firestore";
import { downloadJSON, downloadCSV, stamp } from "@/utils/csv";

type Col = "customers" | "products" | "orders";

function colRef(c: Col) {
  return c === "customers" ? customersCol : c === "products" ? productsCol : ordersCol;
}
function sortField(c: Col) {
  return c === "orders" ? "orderNumber" : "normalizedName";
}

/** Fetch an entire collection in pages so large exports (orders) don't time out. */
export async function fetchAll(
  c: Col,
  onProgress?: (n: number) => void
): Promise<Record<string, unknown>[]> {
  const col = colRef(c);
  const out: Record<string, unknown>[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
  const PAGE = 500;
  for (;;) {
    const constraints = [
      orderBy(sortField(c)),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(PAGE),
    ];
    const snap = await getDocs(query(col, ...constraints));
    snap.docs.forEach((d) => out.push({ id: d.id, ...(d.data() as object) }));
    onProgress?.(out.length);
    if (snap.docs.length < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot<DocumentData>;
  }
  return out;
}

export async function exportCollection(
  c: Col,
  format: "json" | "csv",
  onProgress?: (n: number) => void
) {
  const rows = await fetchAll(c, onProgress);
  const name = `${c}-backup-${stamp()}.${format}`;
  if (format === "json") downloadJSON(name, rows);
  else downloadCSV(name, rows);
  return rows.length;
}
