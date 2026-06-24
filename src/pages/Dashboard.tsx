import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusCircle,
  ClipboardList,
  Store,
  Package,
  BarChart3,
  Upload,
  Users,
  AlertTriangle,
} from "lucide-react";
import { getDashboardStats, type DashboardStats } from "@/services/dashboard";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  StatCard,
  PageHeader,
  PageLoader,
  StatusBadge,
  statusSpine,
  EmptyState,
  cn,
} from "@/components/ui";
import { fmtRelative } from "@/utils/format";

const QUICK = [
  { to: "/orders/new", label: "Create Order", icon: PlusCircle, min: "worker", primary: true },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/customers", label: "Customers", icon: Store },
  { to: "/products", label: "Products", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/import", label: "Import / Backup", icon: Upload, min: "manager" },
  { to: "/admin/users", label: "Admin Users", icon: Users, min: "admin" },
] as const;

function indexLinkFrom(errors: string[]): string | null {
  for (const e of errors) {
    const m = e.match(/https:\/\/console\.firebase\.google\.com\S+/);
    if (m) return m[0];
  }
  return null;
}

export function Dashboard() {
  const { profile, hasRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hardError, setHardError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((e) => setHardError((e as { message?: string })?.message ?? String(e)));
  }, []);

  const firstName = (profile?.displayName || "").split(" ")[0];
  const link = stats ? indexLinkFrom(stats.errors) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Hi, ${firstName}` : "Dashboard"}
        subtitle="Today's view of customers, products, and orders."
      />

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK.filter((q) => !("min" in q) || hasRole(q.min as never)).map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium shadow-card transition",
              "primary" in q && q.primary
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "bg-white text-ink-700 hover:bg-ink-50"
            )}
          >
            <q.icon size={17} />
            {q.label}
          </Link>
        ))}
      </div>

      {hardError ? (
        <EmptyState
          title="Couldn't load stats"
          message={hardError}
        />
      ) : !stats ? (
        <PageLoader label="Crunching the numbers…" />
      ) : (
        <>
          {/* Partial-failure banner (e.g. an index still building) */}
          {stats.errors.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Some figures couldn't load. {link ? "A Firestore index needs creating." : "Try refreshing."}
                  <span className="mt-1 block break-words text-xs text-amber-700/80">
                    {stats.errors[0]}
                  </span>
                </span>
              </div>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Create index in Firebase ↗
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Customers" value={stats.totalCustomers.toLocaleString()} to="/customers" />
            <StatCard label="Products" value={stats.totalProducts.toLocaleString()} to="/products" />
            <StatCard label="Total orders" value={stats.totalOrders.toLocaleString()} to="/orders" />
            <StatCard
              label="Open orders"
              value={stats.openOrders.toLocaleString()}
              accent="text-red-600"
              to="/orders?filter=open"
            />
            <StatCard
              label="Closed orders"
              value={stats.closedOrders.toLocaleString()}
              accent="text-emerald-600"
              to="/orders?filter=closed"
            />
            <StatCard label="Last 24 hours" value={stats.ordersLast24h.toLocaleString()} to="/orders?filter=last_24h" />
            <StatCard label="Last 7 days" value={stats.ordersLast7d.toLocaleString()} to="/orders?filter=last_7d" />
            <StatCard label="Last 30 days" value={stats.ordersLast30d.toLocaleString()} to="/orders?filter=last_30d" />
            <StatCard
              label="Active customers"
              value={stats.activeCustomers.toLocaleString()}
              to="/customers"
            />
            <StatCard
              label="Inactive customers"
              value={stats.inactiveCustomers.toLocaleString()}
              accent="text-ink-400"
              to="/customers"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top customers */}
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink-700">
                Top 10 customers by orders
              </h2>
              {stats.topCustomers.length === 0 ? (
                <p className="text-sm text-ink-400">No data.</p>
              ) : (
                <ol className="space-y-1">
                  {stats.topCustomers.map((c, i) => (
                    <li key={c.id}>
                      <Link
                        to={`/customers/${c.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                      >
                        <span className="w-5 font-mono text-xs text-ink-400">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                          {c.customerName}
                        </span>
                        <span className="font-mono text-sm tabular text-ink-500">
                          {c.orderCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* Recent orders */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink-700">Recent orders</h2>
                <Link to="/orders" className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </Link>
              </div>
              {stats.recentOrders.length === 0 ? (
                <p className="text-sm text-ink-400">No data.</p>
              ) : (
                <ul className="space-y-1">
                  {stats.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        to={`/orders/${o.id}`}
                        className={cn(
                          "flex items-center gap-3 rounded-r-lg bg-white px-3 py-2 hover:bg-ink-50",
                          statusSpine(o.status, o.importance)
                        )}
                      >
                        <span className="font-mono text-sm tabular text-ink-500">
                          #{o.orderNumber}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-800">
                          {o.customerName}
                        </span>
                        <span className="hidden text-xs text-ink-400 sm:block">
                          {fmtRelative(o.createdAt)}
                        </span>
                        <StatusBadge status={o.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
