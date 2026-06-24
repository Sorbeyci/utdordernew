import { useState } from "react";
import { Trash2, Pencil, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { CustomerPicker } from "./CustomerPicker";
import { ProductSearch, QtyStepper } from "./ProductSearch";
import { ImportanceSelect } from "./ImportanceSelect";
import { Button, Card, cn } from "@/components/ui";
import { fmtMoney } from "@/utils/format";
import type { Customer, Importance, OrderItem, Product } from "@/types";

export interface OrderFormValue {
  customer: Customer | null;
  items: OrderItem[];
  freeText: string; // edited freeform list (newline-separated) -> customLines
  notes: string;
  importance: Importance;
}

export function OrderForm({
  initial,
  submitLabel = "Submit order",
  onSubmit,
  submitting,
}: {
  initial?: Partial<OrderFormValue>;
  submitLabel?: string;
  onSubmit: (v: OrderFormValue) => void;
  submitting?: boolean;
}) {
  const [customer, setCustomer] = useState<Customer | null>(initial?.customer ?? null);
  const [items, setItems] = useState<OrderItem[]>(initial?.items ?? []);
  const [freeText, setFreeText] = useState(initial?.freeText ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [importance, setImportance] = useState<Importance>(
    initial?.importance ?? "anytime_this_week"
  );
  const [showFreeText, setShowFreeText] = useState(!!(initial?.freeText ?? "").trim());

  function addProduct(p: Product) {
    setItems((cur) => {
      const i = cur.findIndex((x) => x.productId === p.id && !x.customLine);
      if (i >= 0) {
        const copy = [...cur];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [
        ...cur,
        {
          productId: p.id,
          upc: p.upc,
          productName: p.productName,
          aisle: p.aisle,
          price: p.price,
          quantity: 1,
          customLine: false,
        },
      ];
    });
  }

  function addCustomLine() {
    const name = window.prompt("Custom line — product name:");
    if (!name || !name.trim()) return;
    setItems((cur) => [
      ...cur,
      { productName: name.trim(), price: null, quantity: 1, customLine: true },
    ]);
  }

  function setQty(idx: number, q: number) {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, quantity: q } : it)));
  }
  function remove(idx: number) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  function submit() {
    if (!customer) return toast.error("Select a customer first.");
    if (items.length === 0 && !freeText.trim()) {
      return toast.error("Add at least one product or a free-text item.");
    }
    onSubmit({ customer, items, freeText, notes, importance });
  }

  return (
    <div className="space-y-5">
      {/* Customer */}
      <Card className="p-4">
        <label className="mb-2 block text-sm font-semibold text-ink-700">Customer</label>
        <CustomerPicker value={customer} onChange={setCustomer} />
      </Card>

      {/* Products */}
      <Card className="p-4">
        <label className="mb-2 block text-sm font-semibold text-ink-700">Products</label>
        <ProductSearch onAdd={addProduct} />

        {items.length > 0 && (
          <ul className="mt-3 divide-y divide-ink-100">
            {items.map((it, idx) => (
              <li key={idx} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    {it.customLine && <Pencil size={12} className="text-amber-500" />}
                    <span className="truncate text-sm font-medium text-ink-900">
                      {it.productName}
                    </span>
                  </span>
                  <span className="flex gap-2 text-xs text-ink-400">
                    {it.aisle && <span>Aisle {it.aisle}</span>}
                    {it.price != null && (
                      <span className="font-mono tabular">{fmtMoney(it.price)}</span>
                    )}
                    {it.customLine && <span className="text-amber-600">custom</span>}
                  </span>
                </span>
                <QtyStepper value={it.quantity} onChange={(q) => setQty(idx, q)} />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  aria-label="Remove"
                  className="grid h-9 w-9 place-items-center rounded-lg text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={addCustomLine}>
              <Pencil size={14} /> Add custom line
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFreeText((s) => !s)}
              className={cn(showFreeText && "text-brand-700")}
            >
              <FileText size={14} /> Free-text list
            </Button>
          </div>
          {items.length > 0 && (
            <span className="font-mono text-sm tabular text-ink-500">
              {items.length} items · {totalQty} qty
            </span>
          )}
        </div>

        {showFreeText && (
          <textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={6}
            placeholder="Type a handwritten-style list here (one item per line). Used for items not in the catalog, or for editing imported orders."
            className="mt-3 w-full rounded-lg bg-white p-3 font-mono text-sm text-ink-800 ring-1 ring-inset ring-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}
      </Card>

      {/* Importance */}
      <Card className="p-4">
        <label className="mb-2 block text-sm font-semibold text-ink-700">
          Delivery importance
        </label>
        <ImportanceSelect value={importance} onChange={setImportance} />
      </Card>

      {/* Notes */}
      <Card className="p-4">
        <label className="mb-2 block text-sm font-semibold text-ink-700">
          Notes / instructions
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Returns, exchanges, special pricing, delivery instructions…"
          className="w-full rounded-lg bg-white p-3 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </Card>

      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <Button size="lg" block loading={submitting} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
