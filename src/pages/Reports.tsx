import { useEffect, useState } from "react";
import { Download, BarChart3, Loader2 } from "lucide-react";
import { getReport, type ReportData } from "@/services/reports";
import { getProductAnalytics, type ProductAnalytics } from "@/services/analytics";
import { PageHeader, Card, StatCard, Button, PageLoader, EmptyState, Badge } from "@/components/ui";
import { downloadCSV, stamp } from "@/utils/csv";

export function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);

  // Full product analytics — run on demand (scans every order).
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getReport().then(setData).catch(() => setError(true));
  }, []);

  async function runAnalytics() {
    setRunning(true);
    setProgress(0);
    try {
      const a = await getProductAnalytics((n) => setProgress(n));
      setAnalytics(a);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  }

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
      ...data.byUser.map((u) => ({ section: "By user", label: u.user, value: u.count })),
    ];
    downloadCSV(`report-${stamp()}.csv`, rows, ["section", "label", "value"]);
  }

  function exportProductsCSV() {
    if (!analytics) return;
    const rows = analytics.topByUnits.map((p) => ({
      product: p.name,
      unitsSold: p.units,
      orders: p.orders,
    }));
    downloadCSV(`product-sales-${stamp()}.csv`, rows, ["product", "unitsSold", "orders"]);
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
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Orders by user</h2>
          <div>
            {data.byUser.map((u) => (
              <Row key={u.user} label={u.user} value={u.count} />
            ))}
          </div>
        </Card>
      </div>

      {/* ---- Full product analytics (on-demand scan) ---- */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-700">
              <BarChart3 size={16} /> Product sales analytics
            </h2>
            <p className="mt-0.5 text-xs text-ink-400">
              Scans every order. Accurate for structured orders; handwritten orders are mined
              separately for demand terms.
            </p>
          </div>
          <div className="flex gap-2">
            {analytics && (
              <Button size="sm" variant="secondary" onClick={exportProductsCSV}>
                <Download size={14} /> Export
              </Button>
            )}
            <Button size="sm" onClick={runAnalytics} loading={running}>
              {analytics ? "Re-run" : "Run full analysis"}
            </Button>
          </div>
        </div>

        {running && (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-500">
            <Loader2 size={16} className="animate-spin" />
            Scanned {progress.toLocaleString()} orders…
          </div>
        )}

        {analytics && !running && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Orders scanned" value={analytics.scanned.toLocaleString()} />
              <StatCard label="Units sold (structured)" value={analytics.totalUnits.toLocaleString()} />
              <StatCard label="Distinct products" value={analytics.distinctProducts.toLocaleString()} />
              <StatCard
                label="Structured / handwritten"
                value={`${analytics.structuredOrders} / ${analytics.freeformOrders}`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-700">
                  Top products by units sold
                </h3>
                {analytics.topByUnits.length === 0 ? (
                  <p className="text-sm text-ink-400">
                    No structured items yet — builds up as new orders are created.
                  </p>
                ) : (
                  <RankList
                    items={analytics.topByUnits.map((p) => ({
                      label: p.name,
                      value: p.units,
                      sub: `${p.orders} orders`,
                    }))}
                  />
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink-700">
                  Top products by order count
                </h3>
                {analytics.topByOrders.length === 0 ? (
                  <p className="text-sm text-ink-400">No structured items yet.</p>
                ) : (
                  <RankList
                    items={analytics.topByOrders.map((p) => ({
                      label: p.name,
                      value: p.orders,
                      sub: `${p.units} units`,
                    }))}
                  />
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink-700">
                Most-ordered terms in handwritten orders <Badge tone="amber">approximate</Badge>
              </h3>
              <p className="mb-2 text-xs text-ink-400">
                Mined from {analytics.freeformOrders.toLocaleString()} handwritten order lists — a
                rough demand signal for your historical orders.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {analytics.topFreeformTerms.map((t) => (
                  <span
                    key={t.term}
                    className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-700"
                  >
                    {t.term}
                    <span className="font-mono tabular text-ink-400">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>
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

function RankList({ items }: { items: { label: string; value: number; sub?: string }[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3 py-1 text-sm">
          <span className="w-5 font-mono text-xs text-ink-400">{i + 1}</span>
          <span className="flex-1 truncate text-ink-700">{it.label}</span>
          {it.sub && <span className="text-xs text-ink-400">{it.sub}</span>}
          <span className="font-mono tabular text-ink-500">{it.value.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
