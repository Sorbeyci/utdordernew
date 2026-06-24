import { addDoc, updateDoc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { customersCol, customerRef } from "./firestore";
import { invalidateCatalog } from "./catalog";
import { normalizeName } from "@/utils/normalize";
import type { Customer } from "@/types";

export type CustomerInput = Pick<
  Customer,
  | "customerName"
  | "address"
  | "city"
  | "state"
  | "postalCode"
  | "phone"
  | "email"
  | "contactName"
  | "storeType"
  | "route"
  | "notes"
  | "active"
>;

const EMPTY: CustomerInput = {
  customerName: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
  email: "",
  contactName: "",
  storeType: "",
  route: "",
  notes: "",
  active: true,
};

export function blankCustomer(): CustomerInput {
  return { ...EMPTY };
}

/** Returns an existing customer with the same normalized name, or null. */
export function findDuplicateName(all: Customer[], name: string, exceptId?: string): Customer | null {
  const n = normalizeName(name);
  return all.find((c) => c.normalizedName === n && c.id !== exceptId) ?? null;
}

export async function createCustomer(input: CustomerInput, by: string): Promise<string> {
  const ref = await addDoc(customersCol, {
    ...input,
    legacyCustomerId: null,
    normalizedName: normalizeName(input.customerName),
    orderCount: 0,
    lastOrderAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: by,
    updatedBy: by,
  } as never);
  invalidateCatalog();
  return ref.id;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>, by: string) {
  const patch: Record<string, unknown> = { ...input, updatedAt: serverTimestamp(), updatedBy: by };
  if (input.customerName != null) patch.normalizedName = normalizeName(input.customerName);
  await updateDoc(customerRef(id), patch);
  invalidateCatalog();
}

export async function setCustomerActive(id: string, active: boolean, by: string) {
  await updateDoc(customerRef(id), { active, updatedAt: serverTimestamp(), updatedBy: by });
  invalidateCatalog();
}

/** Used by the importer with a deterministic id (keeps legacy ids stable). */
export async function upsertCustomerDoc(docId: string, data: object, overwrite: boolean) {
  if (!overwrite) {
    const existing = await getDoc(customerRef(docId));
    if (existing.exists()) return "skipped";
  }
  await setDoc(customerRef(docId), data as never, { merge: !overwrite });
  return "written";
}
