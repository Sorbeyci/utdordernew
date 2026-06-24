import { useMemo, useState } from "react";
import { Plus, Package, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { useProducts, searchProducts } from "@/services/catalog";
import {
  createProduct,
  updateProduct,
  blankProduct,
  findDuplicateUpc,
  type ProductInput,
} from "@/services/products";
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
import { fmtMoney } from "@/utils/format";
import type { Product } from "@/types";

const CAP = 150;

export function Products() {
  const { user, profile, hasRole } = useAuth();
  const { products, loading } = useProducts();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [refresh, setRefresh] = useState(0);
  const canEdit = hasRole("manager");
  const by = profile?.email || user?.email || "";

  const results = useMemo(() => {
    const list = q.trim()
      ? searchProducts(products, q, 500)
      : [...products].sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
    return list.slice(0, CAP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, q, refresh]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle={`${products.length} total`}
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add product
            </Button>
          )
        }
      />

      <SearchInput
        placeholder="Search by name, UPC, category, or aisle…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <PageLoader label="Loading catalog…" />
      ) : results.length === 0 ? (
        <EmptyState icon={<Package size={30} />} title="No products found" />
      ) : (
        <>
          {/* Desktop: inline-editable table */}
          <div className="hidden overflow-hidden rounded-xl2 bg-white shadow-card lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-3 py-2">UPC</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 w-20">Aisle</th>
                  <th className="px-3 py-2 w-24 text-right">Price</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <EditableRow
                    key={p.id}
                    product={p}
                    all={products}
                    canEdit={canEdit}
                    by={by}
                    onChanged={() => setRefresh((n) => n + 1)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards with edit modal */}
          <div className="space-y-2 lg:hidden">
            {results.map((p) => (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-ink-900">{p.productName}</div>
                  <div className="flex gap-2 text-xs text-ink-400">
                    {p.upc && <span className="font-mono tabular">{p.upc}</span>}
                    {p.aisle && <span>Aisle {p.aisle}</span>}
                    {p.duplicateUpc && <Badge tone="amber">dup UPC</Badge>}
                  </div>
                </div>
                <span className="font-mono text-sm tabular text-ink-600">{fmtMoney(p.price)}</span>
                {canEdit && (
                  <button
                    onClick={() => setEditing(p)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
                    aria-label="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                )}
              </Card>
            ))}
          </div>

          {(q.trim() ? searchProducts(products, q, 9999).length : products.length) > CAP && (
            <p className="text-center text-xs text-ink-400">
              Showing first {CAP}. Refine your search to see more.
            </p>
          )}
        </>
      )}

      {(adding || editing) && (
        <ProductFormModal
          product={editing}
          all={products}
          by={by}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={() => {
            setAdding(false);
            setEditing(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function EditableRow({
  product,
  all,
  canEdit,
  by,
  onChanged,
}: {
  product: Product;
  all: Product[];
  canEdit: boolean;
  by: string;
  onChanged: () => void;
}) {
  const [f, setF] = useState({
    upc: product.upc,
    productName: product.productName,
    category: product.category,
    aisle: product.aisle,
    price: product.price == null ? "" : String(product.price),
  });

  async function commit(field: keyof typeof f) {
    if (!canEdit) return;
    const value = f[field];
    const original =
      field === "price" ? (product.price == null ? "" : String(product.price)) : product[field];
    if (value === original) return;
    if (field === "upc" && findDuplicateUpc(all, value, product.id)) {
      toast.error("Another product already uses this UPC.");
      setF((s) => ({ ...s, upc: product.upc }));
      return;
    }
    try {
      await updateProduct(product.id, { [field]: value } as never, by);
      toast.success("Saved");
      onChanged();
    } catch {
      toast.error("Save failed.");
    }
  }

  const cell = "border-b border-ink-50";
  const inp =
    "w-full bg-transparent px-3 py-2 focus:bg-brand-50 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-400";

  return (
    <tr className="hover:bg-ink-50/40">
      <td className={cell}>
        <input
          className={`${inp} font-mono tabular`}
          value={f.upc}
          disabled={!canEdit}
          onChange={(e) => setF((s) => ({ ...s, upc: e.target.value }))}
          onBlur={() => commit("upc")}
        />
      </td>
      <td className={cell}>
        <input
          className={`${inp} font-medium`}
          value={f.productName}
          disabled={!canEdit}
          onChange={(e) => setF((s) => ({ ...s, productName: e.target.value }))}
          onBlur={() => commit("productName")}
        />
      </td>
      <td className={cell}>
        <input
          className={inp}
          value={f.category}
          disabled={!canEdit}
          onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}
          onBlur={() => commit("category")}
        />
      </td>
      <td className={cell}>
        <input
          className={`${inp} font-mono tabular`}
          value={f.aisle}
          disabled={!canEdit}
          onChange={(e) => setF((s) => ({ ...s, aisle: e.target.value }))}
          onBlur={() => commit("aisle")}
        />
      </td>
      <td className={cell}>
        <input
          className={`${inp} text-right font-mono tabular`}
          value={f.price}
          disabled={!canEdit}
          onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))}
          onBlur={() => commit("price")}
        />
      </td>
      <td className={`${cell} px-2 text-center`}>
        {product.duplicateUpc && <Badge tone="amber">dup</Badge>}
      </td>
    </tr>
  );
}

function ProductFormModal({
  product,
  all,
  by,
  onClose,
  onSaved,
}: {
  product: Product | null;
  all: Product[];
  by: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductInput>(
    product
      ? {
          upc: product.upc,
          productName: product.productName,
          category: product.category,
          price: product.price,
          cost: product.cost,
          aisle: product.aisle,
          location: product.location,
          notes: product.notes,
          active: product.active,
        }
      : blankProduct()
  );
  const [saving, setSaving] = useState(false);
  const dup = findDuplicateUpc(all, String(form.upc), product?.id);

  async function save() {
    if (!form.productName.trim()) return toast.error("Product name is required.");
    if (dup) return toast.error("Another product already uses this UPC.");
    setSaving(true);
    try {
      if (product) await updateProduct(product.id, form, by);
      else await createProduct(form, by);
      toast.success(product ? "Product updated" : "Product added");
      onSaved();
    } catch {
      toast.error("Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  const setStr = (k: keyof ProductInput, v: string) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? "Edit product" : "Add product"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {product ? "Save" : "Add"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Product name" value={form.productName} onChange={(e) => setStr("productName", e.target.value)} />
        </div>
        <Input
          label="UPC"
          mono
          value={form.upc}
          onChange={(e) => setStr("upc", e.target.value)}
          error={dup ? "UPC already in use." : undefined}
        />
        <Input label="Category" value={form.category} onChange={(e) => setStr("category", e.target.value)} />
        <Input
          label="Price"
          mono
          value={form.price == null ? "" : String(form.price)}
          onChange={(e) => setStr("price", e.target.value)}
        />
        <Input
          label="Cost"
          mono
          value={form.cost == null ? "" : String(form.cost)}
          onChange={(e) => setStr("cost", e.target.value)}
        />
        <Input label="Aisle" mono value={form.aisle} onChange={(e) => setStr("aisle", e.target.value)} />
        <Input label="Shelf / bin" value={form.location} onChange={(e) => setStr("location", e.target.value)} />
        <div className="sm:col-span-2">
          <Input label="Notes" value={form.notes} onChange={(e) => setStr("notes", e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
