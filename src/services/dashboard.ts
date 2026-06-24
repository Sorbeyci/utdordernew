import {
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { ordersCol, customersCol, productsCol, getMany } from "./firestore";
import type { Order, Customer } from "@/types";

function daysAgo(n: number): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Timestamp.fromDate(d);
}

async function count(q: ReturnType<typeof query>): Promise<number> {
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalProducts: number;
  totalOrders: number;
  openOrders: number;
  closedOrders: number;
  ordersLast24h: number;
  ordersLast7d: number;
  ordersLast30d: number;
  topCustomers: Customer[];
  recentOrders: Order[];
  /** Non-empty if one or more sub-queries failed (e.g. a missing index). */
  errors: string[];
}

function msg(e: unknown): string {
  return (e as { message?: string })?.message ?? String(e);
}

/**
 * Resilient: each query is isolated, so a single failure (e.g. an index still
 * building) degrades that one number to 0 and is reported in `errors` rather
 * than blanking the whole dashboard.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const errors: string[] = [];

  const countTasks: Record<string, ReturnType<typeof query>> = {
    totalCustomers: query(customersCol),
    activeCustomers: query(customersCol, where("active", "==", true)),
    totalProducts: query(productsCol),
    totalOrders: query(ordersCol),
    openOrders: query(ordersCol, where("status", "==", "open")),
    closedOrders: query(ordersCol, where("status", "==", "closed")),
    ordersLast24h: query(ordersCol, where("createdAt", ">=", daysAgo(1))),
    ordersLast7d: query(ordersCol, where("createdAt", ">=", daysAgo(7))),
    ordersLast30d: query(ordersCol, where("createdAt", ">=", daysAgo(30))),
  };

  const keys = Object.keys(countTasks);
  const settled = await Promise.allSettled(keys.map((k) => count(countTasks[k])));
  const n: Record<string, number> = {};
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") n[keys[i]] = r.value;
    else {
      n[keys[i]] = 0;
      errors.push(msg(r.reason));
    }
  });

  let topCustomers: Customer[] = [];
  let recentOrders: Order[] = [];
  try {
    topCustomers = await getMany<Customer>(customersCol, orderBy("orderCount", "desc"), limit(10));
  } catch (e) {
    errors.push(msg(e));
  }
  try {
    recentOrders = await getMany<Order>(ordersCol, orderBy("createdAt", "desc"), limit(8));
  } catch (e) {
    errors.push(msg(e));
  }

  return {
    totalCustomers: n.totalCustomers,
    activeCustomers: n.activeCustomers,
    inactiveCustomers: Math.max(0, n.totalCustomers - n.activeCustomers),
    totalProducts: n.totalProducts,
    totalOrders: n.totalOrders,
    openOrders: n.openOrders,
    closedOrders: n.closedOrders,
    ordersLast24h: n.ordersLast24h,
    ordersLast7d: n.ordersLast7d,
    ordersLast30d: n.ordersLast30d,
    topCustomers,
    recentOrders,
    errors: [...new Set(errors)],
  };
}
