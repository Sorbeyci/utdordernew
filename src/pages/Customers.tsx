import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Store } from "lucide-react";
import toast from "react-hot-toast";
import { useCustomers, searchCustomers } from "@/services/catalog";
import {
  createCustomer,
  updateCustomer,
  setCustomerActive,
  blankCustomer,
  findDuplicateName,
  type CustomerInput,
} from "@/services/customers";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  SearchInput,
  Button,
  Card,
  Badge,
  Modal,
  Input,
  PageLoader,
  EmptyState,
} from "@/components/ui";
import type { Customer } from "@/types";

export function Customers() {
  const { user, profile, hasRole } = useAuth();
  const { customers, loading } = useCustomers();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [refresh, setRefresh] = useState(0);

  const results = useMemo(
    () => searchCustomers(customers, q, 200),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers, q, refresh]
  );
  const by = profile?.email || user?.email || "";

  async function toggleActive(c: Customer) {
    await setCustomerActive(c.id, !c.active, by);
    toast.success(c.active ? "Customer deactivated" : "Customer activated");
    setRefresh((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} total`}
        actions={
          hasRole("manager") && (
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus size={15} /> Add customer
            </Button>
          )
        }
      />

      <SearchInput
        placeholder="Search by name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <PageLoader label="Loading customers…" />
      ) : results.length === 0 ? (
        <EmptyState icon={<Store size={30} />} title="No customers found" />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {results.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 p-3">
              <Link to={`/customers/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-ink-900">{c.customerName}</span>
                  {!c.active && <Badge>Inactive</Badge>}
                </div>
                <div className="truncate text-xs text-ink-500">
                  {[c.address, c.city, c.state].filter(Boolean).join(", ") || "No address"}
                </div>
              </Link>
              <span className="font-mono text-sm tabular text-ink-400">{c.orderCount}</span>
              {hasRole("manager") && (
                <button
                  onClick={() => setEditing(c)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Edit"
                >
                  <Pencil size={15} />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <CustomerFormModal
          customer={editing === "new" ? null : editing}
          all={customers}
          onClose={() => setEditing(null)}
          onArchive={editing !== "new" ? () => toggleActive(editing) : undefined}
          onSaved={() => {
            setEditing(null);
            setRefresh((n) => n + 1);
          }}
          by={by}
        />
      )}
    </div>
  );
}

function CustomerFormModal({
  customer,
  all,
  onClose,
  onSaved,
  onArchive,
  by,
}: {
  customer: Customer | null;
  all: Customer[];
  onClose: () => void;
  onSaved: () => void;
  onArchive?: () => void;
  by: string;
}) {
  const [form, setForm] = useState<CustomerInput>(
    customer
      ? {
          customerName: customer.customerName,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          postalCode: customer.postalCode,
          phone: customer.phone,
          email: customer.email,
          contactName: customer.contactName,
          storeType: customer.storeType,
          route: customer.route,
          notes: customer.notes,
          active: customer.active,
        }
      : blankCustomer()
  );
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CustomerInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const dup = findDuplicateName(all, form.customerName, customer?.id);

  async function save() {
    if (!form.customerName.trim()) return toast.error("Name is required.");
    setSaving(true);
    try {
      if (customer) await updateCustomer(customer.id, form, by);
      else await createCustomer(form, by);
      toast.success(customer ? "Customer updated" : "Customer added");
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          {onArchive ? (
            <Button variant="ghost" onClick={onArchive}>
              {customer?.active ? "Deactivate" : "Activate"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {customer ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Customer name"
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            error={dup ? "A customer with this name already exists." : undefined}
          />
        </div>
        <Input label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
        <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
        <Input label="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
        <Input label="ZIP" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
        <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        <Input label="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <Input label="Contact" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
        <Input label="Store type" value={form.storeType} onChange={(e) => set("storeType", e.target.value)} />
        <Input label="Route" value={form.route} onChange={(e) => set("route", e.target.value)} />
        <div className="sm:col-span-2">
          <Input label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
