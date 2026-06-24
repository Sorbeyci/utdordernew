import type { Timestamp } from "firebase/firestore";

/**
 * Firestore data model for Ultimate Tech Distributors.
 * Doc IDs are deterministic for migrated records so re-imports never duplicate:
 *   customers/cust_{legacyCustomerId}
 *   products/prod_{legacyProductId}
 *   orders/order_{orderNumber}
 */

export type Role = "admin" | "manager" | "worker" | "viewer";

export type Importance = "tomorrow" | "anytime_this_week" | "urgent" | "hold";

export type OrderStatus = "open" | "closed" | "archived";

export type LegacyFormat = "structured" | "freeform" | "empty";

/** Dates are ISO strings in migration JSON and Firestore Timestamps in the live DB. */
type TS = Timestamp | string | null;

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: Role;
  active: boolean;
  createdAt: TS;
  lastLoginAt: TS;
}

export interface Customer {
  id: string;
  legacyCustomerId: number | null;
  customerName: string;
  /** UPPERCASE, whitespace-collapsed — the join + duplicate-detection key. */
  normalizedName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  email: string;
  contactName: string;
  storeType: string;
  route: string;
  notes: string;
  active: boolean;
  orderCount: number;
  lastOrderAt: TS;
  legacyUserId?: string;
  createdAt: TS;
  updatedAt: TS;
  createdBy: string;
  updatedBy: string;
}

export interface Product {
  id: string;
  legacyProductId: number | null;
  upc: string;
  productName: string;
  normalizedName: string;
  category: string;
  price: number | null;
  cost: number | null;
  aisle: string;
  location: string;
  notes: string;
  active: boolean;
  /** true when this UPC collides with another product (5 pairs in legacy data). */
  duplicateUpc?: boolean;
  createdAt: TS;
  updatedAt: TS;
  createdBy: string;
  updatedBy: string;
}

export interface OrderItem {
  productId?: string;
  upc?: string;
  productName: string;
  aisle?: string;
  price: number | null;
  quantity: number;
  note?: string;
  customLine: boolean;
}

export interface CustomerSnapshot {
  customerName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  legacyOrderNumber: number | null;
  customerId: string | null;
  customerName: string;
  customerSnapshot: CustomerSnapshot | Record<string, never>;

  /**
   * How this order's content is stored:
   *  - structured: items[] is the source of truth (new orders + 103 legacy)
   *  - freeform:   legacyOutputText is the source of truth (7,830 legacy)
   *  - empty:      no item content
   */
  legacyFormat: LegacyFormat;
  /** Verbatim original order text — never dropped, rendered for freeform orders. */
  legacyOutputText: string;

  items: OrderItem[];
  customLines: string[];
  notes: string;

  importance: Importance;
  legacyImportance?: string;

  status: OrderStatus;
  printed: boolean;
  archived: boolean;

  totalItems: number | null;
  totalQuantity: number | null;
  /** Original "Total Quantity/Items" footer — reference only, known unreliable. */
  legacyTotalsText?: { quantity: number | null; items: number | null };

  createdAt: TS;
  updatedAt: TS;
  closedAt: TS;
  archivedAt: TS;
  createdBy: string;
  updatedBy: string;
}

export interface OrderHistoryEntry {
  id: string;
  orderId: string;
  action: string;
  before: Partial<Order> | null;
  after: Partial<Order> | null;
  userId: string;
  userEmail: string;
  createdAt: TS;
}

export interface ImportLog {
  id: string;
  type: "customers" | "products" | "orders";
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  createdAt: TS;
  createdBy: string;
}

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  tomorrow: "Tomorrow",
  anytime_this_week: "Anytime this week",
  urgent: "Urgent",
  hold: "Hold",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  worker: "Worker",
  viewer: "Viewer",
};
