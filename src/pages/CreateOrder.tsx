import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, Printer, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { OrderForm, type OrderFormValue } from "@/components/order/OrderForm";
import { createOrder } from "@/services/orders";
import { useAuth } from "@/hooks/useAuth";
import { Button, Card, PageHeader } from "@/components/ui";
import type { Order } from "@/types";

export function CreateOrder() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);
  const [resetKey, setResetKey] = useState(0);

  async function handleSubmit(v: OrderFormValue) {
    if (!user) return;
    setSubmitting(true);
    try {
      const order = await createOrder(
        {
          customer: v.customer,
          items: v.items,
          customLines: v.freeText.split("\n"),
          notes: v.notes,
          importance: v.importance,
        },
        { uid: user.uid, email: profile?.email || user.email || "" }
      );
      setCreated(order);
      toast.success(`Order #${order.orderNumber} created`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't create the order. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-md py-8">
        <Card className="p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={30} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-ink-900">Order created</h1>
          <p className="mt-1 font-mono text-3xl font-semibold tabular text-brand-600">
            #{created.orderNumber}
          </p>
          <p className="mt-1 text-sm text-ink-500">{created.customerName}</p>

          <div className="mt-6 grid gap-2">
            <Button onClick={() => navigate(`/orders/${created.id}`)}>
              <Eye size={16} /> View order
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/orders/${created.id}?print=1`)}
            >
              <Printer size={16} /> Print
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreated(null);
                setResetKey((k) => k + 1);
              }}
            >
              <Plus size={16} /> Create another order
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create order"
        subtitle="Search a customer, scan or search products, set priority, submit."
        actions={
          <Link to="/orders" className="text-sm font-medium text-brand-600 hover:underline">
            ← All orders
          </Link>
        }
      />
      <OrderForm key={resetKey} onSubmit={handleSubmit} submitting={submitting} />
    </div>
  );
}
