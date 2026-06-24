import { useEffect, useState } from "react";
import { Download, BarChart3, Loader2, TrendingUp, Clock, Trophy } from "lucide-react";
import { getReport, type ReportData } from "@/services/reports";
import { getProductAnalytics, type ProductAnalytics, type FreeformProduct } from "@/services/analytics";
import { PageHeader, Card, StatCard, Button, PageLoader, EmptyState, Badge } from "@/components/ui";
import { downloadCSV, stamp } from "@/utils/csv";
import { fmtRelative } from "@/utils/format";

const ANALYTICS_CACHE = "utd_analytics_v3";

export function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState(false);

  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [lastRun, setLastRun] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getReport().then(setData).catch(() => setError(true));
    // Restore the last analytics run from the browser so we don't re-scan on open.
    try {
      const raw = localStorage.getItem(ANALYTICS_CACHE);
      if (raw) {
        const { at, data: cached } = JSON.parse(raw);
        setAnalytics(cached);
        setLastRun(at);
      }
    } catch {
      /* ignore */
    }
  }, []);

  async function runAnalytics() {
    setRunning(true);
    setProgress(0);
    try {
      const a = await getProductAnalytics((n) => setProgress(n));
      const at = Date.now();
      setAnalytics(a);
      setLastRun(at);
      try {
        localStorage.setItem(ANALYTICS_CACHE, JSON.stringify({ at, data: a }));
      } catch {
        /* ignore */
      }
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
      ...data.topCustomers.map((c, i) => ({ section: "Top customers", label: `${i + 1}. ${c.name}`, value: c.count })),
    ];
    downloadCSV(`report-${stamp()}.csv`, rows, ["section", "label", "value"]);
  }

  function exportProductsCSV() {
    if (!analytics) return;
    const rows = analytics.freeformAllTime.map((p) => ({
      product: p.name,
      totalUnits: p.units,
      timesOrdered: p.count,
      recentUnits: p.recentUnits,
      recentOrders: p.recentCount,
    }));
    downloadCSV(`product-sales-${stamp()}.csv`, rows, [
      "product", "totalUnits", "timesOrdered", "recentUnits", "recentOrders",
    ]);
  }

  if (error) return <EmptyState title="Couldn't load reports" message="Check Firestore rules and indexes." />;
  if (!data) return <PageLoader label="Building reports…" />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Order activity, customer and order status, and product demand."
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

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink-700">Top 10 customers</h2>
          <RankList items={data.topCustomers.map((c) => ({ label: c.name, value: c.count }))} />
        </Card>
      </div>

      {/* ---- Product demand (on-demand full scan, cached in browser) ---- */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-700">
              <BarChart3 size={16} /> Product demand
            </h2>
            <p className="mt-0.5 text-xs text-ink-400">
              Scans every order (heavy read). Each handwritten line is one product; the result is
              cached here, so only re-run when you want fresh numbers.
              {lastRun ? ` Last run ${fmtRelative(new Date(lastRun))}.` : ""}
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
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Orders scanned" value={analytics.scanned.toLocaleString()} />
              <StatCard label="Handwritten orders" value={analytics.freeformOrders.toLocaleString()} />
              <StatCard label="Distinct products" value={analytics.distinctFreeformProducts.toLocaleString()} />
              <StatCard label="Active (30d)" value={`${analytics.freeformRecent.length}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section icon={<Trophy size={15} className="text-amber-500" />} title="Best sellers — all time">
                <ProductList items={analytics.freeformAllTime} value={(p) => p.units} sub={(p) => `${p.count} orders`} empty="No handwritten products found." />
              </Section>

              <Section icon={<Clock size={15} className="text-brand-600" />} title={`Selling now — last ${analytics.recentWindowDays} days`}>
                <ProductList items={analytics.freeformRecent} value={(p) => p.recentUnits} sub={(p) => `${p.recentCount} orders`} empty="Nothing in the recent window yet." />
              </Section>
            </div>

            <Section icon={<TrendingUp size={15} className="text-emerald-600" />} title="Trending up" badge={<Badge tone="green">gaining momentum</Badge>}>
              {analytics.freeformTrending.length === 0 ? (
                <p className="text-sm text-ink-400">Not enough recent history yet — trends appear as new orders come in.</p>
              ) : (
                <ProductList items={analytics.freeformTrending} value={(p) => p.recentUnits} sub={(p) => `${p.recentCount} recent / ${p.count} total`} empty="" />
              )}
            </Section>

            <div className="grid gap-4 lg:grid-cols-2">
              {analytics.structuredTopByUnits.length > 0 && (
                <Section title="Catalog products (itemized orders)">
                  <ProductList
                    items={analytics.structuredTopByUnits.map((r) => ({ name: r.name, units: r.units, count: r.orders, recentUnits: 0, recentCount: 0 }))}
                    value={(p) => p.units}
                    sub={(p) => `${p.count} orders`}
                    empty=""
                  />
                </Section>
              )}
              <Section title="Orders by user">
                <ol className="space-y-0.5">
                  {analytics.byUser.map((u) => (
                    <li key={u.user} className="flex items-center gap-3 py-1 text-sm">
                      <span className="min-w-0 flex-1 truncate text-ink-700">{u.user}</span>
                      <span className="font-mono tabular text-ink-500">{u.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Section({ icon, title, badge, children }: { icon?: React.ReactNode; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-700">
        {icon} {title} {badge}
      </h3>
      {children}
    </div>
  );
}

function ProductList({ items, value, sub, empty }: { items: FreeformProduct[]; value: (p: FreeformProduct) => number; sub: (p: FreeformProduct) => string; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-ink-400">{empty}</p>;
  return (
    <ol className="space-y-0.5">
      {items.map((p, i) => (
        <li key={p.name} className="flex items-center gap-3 py-1 text-sm">
          <span className="w-5 font-mono text-xs text-ink-400">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate capitalize text-ink-700">{p.name}</span>
          <span className="text-xs text-ink-400">{sub(p)}</span>
          <span className="w-12 text-right font-mono tabular font-medium text-ink-800">{value(p).toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-50 py-1.5 text-sm last:border-0">
      <span className="min-w-0 truncate pr-2 text-ink-600">{label}</span>
      <span className={`font-mono tabular font-medium ${tone ?? "text-ink-800"}`}>{value.toLocaleString()}</span>
    </div>
  );
}

function RankList({ items }: { items: { label: string; value: number }[] }) {
  return (
    <ol className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3 py-1 text-sm">
          <span className="w-5 font-mono text-xs text-ink-400">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-ink-700">{it.label}</span>
          <span className="font-mono tabular text-ink-500">{it.value.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
