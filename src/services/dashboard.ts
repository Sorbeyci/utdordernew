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
}

export async function getDashboardStats(): Promise<DashboardStats> {
  // Counts run server-side — no large reads even with thousands of orders.
  const [
    totalCustomers,
    activeCustomers,
    totalProducts,
    totalOrders,
    openOrders,
    closedOrders,
    ordersLast24h,
    ordersLast7d,
    ordersLast30d,
  ] = await Promise.all([
    count(query(customersCol)),
    count(query(customersCol, where("active", "==", true))),
    count(query(productsCol)),
    count(query(ordersCol)),
    count(query(ordersCol, where("status", "==", "open"))),
    count(query(ordersCol, where("status", "==", "closed"))),
    count(query(ordersCol, where("createdAt", ">=", daysAgo(1)))),
    count(query(ordersCol, where("createdAt", ">=", daysAgo(7)))),
    count(query(ordersCol, where("createdAt", ">=", daysAgo(30)))),
  ]);

  const [topCustomers, recentOrders] = await Promise.all([
    getMany<Customer>(customersCol, orderBy("orderCount", "desc"), limit(10)),
    getMany<Order>(ordersCol, orderBy("createdAt", "desc"), limit(8)),
  ]);

  return {
    totalCustomers,
    activeCustomers,
    inactiveCustomers: totalCustomers - activeCustomers,
    totalProducts,
    totalOrders,
    openOrders,
    closedOrders,
    ordersLast24h,
    ordersLast7d,
    ordersLast30d,
    topCustomers,
    recentOrders,
  };
}
