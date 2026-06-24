#!/usr/bin/env node
/**
 * Migrate the legacy SQLite database into Firestore-ready JSON.
 *
 * Usage:
 *   npm i -D better-sqlite3
 *   node scripts/migrate.mjs ./database.db ./migration-output
 *
 * Output: customers.json, products.json, orders.json, import-log.json
 *
 * Design notes (see README "Migration"):
 *  - Customer NAME lives in legacy customers.customer_id; orders join by name.
 *  - Order line items are NOT in orders.product (almost always empty). The real
 *    content is free-form text in orders.output. We preserve it VERBATIM in
 *    legacyOutputText and only additionally parse items[] for the small minority
 *    of orders that use the structured "[aisle] / NAME - $price x qty" format.
 *  - Doc IDs are deterministic so re-running never duplicates.
 *  - Legacy users (plaintext passwords) are intentionally NOT migrated.
 */
import Database from "better-sqlite3";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const dbPath = process.argv[2] || "./database.db";
const outDir = process.argv[3] || "./migration-output";
mkdirSync(outDir, { recursive: true });

const db = new Database(dbPath, { readonly: true });

const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim().toUpperCase();
const parsePrice = (s) => {
  if (s == null || s === "") return null;
  const m = String(s).replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Math.round(parseFloat(m[0]) * 100) / 100 : null;
};
const parseDate = (s) => {
  // "MM/DD/YYYY, HH:MM:SS"
  const m = String(s ?? "").trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!m) return null;
  const [, mm, dd, yyyy, hh, mi, ss] = m;
  const d = new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
  return isNaN(d) ? null : d.toISOString();
};
const toLines = (o) =>
  String(o ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

const STRUCT = /^\s*\[[^\]]*\]\s*\/\s*.+-\s*\$?\s*\d+(?:\.\d*)?\s*x\s*\d+/i;
const FOOT = /^\s*total\s+(quantity|items)\s*:/i;
const LINE =
  /^\s*\[(?<aisle>[^\]]*)\]\s*\/\s*(?<name>.+?)\s*-\s*\$?\s*(?<price>\d+(?:\.\d*)?)\s*x\s*(?<qty>\d+)(?<trail>.*)$/i;

// ---------- customers ----------
const customers = [];
const byNorm = new Map();
for (const r of db.prepare("SELECT * FROM customers").all()) {
  const lid = Number(r.id);
  const name = (r.customer_id || "").trim();
  const doc = {
    _docId: `cust_${lid}`,
    legacyCustomerId: lid,
    customerName: name,
    normalizedName: norm(name),
    address: (r.address || "").trim(),
    city: (r.city || "").trim(),
    state: (r.state || "").trim().toUpperCase(),
    postalCode: (r.postal_code || "").trim(),
    phone: "", email: "", contactName: "", storeType: "", route: "",
    notes: "", active: true, orderCount: 0, lastOrderAt: null,
    legacyUserId: (r.useridcus || "").trim(),
    createdAt: null, updatedAt: null, createdBy: "migration", updatedBy: "migration",
  };
  customers.push(doc);
  byNorm.set(doc.normalizedName, doc);
}

// ---------- products ----------
const upcSeen = new Map();
for (const r of db.prepare("SELECT upc FROM products").all()) {
  const u = (r.upc || "").trim();
  if (u) upcSeen.set(u, (upcSeen.get(u) || 0) + 1);
}
const products = db.prepare("SELECT * FROM products").all().map((r) => {
  const lid = Number(r.id);
  const upc = (r.upc || "").trim();
  return {
    _docId: `prod_${lid}`,
    legacyProductId: lid, upc,
    productName: (r.product || "").trim(),
    normalizedName: norm(r.product),
    category: (r.category || "").trim(),
    price: parsePrice(r.price), cost: null,
    aisle: (r.aisle || "").trim(), location: "",
    notes: "", active: true,
    duplicateUpc: !!(upc && upcSeen.get(upc) > 1),
    createdAt: null, updatedAt: null, createdBy: "migration", updatedBy: "migration",
  };
});

// ---------- orders ----------
const orders = [];
const agg = new Map();
let structured = 0, freeform = 0, empty = 0;
for (const r of db.prepare("SELECT * FROM orders ORDER BY id").all()) {
  const onum = Number(r.id);
  let lines = toLines(r.output);
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const legacyText = lines.join("\n");

  const content = lines.filter((l) => l.trim() && !FOOT.test(l));
  let items = [], fmt = "freeform";
  if (content.length === 0) { fmt = "empty"; empty++; }
  else {
    const matches = content.filter((l) => STRUCT.test(l)).length;
    if (matches >= Math.max(1, 0.6 * content.length)) {
      fmt = "structured"; structured++;
      for (const l of content) {
        const m = l.match(LINE);
        if (m) items.push({
          productName: m.groups.name.trim(),
          aisle: (m.groups.aisle || "").trim(),
          price: Math.round(parseFloat(m.groups.price.replace(/\.$/, "") || "0") * 100) / 100,
          quantity: parseInt(m.groups.qty, 10),
          note: m.groups.trail.trim(),
          customLine: false,
        });
      }
    } else freeform++;
  }

  const legacyTotals = { quantity: null, items: null };
  for (const l of lines) {
    const mq = l.match(/total\s+quantity\s*:\s*(\d+)/i);
    const mi = l.match(/total\s+items\s*:\s*(\d+)/i);
    if (mq) legacyTotals.quantity = +mq[1];
    if (mi) legacyTotals.items = +mi[1];
  }

  const cname = (r.customer_id || "").trim();
  const cust = byNorm.get(norm(cname));
  const created = parseDate(r.date);
  const archived = (r.archive || "").trim().toLowerCase() === "yes";
  const printed = (r.print_option || "").trim().toLowerCase() === "yes";
  const impRaw = (r.importance || "").trim().toLowerCase();
  const importance = impRaw === "yellow" ? "tomorrow" : !archived ? "urgent" : "anytime_this_week";

  let snap = {};
  if (cust) {
    snap = {
      customerName: cust.customerName, address: cust.address,
      city: cust.city, state: cust.state, postalCode: cust.postalCode,
    };
    const a = agg.get(cust._docId) || { count: 0, last: null };
    a.count++;
    if (created && (!a.last || created > a.last)) a.last = created;
    agg.set(cust._docId, a);
  }

  orders.push({
    _docId: `order_${onum}`,
    orderNumber: onum, legacyOrderNumber: onum,
    customerId: cust ? cust._docId : null,
    customerName: cname, customerSnapshot: snap,
    legacyFormat: fmt, legacyOutputText: legacyText,
    items, customLines: [],
    notes: (r.notes || "").trim(),
    importance, legacyImportance: impRaw,
    status: archived ? "archived" : "open",
    printed, archived,
    totalItems: fmt === "structured" ? items.length : null,
    totalQuantity: fmt === "structured" ? items.reduce((s, i) => s + i.quantity, 0) : null,
    legacyTotalsText: legacyTotals,
    createdAt: created, updatedAt: null,
    closedAt: null, archivedAt: archived ? created : null,
    createdBy: "migration", updatedBy: "migration",
  });
}

for (const c of customers) {
  const a = agg.get(c._docId);
  if (a) { c.orderCount = a.count; c.lastOrderAt = a.last; }
}

const maxOrder = orders.reduce((m, o) => Math.max(m, o.orderNumber), 0);
const log = {
  ranAt: new Date().toISOString(),
  source: resolve(dbPath),
  customers: { total: customers.length },
  products: {
    total: products.length,
    duplicateUpcCount: products.filter((p) => p.duplicateUpc).length,
    priceParseFailures: products.filter((p) => p.price === null).length,
  },
  orders: {
    total: orders.length, structured, freeform, empty,
    orphans: orders.filter((o) => !o.customerId).length,
    dateParseFailures: orders.filter((o) => !o.createdAt).length,
  },
  nextOrderNumber: maxOrder + 1,
  counterDoc: { collection: "counters", id: "orders", current: maxOrder },
};

writeFileSync(`${outDir}/customers.json`, JSON.stringify(customers, null, 2));
writeFileSync(`${outDir}/products.json`, JSON.stringify(products, null, 2));
writeFileSync(`${outDir}/orders.json`, JSON.stringify(orders, null, 2));
writeFileSync(`${outDir}/import-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
console.log(`\nWrote 4 files to ${resolve(outDir)}`);
db.close();
