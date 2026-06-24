import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { OrderForm, type OrderFormValue } from "@/components/order/OrderForm";
import { getOrder, updateOrder } from "@/services/orders";
import { getCustomer } from "@/services/catalog";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader, PageLoader, EmptyState } from "@/components/ui";
import type { Order, Customer } from "@/types";

export function EditOrder() {
  const { id = "" } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const o = await getOrder(id);
      setOrder(o);
      if (o?.customerId) setCustomer(await getCustomer(o.customerId));
      setLoading(false);
    })();
  }, [id]);

  async function handleSave(v: OrderFormValue) {
    if (!user || !order) return;
    setSaving(true);
    try {
      await updateOrder(
        order.id,
        {
          customerId: v.customer?.id ?? null,
          customerName: v.customer?.customerName ?? order.customerName,
          customerSnapshot: v.customer
            ? {
                customerName: v.customer.customerName,
                address: v.customer.address,
                city: v.customer.city,
                state: v.customer.state,
                postalCode: v.customer.postalCode,
              }
            : order.customerSnapshot,
          items: v.items,
          customLines: v.freeText.split("\n").filter((l) => l.trim() !== ""),
          notes: v.notes,
          importance: v.importance,
        },
        { uid: user.uid, email: profile?.email || user.email || "" }
      );
      toast.success("Order updated");
      navigate(`/orders/${order.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Loading order…" />;
  if (!order)
    return (
      <EmptyState title="Order not found" message="It may have been deleted." />
    );

  // Prefer edited customLines; fall back to the preserved legacy text for legacy orders.
  const freeText =
    order.customLines && order.customLines.length > 0
      ? order.customLines.join("\n")
      : order.legacyOutputText || "";

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Edit order #${order.orderNumber}`}
        actions={
          <Link to={`/orders/${order.id}`} className="text-sm font-medium text-brand-600 hover:underline">
            ← Back to order
          </Link>
        }
      />
      <OrderForm
        initial={{
          customer,
          items: order.items ?? [],
          freeText,
          notes: order.notes ?? "",
          importance: order.importance,
        }}
        submitLabel="Save changes"
        submitting={saving}
        onSubmit={handleSave}
      />
    </div>
  );
}
