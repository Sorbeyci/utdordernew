import { useEffect, useState } from "react";
import { orderBy, getDoc } from "firebase/firestore";
import { customersCol, productsCol, customerRef, getMany } from "./firestore";
import { normalizeName, normalizeUpc } from "@/utils/normalize";
import type { Customer, Product } from "@/types";

/**
 * Customers (379) and products (1,013) are small, so we load them once and keep
 * them in memory. That makes customer search, product search, and barcode/UPC
 * lookup instant — no round-trip per keystroke or scan.
 */
let customersPromise: Promise<Customer[]> | null = null;
let productsPromise: Promise<Product[]> | null = null;

export function loadCustomers(force = false): Promise<Customer[]> {
  if (force || !customersPromise) {
    customersPromise = getMany<Customer>(customersCol, orderBy("normalizedName"));
  }
  return customersPromise;
}

export function loadProducts(force = false): Promise<Product[]> {
  if (force || !productsPromise) {
    productsPromise = getMany<Product>(productsCol, orderBy("normalizedName"));
  }
  return productsPromise;
}

export function invalidateCatalog() {
  customersPromise = null;
  productsPromise = null;
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
