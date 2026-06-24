import {
  runTransaction,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
  increment,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  ordersCol,
  orderRef,
  counterRef,
  customerRef,
  orderHistoryCol,
  getMany,
} from "./firestore";
import type { Order, OrderItem, Importance, OrderStatus, Customer } from "@/types";

const LEGACY_MAX_ORDER = 8013; // highest imported order number; new orders start at 8014

export interface OrderDraft {
  customer: Customer | null;
  items: OrderItem[];
  customLines: string[];
  notes: string;
  importance: Importance;
}

/** Ensures counters/orders exists; seeds from the true max order number if missing. */
async function ensureCounter(): Promise<void> {
  const ref = counterRef("orders");
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const latest = await getMany<Order>(ordersCol, orderBy("orderNumber", "desc"), limit(1));
  const current = latest[0]?.orderNumber ?? LEGACY_MAX_ORDER;
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) tx.set(ref, { current });
  });
}

function totals(items: OrderItem[]) {
  return {
    totalItems: items.length,
    totalQuantity: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
  };
}

/** Creates an order with the next sequential number, atomically. Returns the new order. */
export async function createOrder(
  draft: OrderDraft,
  user: { uid: string; email: string }
): Promise<Order> {
  await ensureCounter();
  const cRef = counterRef("orders");

  const orderNumber = await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(cRef);
    const current = cSnap.exists() ? (cSnap.data().current as number) : LEGACY_MAX_ORDER;
    const next = current + 1;
    const { totalItems, totalQuantity } = totals(draft.items);
    tx.set(cRef, { current: next }, { merge: true });
    tx.set(orderRef(`order_${next}`), {
      orderNumber: next,
      legacyOrderNumber: null,
      customerId: draft.customer?.id ?? null,
      customerName: draft.customer?.customerName ?? "",
      customerSnapshot: draft.customer
        ? {
            customerName: draft.customer.customerName,
            address: draft.customer.address,
            city: draft.customer.city,
            state: draft.customer.state,
            postalCode: draft.customer.postalCode,
          }
        : {},
      legacyFormat: "structured",
      legacyOutputText: "",
      items: draft.items,
      customLines: draft.customLines.filter((l) => l.trim() !== ""),
      notes: draft.notes,
      importance: draft.importance,
      status: "open",
      printed: false,
      archived: false,
      totalItems,
      totalQuantity,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      closedAt: null,
      archivedAt: null,
      createdBy: user.email,
      updatedBy: user.email,
    });
    return next;
  });

  // Side effects (non-atomic, best-effort): customer rollup + audit log.
  if (draft.customer) {
    await updateDoc(customerRef(draft.customer.id), {
      orderCount: increment(1),
      lastOrderAt: serverTimestamp(),
    }).catch(() => {});
  }
  await addHistory(`order_${orderNumber}`, "created", null, null, user).catch(() => {});

  const snap = await getDoc(orderRef(`order_${orderNumber}`));
  return snap.data() as Order;
}

export async function getOrder(id: string): Promise<Order | null> {
  const snap = await getDoc(orderRef(id));
  return snap.exists() ? (snap.data() as Order) : null;
}

/** Updates an order and writes an audit-log entry capturing the change. */
export async function updateOrder(
  id: string,
  patch: Partial<Order>,
  user: { uid: string; email: string },
  action = "edited"
): Promise<void> {
  const before = await getOrder(id);
  if (patch.items) Object.assign(patch, totals(patch.items));
  await updateDoc(orderRef(id), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: user.email,
  });
  const after = await getOrder(id);
  await addHistory(id, action, before, after, user).catch(() => {});
}

export async function setPrinted(id: string, printed: boolean, user: { uid: string; email: string }) {
  await updateOrder(id, { printed }, user, printed ? "marked printed" : "unmarked printed");
}

export async function closeOrder(id: string, user: { uid: string; email: string }) {
  await updateOrder(
    id,
    { status: "closed", closedAt: serverTimestamp() as never },
    user,
    "closed"
  );
}

export async function reopenOrder(id: string, user: { uid: string; email: string }) {
  await updateOrder(id, { status: "open", closedAt: null }, user, "reopened");
}

export async function archiveOrder(id: string, user: { uid: string; email: string }) {
  await updateOrder(
    id,
    { status: "archived", archived: true, archivedAt: serverTimestamp() as never },
    user,
    "archived"
  );
}

export async function unarchiveOrder(id: string, user: { uid: string; email: string }) {
  await updateOrder(id, { status: "open", archived: false, archivedAt: null }, user, "unarchived");
}

export async function deleteOrder(id: string) {
  await deleteDoc(orderRef(id));
}

/** Bulk operations via batched writes (max ~500 ops per batch; we cap selections well below). */
export async function bulkUpdate(
  ids: string[],
  patch: Partial<Order>,
  user: { uid: string; email: string }
): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids) {
    batch.update(orderRef(id), { ...patch, updatedAt: serverTimestamp(), updatedBy: user.email });
  }
  await batch.commit();
}

// ---- audit log ----
export async function addHistory(
  orderId: string,
  action: string,
  before: Order | null,
  after: Order | null,
  user: { uid: string; email: string }
) {
  await addDoc(orderHistoryCol, {
    orderId,
    action,
    before: before ? summarize(before) : null,
    after: after ? summarize(after) : null,
    userId: user.uid,
    userEmail: user.email,
    createdAt: serverTimestamp(),
  } as never);
}

/** Keep audit snapshots small — just the fields that change meaningfully. */
function summarize(o: Order) {
  return {
    status: o.status,
    printed: o.printed,
    archived: o.archived,
    importance: o.importance,
    notes: o.notes,
    totalItems: o.totalItems,
    totalQuantity: o.totalQuantity,
  };
}

export function getOrderHistory(orderId: string) {
  return getMany(orderHistoryCol, where("orderId", "==", orderId), orderBy("createdAt", "desc"));
}

// ---- listing / filters ----
export type OrderFilter =
  | "all"
  | "open"
  | "closed"
  | "archived"
  | "printed"
  | "not_printed"
  | "tomorrow"
  | "anytime_this_week"
  | "urgent";

function filterConstraints(f: OrderFilter): QueryConstraint[] {
  switch (f) {
    case "open":
      return [where("status", "==", "open" as OrderStatus)];
    case "closed":
      return [where("status", "==", "closed" as OrderStatus)];
    case "archived":
      return [where("status", "==", "archived" as OrderStatus)];
    case "printed":
      return [where("printed", "==", true)];
    case "not_printed":
      return [where("printed", "==", false)];
    case "tomorrow":
      return [where("importance", "==", "tomorrow" as Importance)];
    case "anytime_this_week":
      return [where("importance", "==", "anytime_this_week" as Importance)];
    case "urgent":
      return [where("importance", "==", "urgent" as Importance)];
    default:
      return [];
  }
}

export const PAGE_SIZE = 25;

export async function listOrders(
  filter: OrderFilter,
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ orders: Order[]; last: QueryDocumentSnapshot<DocumentData> | null }> {
  const constraints: QueryConstraint[] = [
    ...filterConstraints(filter),
    orderBy("createdAt", "desc"),
    ...(cursor ? [startAfter(cursor)] : []),
    limit(PAGE_SIZE),
  ];
  const snap = await getDocs(query(ordersCol, ...constraints));
  return {
    orders: snap.docs.map((d) => d.data() as Order),
    last: snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null,
  };
}

/** Orders for one customer, newest first (used by customer search in the list). */
export async function listOrdersByCustomer(customerId: string): Promise<Order[]> {
  return getMany<Order>(
    ordersCol,
    where("customerId", "==", customerId),
    orderBy("createdAt", "desc"),
    limit(100)
  );
}
