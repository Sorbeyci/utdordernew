import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { getReport, type ReportData } from "@/services/reports";
import { PageHeader, Card, StatCard, Button, PageLoader, EmptyState } from "@/components/ui";
import { downloadCSV, stamp } from "@/utils/csv";

export function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getReport().then(setData).catch(() => setError(true));
  }, []);

  function exportCSV() {
    if (!data) return;
    const rows: Record<string, unknown>[] = [
      ...data.frequency.map((f) => ({ section: "Order frequency", label: f.period, value: f.count })),
      { section: "Customers", label: "Active", value: data.customerStatus.active },
      { section: "Customers", label: "Inactive", value: data.customerStatus.inactive },
      { section: "Orders", label: "Open", value: data.orderStatus.open },
      { section: "Orders", label: "Closed", value: data.orderStatus.closed },
      { section: "Orders", label: "Archived", value: data.orderStatus.archived },
      { section: "Orders", label: "Non-archived", value: data.orderStatus.nonArchived },
      ...data.byImportance.map((i) => ({ section: "By importance", label: i.label, value: i.count })),
      ...data.topCustomers.map((c, i) => ({ section: "Top customers", label: `${i + 1}. ${c.name}`, value: c.count })),
      ...data.topProducts.map((p, i) => ({ section: "Top products", label: `${i + 1}. ${p.name}`, value: p.qty })),
      ...data.byUser.map((u) => ({ section: "By user", label: u.user, value: u.count })),
    ];
    downloadCSV(`report-${stamp()}.csv`, rows, ["section", "label", "value"]);
  }

  if (error) return <EmptyState title="Couldn't load reports" message="Check Firestore rules and indexes." />;
  if (!data) return <PageLoader label="Building reports…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Order activity, customer and order status, and top performers."
        actions={
          <Button size="sm" variant="secondary" onClick={exportCSV}>
            <Download size={15} /> Export CSV
          </Button>
        }
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Order frequency</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.frequency.map((f) => (
            <StatCard key={f.period} label={f.period} value={f.count.toLocaleString()} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Order status</h2>
          <Row label="Open" value={data.orderStatus.open} tone="text-red-600" />
          <Row label="Closed" value={data.orderStatus.closed} tone="text-emerald-600" />
          <Row label="Archived" value={data.orderStatus.archived} tone="text-ink-400" />
          <Row label="Non-archived" value={data.orderStatus.nonArchived} />
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Customer status</h2>
          <Row label="Active" value={data.customerStatus.active} tone="text-emerald-600" />
          <Row label="Inactive" value={data.customerStatus.inactive} tone="text-ink-400" />
          <h2 className="mb-3 mt-5 text-sm font-semibold text-ink-700">By delivery importance</h2>
          {data.byImportance.map((i) => (
            <Row key={i.importance} label={i.label} value={i.count} />
          ))}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Top 10 customers</h2>
          <RankList items={data.topCustomers.map((c) => ({ label: c.name, value: c.count }))} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-700">Top products</h2>
            <span className="text-xs text-ink-400">recent {data.scanned} orders</span>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-ink-400">
              No catalog-linked items yet — appears as structured orders accumulate.
            </p>
          ) : (
            <RankList items={data.topProducts.map((p) => ({ label: p.name, value: p.qty }))} />
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Orders by user</h2>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {data.byUser.map((u) => (
              <Row key={u.user} label={u.user} value={u.count} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-50 py-1.5 text-sm last:border-0">
      <span className="truncate pr-2 text-ink-600">{label}</span>
      <span className={`font-mono tabular font-medium ${tone ?? "text-ink-800"}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function RankList({ items }: { items: { label: string; value: number }[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3 py-1 text-sm">
          <span className="w-5 font-mono text-xs text-ink-400">{i + 1}</span>
          <span className="flex-1 truncate text-ink-700">{it.label}</span>
          <span className="font-mono tabular text-ink-500">{it.value.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
