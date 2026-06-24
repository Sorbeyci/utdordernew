import { useEffect, useState } from "react";
import { orderBy, getDoc } from "firebase/firestore";
import { customersCol, productsCol, customerRef, getMany } from "./firestore";
import { normalizeName, normalizeUpc } from "@/utils/normalize";
import type { Customer, Product } from "@/types";

/**
 * Customers (379) and products (1,013) change rarely, so we cache them in the
 * browser (localStorage) with a TTL. This avoids re-reading ~1,400 documents on
 * every page load — a major Firestore-read saver. The cache is cleared whenever a
 * customer/product is created or edited (invalidateCatalog), so data stays fresh.
 */
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const VERSION = "v1";
const key = (name: string) => `utd_catalog_${VERSION}_${name}`;

let customersPromise: Promise<Customer[]> | null = null;
let productsPromise: Promise<Product[]> | null = null;

function readCache<T>(name: string): T[] | null {
  try {
    const raw = localStorage.getItem(key(name));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: T[] };
    if (Date.now() - at > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(name: string, data: unknown) {
  try {
    localStorage.setItem(key(name), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full or unavailable — fine, we just skip caching */
  }
}

export function loadCustomers(force = false): Promise<Customer[]> {
  if (force) customersPromise = null;
  if (!customersPromise) {
    const cached = force ? null : readCache<Customer>("customers");
    customersPromise = cached
      ? Promise.resolve(cached)
      : getMany<Customer>(customersCol, orderBy("normalizedName")).then((d) => {
          writeCache("customers", d);
          return d;
        });
  }
  return customersPromise;
}

export function loadProducts(force = false): Promise<Product[]> {
  if (force) productsPromise = null;
  if (!productsPromise) {
    const cached = force ? null : readCache<Product>("products");
    productsPromise = cached
      ? Promise.resolve(cached)
      : getMany<Product>(productsCol, orderBy("normalizedName")).then((d) => {
          writeCache("products", d);
          return d;
        });
  }
  return productsPromise;
}

export function invalidateCatalog() {
  customersPromise = null;
  productsPromise = null;
  try {
    localStorage.removeItem(key("customers"));
    localStorage.removeItem(key("products"));
  } catch {
    /* ignore */
  }
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const snap = await getDoc(customerRef(id));
  return snap.exists() ? (snap.data() as Customer) : null;
}

// ---- search helpers (pure, fast) ----
export function searchCustomers(all: Customer[], q: string, max = 20): Customer[] {
  const n = normalizeName(q);
  if (!n) return all.slice(0, max);
  const starts: Customer[] = [];
  const contains: Customer[] = [];
  for (const c of all) {
    const idx = c.normalizedName.indexOf(n);
    if (idx === 0) starts.push(c);
    else if (idx > 0) contains.push(c);
    if (starts.length >= max) break;
  }
  return [...starts, ...contains].slice(0, max);
}

export function searchProducts(all: Product[], q: string, max = 25): Product[] {
  const raw = q.trim();
  if (!raw) return [];
  const upc = normalizeUpc(raw);
  const n = normalizeName(raw);
  const starts: Product[] = [];
  const contains: Product[] = [];
  for (const p of all) {
    if (p.upc && p.upc === upc) return [p]; // exact barcode wins
    const byName = p.normalizedName.indexOf(n);
    const byUpc = p.upc.indexOf(upc);
    if (byName === 0) starts.push(p);
    else if (byName > 0 || byUpc >= 0) contains.push(p);
  }
  return [...starts, ...contains].slice(0, max);
}

export function findByUpc(all: Product[], code: string): Product | null {
  const upc = normalizeUpc(code);
  return all.find((p) => p.upc && p.upc === upc) ?? null;
}

// ---- hooks ----
export function useCustomers() {
  const [data, setData] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    loadCustomers()
      .then((d) => on && setData(d))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);
  return { customers: data, loading };
}

export function useProducts() {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    loadProducts()
      .then((d) => on && setData(d))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);
  return { products: data, loading };
}
