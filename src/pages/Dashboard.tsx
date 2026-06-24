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

export function Dashboard() {
  const { profile, hasRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => setError(true));
  }, []);

  const firstName = (profile?.displayName || "").split(" ")[0];

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

      {error ? (
        <EmptyState
          title="Couldn't load stats"
          message="Check your Firebase config and Firestore rules, then refresh."
        />
      ) : !stats ? (
        <PageLoader label="Crunching the numbers…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Customers" value={stats.totalCustomers.toLocaleString()} />
            <StatCard label="Products" value={stats.totalProducts.toLocaleString()} />
            <StatCard label="Total orders" value={stats.totalOrders.toLocaleString()} />
            <StatCard
              label="Open orders"
              value={stats.openOrders.toLocaleString()}
              accent="text-red-600"
            />
            <StatCard
              label="Closed orders"
              value={stats.closedOrders.toLocaleString()}
              accent="text-emerald-600"
            />
            <StatCard label="Last 24 hours" value={stats.ordersLast24h.toLocaleString()} />
            <StatCard label="Last 7 days" value={stats.ordersLast7d.toLocaleString()} />
            <StatCard label="Last 30 days" value={stats.ordersLast30d.toLocaleString()} />
            <StatCard
              label="Active customers"
              value={stats.activeCustomers.toLocaleString()}
            />
            <StatCard
              label="Inactive customers"
              value={stats.inactiveCustomers.toLocaleString()}
              accent="text-ink-400"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top customers */}
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink-700">
                Top 10 customers by orders
              </h2>
              <ol className="space-y-1">
                {stats.topCustomers.map((c, i) => (
                  <li key={c.id}>
                    <Link
                      to={`/customers/${c.id}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                    >
                      <span className="w-5 font-mono text-xs text-ink-400">{i + 1}</span>
                      <span className="flex-1 truncate text-sm text-ink-800">
                        {c.customerName}
                      </span>
                      <span className="font-mono text-sm tabular text-ink-500">
                        {c.orderCount}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>

            {/* Recent orders */}
            <Card className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink-700">Recent orders</h2>
                <Link to="/orders" className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </Link>
              </div>
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
                      <span className="flex-1 truncate text-sm text-ink-800">
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
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
