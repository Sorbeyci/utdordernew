import {
  writeBatch,
  serverTimestamp,
  addDoc,
  getDoc,
  doc,
  collection,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import { orderRef, importLogsCol } from "./firestore";
import { invalidateCatalog, loadCustomers, loadProducts } from "./catalog";
import { normalizeName, normalizeUpc, parsePrice } from "@/utils/normalize";

export type ImportType = "customers" | "products" | "orders";

export interface ParsedRow {
  raw: Record<string, unknown>;
  mapped: Record<string, unknown>;
  docId: string | null;
  dupKey: string; // normalized name / upc / orderNumber
  issues: string[]; // validation problems (blocking if non-empty)
  duplicate: "none" | "existing" | "in_file";
}

export interface ImportPreview {
  type: ImportType;
  rows: ParsedRow[];
  headers: string[];
  okCount: number;
  errorCount: number;
  existingDupCount: number;
  fileDupCount: number;
}

/** Target fields per type. Importer auto-maps by header; UI allows manual remap. */
export const TARGET_FIELDS: Record<ImportType, string[]> = {
  customers: [
    "customerName", "address", "city", "state", "postalCode", "phone", "email",
    "contactName", "storeType", "route", "notes", "active", "legacyCustomerId",
  ],
  products: [
    "upc", "productName", "category", "price", "cost", "aisle", "location",
    "notes", "active", "legacyProductId",
  ],
  orders: [
    "orderNumber", "customerName", "customerId", "importance", "status", "printed",
    "archived", "notes", "createdAt", "legacyOutputText", "items", "customLines",
  ],
};

const REQUIRED: Record<ImportType, string[]> = {
  customers: ["customerName"],
  products: ["productName"],
  orders: ["orderNumber"],
};

export function parseJSON(text: string): Record<string, unknown>[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON must be an array of records.");
  return data;
}

function autoMap(headers: string[], type: ImportType): Record<string, string> {
  const map: Record<string, string> = {};
  const lc = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  for (const target of TARGET_FIELDS[type]) {
    const hit = headers.find((h) => lc(h) === lc(target));
    if (hit) map[target] = hit;
  }
  return map;
}

function toBool(v: unknown, dflt = true): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (["false", "no", "0", "inactive", "n"].includes(s)) return false;
  if (["true", "yes", "1", "active", "y"].includes(s)) return true;
  return dflt;
}

/** Build a preview with mapping, validation, and duplicate detection. */
export async function buildPreview(
  type: ImportType,
  rows: Record<string, unknown>[],
  mapping?: Record<string, string>
): Promise<ImportPreview> {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const map = mapping ?? autoMap(headers, type);

  // existing duplicate keys
  const existingKeys = new Set<string>();
  if (type === "customers") (await loadCustomers()).forEach((c) => existingKeys.add(c.normalizedName));
  if (type === "products") (await loadProducts()).forEach((p) => p.upc && existingKeys.add(p.upc));

  const seen = new Set<string>();
  const out: ParsedRow[] = [];

  for (const raw of rows) {
    const get = (target: string) => {
      const src = map[target];
      return src ? raw[src] : raw[target]; // allow direct-named JSON
    };
    const mapped: Record<string, unknown> = {};
    for (const t of TARGET_FIELDS[type]) {
      const v = get(t);
      if (v !== undefined) mapped[t] = v;
    }

    const issues: string[] = [];
    for (const req of REQUIRED[type]) {
      if (mapped[req] == null || String(mapped[req]).trim() === "") {
        issues.push(`missing ${req}`);
      }
    }

    let docId: string | null = null;
    let dupKey = "";
    if (type === "customers") {
      dupKey = normalizeName(String(mapped.customerName ?? ""));
      const legacy = raw._docId ?? (mapped.legacyCustomerId ? `cust_${mapped.legacyCustomerId}` : null);
      docId = (legacy as string) || null;
    } else if (type === "products") {
      dupKey = normalizeUpc(String(mapped.upc ?? ""));
      const legacy = raw._docId ?? (mapped.legacyProductId ? `prod_${mapped.legacyProductId}` : null);
      docId = (legacy as string) || null;
      if (mapped.price != null) mapped.price = parsePrice(String(mapped.price));
    } else {
      dupKey = String(mapped.orderNumber ?? "");
      docId = (raw._docId as string) || (dupKey ? `order_${dupKey}` : null);
    }

    let duplicate: ParsedRow["duplicate"] = "none";
    if (dupKey) {
      if (seen.has(dupKey)) duplicate = "in_file";
      else if (existingKeys.has(dupKey)) duplicate = "existing";
      seen.add(dupKey);
    }

    out.push({ raw, mapped, docId, dupKey, issues, duplicate });
  }

  return {
    type,
    rows: out,
    headers,
    okCount: out.filter((r) => r.issues.length === 0).length,
    errorCount: out.filter((r) => r.issues.length > 0).length,
    existingDupCount: out.filter((r) => r.duplicate === "existing").length,
    fileDupCount: out.filter((r) => r.duplicate === "in_file").length,
  };
}

function asTs(v: unknown): unknown {
  if (typeof v === "string" && v.trim()) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
  }
  // migration JSON may carry { seconds, nanoseconds }
  if (v && typeof v === "object" && "seconds" in (v as Record<string, unknown>)) {
    const s = (v as { seconds: number }).seconds;
    return Timestamp.fromMillis(s * 1000);
  }
  return v;
}

function buildDoc(type: ImportType, r: ParsedRow, by: string): Record<string, unknown> {
  const base = { ...r.raw, ...r.mapped };
  delete (base as Record<string, unknown>)._docId;
  delete (base as Record<string, unknown>).id;
  const now = serverTimestamp();
  if (type === "customers") {
    return {
      ...base,
      customerName: r.mapped.customerName ?? "",
      normalizedName: r.dupKey,
      active: toBool(r.mapped.active),
      lastOrderAt: base.lastOrderAt ? asTs(base.lastOrderAt) : null,
      createdAt: base.createdAt ? asTs(base.createdAt) : now,
      updatedAt: now,
      createdBy: base.createdBy ?? by,
      updatedBy: by,
    };
  }
  if (type === "products") {
    return {
      ...base,
      upc: r.dupKey,
      productName: r.mapped.productName ?? "",
      normalizedName: normalizeName(String(r.mapped.productName ?? "")),
      active: toBool(r.mapped.active),
      createdAt: base.createdAt ? asTs(base.createdAt) : now,
      updatedAt: now,
      createdBy: base.createdBy ?? by,
      updatedBy: by,
    };
  }
  // orders — keep legacy fields; coerce booleans and date fields to Timestamps
  return {
    ...base,
    orderNumber: Number(r.mapped.orderNumber),
    printed: toBool(r.mapped.printed, false),
    archived: toBool(r.mapped.archived, false),
    createdAt: base.createdAt ? asTs(base.createdAt) : now,
    archivedAt: base.archivedAt ? asTs(base.archivedAt) : null,
    closedAt: base.closedAt ? asTs(base.closedAt) : null,
    updatedAt: now,
    createdBy: base.createdBy ?? by,
    updatedBy: by,
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
}

/**
 * Commit the import. Rows with validation issues are skipped. Existing duplicates
 * are skipped unless `overwrite` is true. Writes batched (~400/commit) and logs.
 */
export async function commitImport(
  preview: ImportPreview,
  opts: { overwrite: boolean; fileName: string; by: string }
): Promise<ImportResult> {
  const { type, rows } = preview;
  let imported = 0,
    skipped = 0,
    errors = 0;
  const errorMsgs: string[] = [];

  const collName: string = type; // "customers" | "products" | "orders"

  const writable: ParsedRow[] = [];
  for (const r of rows) {
    if (r.issues.length > 0) {
      errors++;
      if (errorMsgs.length < 50) errorMsgs.push(`${r.dupKey || "row"}: ${r.issues.join(", ")}`);
      continue;
    }
    if (r.duplicate === "in_file") {
      skipped++;
      continue;
    }
    if (r.duplicate === "existing" && !opts.overwrite) {
      skipped++;
      continue;
    }
    writable.push(r);
  }

  // Deterministic-id rows are written via batched setDoc; id-less rows via addDoc.
  // Untyped refs avoid converter write-type friction — payloads are plain objects.
  const CHUNK = 400;
  for (let i = 0; i < writable.length; i += CHUNK) {
    const slice = writable.slice(i, i + CHUNK);
    const batch = writeBatch(db);
    const addLater: ParsedRow[] = [];
    for (const r of slice) {
      const data = buildDoc(type, r, opts.by);
      if (r.docId) batch.set(doc(db, collName, r.docId), data, { merge: !opts.overwrite });
      else addLater.push(r);
    }
    await batch.commit();
    imported += slice.length - addLater.length;
    for (const r of addLater) {
      await addDoc(collection(db, collName), buildDoc(type, r, opts.by));
      imported++;
    }
  }

  await addDoc(importLogsCol, {
    type,
    fileName: opts.fileName,
    totalRows: rows.length,
    importedCount: imported,
    skippedCount: skipped,
    errorCount: errors,
    errors: errorMsgs,
    createdAt: serverTimestamp(),
    createdBy: opts.by,
  } as never);

  invalidateCatalog();
  return { imported, skipped, errors };
}

/** Quick existence check used for order-id dedupe when needed. */
export async function orderExists(orderNumber: number): Promise<boolean> {
  const snap = await getDoc(orderRef(`order_${orderNumber}`));
  return snap.exists();
}
