import {
  collection,
  doc,
  getDocs,
  query,
  type QueryConstraint,
  type FirestoreDataConverter,
  type DocumentData,
  type CollectionReference,
  type Query,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import type {
  AppUser,
  Customer,
  Product,
  Order,
  OrderHistoryEntry,
  ImportLog,
} from "@/types";

/** Generic converter that injects the doc id and strips it on write. */
function converter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T): DocumentData {
      const { id, ...rest } = data;
      void id;
      return rest;
    },
    fromFirestore(snap, options): T {
      const data = snap.data(options);
      return { id: snap.id, ...(data as object) } as T;
    },
  };
}

export const usersCol = collection(db, "users").withConverter(converter<AppUser>());
export const customersCol = collection(db, "customers").withConverter(converter<Customer>());
export const productsCol = collection(db, "products").withConverter(converter<Product>());
export const ordersCol = collection(db, "orders").withConverter(converter<Order>());
export const orderHistoryCol = collection(db, "orderHistory").withConverter(
  converter<OrderHistoryEntry>()
);
export const importLogsCol = collection(db, "importLogs").withConverter(converter<ImportLog>());

export const userRef = (uid: string) => doc(usersCol, uid);
export const customerRef = (id: string) => doc(customersCol, id);
export const productRef = (id: string) => doc(productsCol, id);
export const orderRef = (id: string) => doc(ordersCol, id);
export const counterRef = (id = "orders") => doc(db, "counters", id);

export async function getMany<T>(
  col: CollectionReference<T> | Query<T>,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const snap = await getDocs(query(col, ...constraints));
  return snap.docs.map((d) => d.data());
}
