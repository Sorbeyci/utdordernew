import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Mail, MapPin, Plus } from "lucide-react";
import { getCustomer } from "@/services/catalog";
import { listOrdersByCustomer } from "@/services/orders";
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  ImportanceBadge,
  statusSpine,
  PageLoader,
  EmptyState,
  Button,
  cn,
} from "@/components/ui";
import { fmtDateTime } from "@/utils/format";
import type { Customer, Order } from "@/types";

export function CustomerDetail() {
  const { id = "" } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [indexLink, setIndexLink] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const c = await getCustomer(id);
        if (on) setCustomer(c);
      } catch (e) {
        console.error(e);
      } finally {
        // Always clear the page loader, even if the customer fetch failed.
        if (on) setLoading(false);
      }
      // Load order history separately so an index error here doesn't hang the page.
      try {
        const list = await listOrdersByCustomer(id);
        if (on) setOrders(list);
      } catch (e) {
        console.error(e);
        if (!on) return;
        setOrdersError(true);
        // Firestore puts a one-click index-creation URL in the error message.
        const msg = (e as { message?: string }).message ?? "";
        const m = msg.match(/https:\/\/console\.firebase\.google\.com\S+/);
        if (m) setIndexLink(m[0]);
      }
    })();
    return () => {
      on = false;
    };
  }, [id]);

  if (loading) return <PageLoader label="Loading customer…" />;
  if (!customer) return <EmptyState title="Customer not found" />;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => history.back()}>
        <ArrowLeft size={15} /> Back
      </Button>

      <PageHeader
        title={customer.customerName}
        subtitle={customer.active ? "Active customer" : "Inactive customer"}
        actions={
          <Link to="/orders/new">
            <Button size="sm">
              <Plus size={15} /> New order
            </Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="grid gap-2 text-sm text-ink-700 sm:grid-cols-2">
          {(customer.address || customer.city) && (
            <span className="flex items-center gap-2">
              <MapPin size={15} className="text-ink-400" />
              {[customer.address, customer.city, customer.state, customer.postalCode]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
          {customer.phone && (
            <span className="flex items-center gap-2">
              <Phone size={15} className="text-ink-400" /> {customer.phone}
            </span>
          )}
          {customer.email && (
            <span className="flex items-center gap-2">
              <Mail size={15} className="text-ink-400" /> {customer.email}
            </span>
          )}
          <span className="flex items-center gap-2 font-mono tabular text-ink-500">
            {customer.orderCount} orders
          </span>
        </div>
        {customer.notes && (
          <p className="mt-3 rounded-lg bg-ink-50 p-2 text-sm text-ink-600">{customer.notes}</p>
        )}
      </Card>

      <h2 className="text-sm font-semibold text-ink-700">
        Order history {orders.length >= 100 && <Badge>most recent 100</Badge>}
      </h2>

      {ordersError ? (
        <EmptyState
          title="Order history needs a Firestore index"
          message="Your old orders are safe — this query just needs a one-time index (customerId + createdAt). Create it below, wait ~1–2 minutes for it to build, then refresh."
          action={
            indexLink ? (
              <a
                href={indexLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create index in Firebase ↗
              </a>
            ) : undefined
          }
        />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders yet" message="Create the first order for this customer." />
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              className={cn(
                "flex items-center gap-3 rounded-r-lg bg-white p-3 shadow-card hover:bg-ink-50",
                statusSpine(o.status, o.importance)
              )}
            >
              <span className="font-mono text-sm tabular text-ink-500">#{o.orderNumber}</span>
              <span className="flex-1 text-sm text-ink-500">{fmtDateTime(o.createdAt)}</span>
              <ImportanceBadge importance={o.importance} />
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
