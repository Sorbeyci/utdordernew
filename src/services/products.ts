import { addDoc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { productsCol, productRef } from "./firestore";
import { invalidateCatalog } from "./catalog";
import { normalizeName, normalizeUpc, parsePrice } from "@/utils/normalize";
import type { Product } from "@/types";

export type ProductInput = Pick<
  Product,
  | "upc"
  | "productName"
  | "category"
  | "price"
  | "cost"
  | "aisle"
  | "location"
  | "notes"
  | "active"
>;

export function blankProduct(): ProductInput {
  return {
    upc: "",
    productName: "",
    category: "",
    price: null,
    cost: null,
    aisle: "",
    location: "",
    notes: "",
    active: true,
  };
}

/** Returns an existing product sharing this UPC (other than exceptId), or null. */
export function findDuplicateUpc(all: Product[], upc: string, exceptId?: string): Product | null {
  const u = normalizeUpc(upc);
  if (!u) return null;
  return all.find((p) => p.upc === u && p.id !== exceptId) ?? null;
}

export async function createProduct(input: ProductInput, by: string): Promise<string> {
  const ref = await addDoc(productsCol, {
    ...input,
    upc: normalizeUpc(input.upc),
    legacyProductId: null,
    normalizedName: normalizeName(input.productName),
    price: typeof input.price === "string" ? parsePrice(input.price) : input.price,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: by,
    updatedBy: by,
  } as never);
  invalidateCatalog();
  return ref.id;
}

export async function updateProduct(id: string, input: Partial<ProductInput>, by: string) {
  const patch: Record<string, unknown> = { ...input, updatedAt: serverTimestamp(), updatedBy: by };
  if (input.productName != null) patch.normalizedName = normalizeName(input.productName);
  if (input.upc != null) patch.upc = normalizeUpc(input.upc);
  if (typeof input.price === "string") patch.price = parsePrice(input.price);
  await updateDoc(productRef(id), patch);
  invalidateCatalog();
}

export async function setProductActive(id: string, active: boolean, by: string) {
  await updateDoc(productRef(id), { active, updatedAt: serverTimestamp(), updatedBy: by });
  invalidateCatalog();
}

export async function upsertProductDoc(docId: string, data: object, overwrite: boolean) {
  if (!overwrite) {
    const existing = await getDoc(productRef(docId));
    if (existing.exists()) return "skipped";
  }
  await setDoc(productRef(docId), data as never, { merge: !overwrite });
  return "written";
}
