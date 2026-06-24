import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { serverTimestamp, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import { Printer, CheckSquare, Archive, X, Plus } from "lucide-react";
import toast from "react-hot-toast";
import {
  listOrders,
  bulkUpdate,
  PAGE_SIZE,
  type OrderFilter,
} from "@/services/orders";
import { getOrder } from "@/services/orders";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  SearchInput,
  Button,
  Badge,
  StatusBadge,
  ImportanceBadge,
  statusSpine,
  EmptyState,
  PageLoader,
  ConfirmDialog,
  cn,
  Th,
} from "@/components/ui";
import { fmtDateTime, fmtRelative } from "@/utils/format";
import type { Order } from "@/types";

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "archived", label: "Archived" },
  { key: "printed", label: "Printed" },
  { key: "not_printed", label: "Not printed" },
  { key: "urgent", label: "Urgent" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "anytime_this_week", label: "This week" },
];

type Cursor = QueryDocumentSnapshot<DocumentData> | null;
type BulkAction = "printed" | "close" | "archive" | null;

export function Orders() {
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [cursor, setCursor] = useState<Cursor>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<BulkAction>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async (f: OrderFilter) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const { orders: o, last } = await listOrders(f);
      setOrders(o);
      setCursor(last);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't load orders. A Firestore index may still be building.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const { orders: o, last } = await listOrders(filter, cursor);
      setOrders((cur) => [...cur, ...o]);
      setCursor(last);
    } finally {
      setLoadingMore(false);
    }
  }

  // Numeric search jumps straight to the order; text filters the loaded list.
  async function onSearchEnter() {
    const n = search.trim();
    if (/^#?\d+$/.test(n)) {
      const num = n.replace("#", "");
      const o = await getOrder(`order_${num}`);
      if (o) navigate(`/orders/${o.id}`);
      else toast.error(`No order #${num}.`);
    }
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        String(o.orderNumber).includes(q.replace("#", "")) ||
        o.customerName.toLowerCase().includes(q)
    );
  }, [orders, search]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((cur) =>
      cur.size === visible.length ? new Set() : new Set(visible.map((o) => o.id))
    );
  }

  async function runBulk() {
    if (!user || !bulk) return;
    setBulkBusy(true);
    const ids = [...selected];
    const u = { uid: user.uid, email: profile?.email || user.email || "" };
    try {
      if (bulk === "printed") await bulkUpdate(ids, { printed: true } as never, u);
      if (bulk === "close")
        await bulkUpdate(ids, { status: "closed", closedAt: serverTimestamp() } as never, u);
      if (bulk === "archive")
        await bulkUpdate(
          ids,
          { status: "archived", archived: true, archivedAt: serverTimestamp() } as never,
          u
        );
      toast.success(`Updated ${ids.length} order${ids.length > 1 ? "s" : ""}`);
      setBulk(null);
      await load(filter);
    } catch (e) {
      console.error(e);
      toast.error("Bulk action failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  const allChecked = visible.length > 0 && selected.size === visible.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        subtitle="Newest first. Filter, search, or select to act in bulk."
        actions={
          hasRole("worker") && (
            <Link to="/orders/new">
              <Button size="sm">
                <Plus size={15} /> Create
              </Button>
            </Link>
          )
        }
      />

      <SearchInput
        placeholder="Search by order # or customer…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
      />

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition",
              filter === f.key
                ? "bg-ink-900 text-white"
                : "bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-white shadow-pop lg:top-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setBulk("printed")}>
              <Printer size={14} /> Mark printed
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulk("close")}>
              <CheckSquare size={14} /> Close
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setBulk("archive")}>
              <Archive size={14} /> Archive
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <PageLoader label="Loading orders…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No orders here"
          message={search ? "Nothing matches your search on this page." : "Try a different filter."}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl2 bg-white shadow-card lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <Th className="w-10">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                  </Th>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Date</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                  <Th>Printed</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => (
                  <tr
                    key={o.id}
                    className={cn(
                      "cursor-pointer border-l-4 hover:bg-ink-50/70",
                      statusSpine(o.status, o.importance),
                      rowTint(o)
                    )}
                    onClick={() => navigate(`/orders/${o.id}`)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular text-ink-700">
                      #{o.orderNumber}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-ink-900">{o.customerName}</td>
                    <td className="px-3 py-2.5 text-ink-500">{fmtDateTime(o.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <ImportanceBadge importance={o.importance} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      {o.printed ? <Badge tone="green">Printed</Badge> : <Badge>—</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {visible.map((o) => (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-3 rounded-r-lg bg-white p-3 shadow-card",
                  statusSpine(o.status, o.importance),
                  rowTint(o)
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-5 w-5"
                />
                <Link to={`/orders/${o.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular text-ink-500">
                      #{o.orderNumber}
                    </span>
                    <span className="truncate font-medium text-ink-900">{o.customerName}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={o.status} />
                    <ImportanceBadge importance={o.importance} />
                    {o.printed && <Badge tone="green">Printed</Badge>}
                    <span className="text-xs text-ink-400">{fmtRelative(o.createdAt)}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          {cursor && !search && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Load {PAGE_SIZE} more
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={bulk !== null}
        title={
          bulk === "printed"
            ? "Mark printed"
            : bulk === "close"
            ? "Close orders"
            : "Archive orders"
        }
        message={`Apply this to ${selected.size} selected order${selected.size > 1 ? "s" : ""}?`}
        confirmLabel="Apply"
        destructive={bulk === "archive"}
        loading={bulkBusy}
        onConfirm={runBulk}
        onCancel={() => setBulk(null)}
      />
    </div>
  );
}

function rowTint(o: Order): string {
  if (o.status === "archived") return "bg-ink-50";
  if (o.status === "closed") return "bg-emerald-50/40";
  if (o.importance === "tomorrow") return "bg-amber-50/40";
  return "bg-red-50/40"; // open / urgent
}
