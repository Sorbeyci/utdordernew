import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Pencil,
  Printer,
  CheckCircle2,
  RotateCcw,
  Archive,
  ArchiveRestore,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getOrder,
  setPrinted,
  closeOrder,
  reopenOrder,
  archiveOrder,
  unarchiveOrder,
  deleteOrder,
  getOrderHistory,
} from "@/services/orders";
import { useAuth } from "@/hooks/useAuth";
import {
  Button,
  Card,
  StatusBadge,
  ImportanceBadge,
  Badge,
  PageLoader,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import { fmtDateTime, fmtMoney } from "@/utils/format";
import type { Order } from "@/types";

export function OrderDetail() {
  const { id = "" } = useParams();
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<{ action: string; userEmail: string; createdAt: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reload = useCallback(async () => {
    const o = await getOrder(id);
    setOrder(o);
    setLoading(false);
    getOrderHistory(id).then((h) => setHistory(h as never)).catch(() => {});
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Auto-print when arriving from the success screen's Print button.
  useEffect(() => {
    if (order && params.get("print") === "1") {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [order, params]);

  const u = user ? { uid: user.uid, email: profile?.email || user.email || "" } : null;

  async function act(fn: () => Promise<void>, msg: string) {
    if (!u) return;
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await reload();
    } catch (e) {
      console.error(e);
      toast.error("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader label="Loading order…" />;
  if (!order)
    return <EmptyState title="Order not found" message="It may have been deleted." />;

  const snap = order.customerSnapshot as Record<string, string>;
  const cityLine = [snap.city, snap.state, snap.postalCode].filter(Boolean).join(", ");
  const freeText =
    order.customLines && order.customLines.length > 0
      ? order.customLines.join("\n")
      : order.legacyOutputText || "";
  const hasItems = (order.items?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Action bar — never printed */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
          <ArrowLeft size={15} /> Orders
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {hasRole("worker") && (
            <Link to={`/orders/${order.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={14} /> Edit
              </Button>
            </Link>
          )}
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={14} /> Print
          </Button>
          {hasRole("worker") && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => act(() => setPrinted(order.id, !order.printed, u!), order.printed ? "Marked unprinted" : "Marked printed")}
              disabled={busy}
            >
              {order.printed ? "Unmark printed" : "Mark printed"}
            </Button>
          )}
          {hasRole("worker") &&
            (order.status === "closed" ? (
              <Button variant="secondary" size="sm" onClick={() => act(() => reopenOrder(order.id, u!), "Reopened")} disabled={busy}>
                <RotateCcw size={14} /> Reopen
              </Button>
            ) : (
              <Button variant="success" size="sm" onClick={() => act(() => closeOrder(order.id, u!), "Closed")} disabled={busy}>
                <CheckCircle2 size={14} /> Close
              </Button>
            ))}
          {hasRole("worker") &&
            (order.archived ? (
              <Button variant="secondary" size="sm" onClick={() => act(() => unarchiveOrder(order.id, u!), "Unarchived")} disabled={busy}>
                <ArchiveRestore size={14} /> Unarchive
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => act(() => archiveOrder(order.id, u!), "Archived")} disabled={busy}>
                <Archive size={14} /> Archive
              </Button>
            ))}
          {hasRole("admin") && (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* ---- PRINT SHEET ---- */}
      <Card className="print-sheet p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200 pb-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-ink-400">
              Ultimate Tech Distributors LLC
            </div>
            <h1 className="mt-1 text-3xl font-bold leading-tight text-ink-900">
              {snap.customerName || order.customerName}
            </h1>
            <p className="mt-1 text-sm text-ink-600">
              {snap.address}
              {snap.address && cityLine ? " · " : ""}
              {cityLine}
            </p>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl font-bold tabular text-ink-900">
              #{order.orderNumber}
            </div>
            <div className="mt-1 text-sm text-ink-500">{fmtDateTime(order.createdAt)}</div>
            <div className="mt-2 flex justify-end gap-1.5">
              <StatusBadge status={order.status} />
              <ImportanceBadge importance={order.importance} />
              {order.printed && <Badge tone="green">Printed</Badge>}
            </div>
          </div>
        </div>

        {/* meta */}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-500">
          <span>Created by {order.createdBy || "—"}</span>
          {order.legacyOrderNumber && <span>Legacy #{order.legacyOrderNumber}</span>}
          {order.legacyFormat === "freeform" && <span>Imported (handwritten list)</span>}
        </div>

        {/* items — the light "order list" section, like the old sheet */}
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">Order list</h2>
            {(order.totalQuantity ?? 0) > 0 && (
              <span className="font-mono text-sm tabular text-ink-600">
                {order.totalItems} items · {order.totalQuantity} qty
              </span>
            )}
          </div>

          {hasItems && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-1 pr-2">Qty</th>
                  <th className="py-1 pr-2">Product</th>
                  <th className="py-1 pr-2">Aisle</th>
                  <th className="py-1 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it, i) => (
                  <tr key={i} className="border-t border-amber-200/70">
                    <td className="py-1.5 pr-2 font-mono tabular font-semibold text-ink-900">
                      {it.quantity}
                    </td>
                    <td className="py-1.5 pr-2 text-ink-800">
                      {it.productName}
                      {it.customLine && (
                        <span className="ml-1 text-xs text-amber-600">(custom)</span>
                      )}
                      {it.note ? <span className="text-ink-400"> — {it.note}</span> : null}
                    </td>
                    <td className="py-1.5 pr-2 font-mono tabular text-ink-500">{it.aisle || "—"}</td>
                    <td className="py-1.5 text-right font-mono tabular text-ink-600">
                      {fmtMoney(it.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {freeText.trim() && (
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink-800">
              {freeText}
            </pre>
          )}

          {!hasItems && !freeText.trim() && (
            <p className="text-sm text-ink-400">No items recorded.</p>
          )}
        </div>

        {/* notes */}
        {order.notes?.trim() && (
          <div className="mt-4 rounded-lg border-l-4 border-ink-300 bg-ink-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Notes</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">{order.notes}</p>
          </div>
        )}
      </Card>

      {/* history — never printed */}
      {history.length > 0 && (
        <Card className="no-print p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Activity</h2>
          <ul className="space-y-1.5">
            {history.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-ink-500">
                <span className="capitalize text-ink-700">{h.action}</span>
                <span>·</span>
                <span>{h.userEmail}</span>
                <span>·</span>
                <span>{fmtDateTime(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete order"
        message={`Permanently delete order #${order.orderNumber}? Archiving is usually safer and reversible.`}
        confirmLabel="Delete"
        destructive
        loading={busy}
        onConfirm={() =>
          act(async () => {
            await deleteOrder(order.id);
            navigate("/orders");
          }, "Order deleted").then(() => setConfirmDelete(false))
        }
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
