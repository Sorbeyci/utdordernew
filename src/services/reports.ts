import {
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { ordersCol, customersCol, getMany } from "./firestore";
import type { Customer, Importance } from "@/types";
import { IMPORTANCE_LABELS } from "@/types";

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
  byImportance: { importance: Importance; label: string; count: number }[];
}

/**
 * Cheap by design: only server-side count() aggregations plus the stored
 * orderCount for top customers. No full-collection scans here — the heavy
 * per-product / per-user tallies live behind the on-demand analytics button.
 */
export async function getReport(): Promise<ReportData> {
  const [
    f24, f7, f14, f30,
    active, totalCustomers,
    open, closed, archived, nonArchived,
    impTomorrow, impWeek, impUrgent, impHold,
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
    byImportance: [
      { importance: "urgent", label: IMPORTANCE_LABELS.urgent, count: impUrgent },
      { importance: "tomorrow", label: IMPORTANCE_LABELS.tomorrow, count: impTomorrow },
      { importance: "anytime_this_week", label: IMPORTANCE_LABELS.anytime_this_week, count: impWeek },
      { importance: "hold", label: IMPORTANCE_LABELS.hold, count: impHold },
    ],
  };
}
