import {
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { ordersCol, customersCol, getMany } from "./firestore";
import type { Customer, Order, Importance } from "@/types";
import { IMPORTANCE_LABELS } from "@/types";

const SCAN_LIMIT = 1000; // recent orders scanned for item/user tallies

function daysAgo(n: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
}
async function count(q: ReturnType<typeof query>): Promise<number> {
  return (await getCountFromServer(q)).data().count;
}

export interface ReportData {
  frequency: { period: string; count: number }[];
  customerStatus: { active: number; inactive: number };
  orderStatus: { open: number; closed: number; archived: number; nonArchived: number };
  topCustomers: { name: string; count: number }[];
  topProducts: { name: string; qty: number }[];
  byImportance: { importance: Importance; label: string; count: number }[];
  byUser: { user: string; count: number }[];
  scanned: number;
}

export async function getReport(): Promise<ReportData> {
  const [
    f24,
    f7,
    f14,
    f30,
    active,
    totalCustomers,
    open,
    closed,
    archived,
    nonArchived,
    impTomorrow,
    impWeek,
    impUrgent,
    impHold,
  ] = await Promise.all([
    count(query(ordersCol, where("createdAt", ">=", daysAgo(1)))),
    count(query(ordersCol, where("createdAt", ">=", daysAgo(7)))),
    count(query(ordersCol, where("createdAt", ">=", daysAgo(14)))),
    count(query(ordersCol, where("createdAt", ">=", daysAgo(30)))),
    count(query(customersCol, where("active", "==", true))),
    count(query(customersCol)),
    count(query(ordersCol, where("status", "==", "open"))),
    count(query(ordersCol, where("status", "==", "closed"))),
    count(query(ordersCol, where("status", "==", "archived"))),
    count(query(ordersCol, where("archived", "==", false))),
    count(query(ordersCol, where("importance", "==", "tomorrow"))),
    count(query(ordersCol, where("importance", "==", "anytime_this_week"))),
    count(query(ordersCol, where("importance", "==", "urgent"))),
    count(query(ordersCol, where("importance", "==", "hold"))),
  ]);

  const topCustomersRaw = await getMany<Customer>(
    customersCol,
    orderBy("orderCount", "desc"),
    limit(10)
  );

  // One bounded read of recent orders for item/user tallies (mostly meaningful
  // for structured orders; legacy freeform orders carry no parsed items).
  const recent = await getMany<Order>(ordersCol, orderBy("createdAt", "desc"), limit(SCAN_LIMIT));
  const productQty = new Map<string, number>();
  const userCount = new Map<string, number>();
  for (const o of recent) {
    userCount.set(o.createdBy || "—", (userCount.get(o.createdBy || "—") || 0) + 1);
    for (const it of o.items || []) {
      const key = it.productName.trim();
      if (key) productQty.set(key, (productQty.get(key) || 0) + (it.quantity || 0));
    }
  }

  const topProducts = [...productQty.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, qty]) => ({ name, qty }));

  const byUser = [...userCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([user, c]) => ({ user, count: c }));

  return {
    frequency: [
      { period: "Last 24 hours", count: f24 },
      { period: "Last 7 days", count: f7 },
      { period: "Last 14 days", count: f14 },
      { period: "Last 30 days", count: f30 },
    ],
    customerStatus: { active, inactive: totalCustomers - active },
    orderStatus: { open, closed, archived, nonArchived },
    topCustomers: topCustomersRaw.map((c) => ({ name: c.customerName, count: c.orderCount })),
    topProducts,
    byImportance: [
      { importance: "urgent", label: IMPORTANCE_LABELS.urgent, count: impUrgent },
      { importance: "tomorrow", label: IMPORTANCE_LABELS.tomorrow, count: impTomorrow },
      { importance: "anytime_this_week", label: IMPORTANCE_LABELS.anytime_this_week, count: impWeek },
      { importance: "hold", label: IMPORTANCE_LABELS.hold, count: impHold },
    ],
    byUser,
    scanned: recent.length,
  };
}
