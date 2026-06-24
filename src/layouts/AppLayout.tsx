import { type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  Store,
  Package,
  BarChart3,
  Upload,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/components/ui";
import type { Role } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  min?: Role;
  primary?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders/new", label: "Create", icon: PlusCircle, min: "worker", primary: true },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/customers", label: "Customers", icon: Store },
  { to: "/products", label: "Products", icon: Package },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/import", label: "Import / Backup", icon: Upload, min: "manager" },
  { to: "/admin/users", label: "Admin Users", icon: Users, min: "admin" },
];

// Five items for the mobile bottom bar — the daily-driver actions.
const MOBILE = ["/", "/orders/new", "/orders", "/customers", "/products"];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => !n.min || hasRole(n.min));
  const mobileItems = items.filter((n) => MOBILE.includes(n.to));

  return (
    <div className="min-h-full bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-ink-100 bg-white px-3 py-4 lg:flex">
        <div className="px-2 pb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-brand-600">
            Ultimate Tech
          </div>
          <div className="text-lg font-semibold tracking-tight">Order System</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon, primary }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-600 text-white"
                    : primary
                    ? "text-brand-700 hover:bg-brand-50"
                    : "text-ink-600 hover:bg-ink-100"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-2 border-t border-ink-100 pt-3">
          <div className="flex items-center gap-2 px-1">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-ink-200 text-xs font-semibold text-ink-600">
                {(profile?.displayName || "?")[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink-800">
                {profile?.displayName}
              </div>
              <div className="text-xs capitalize text-ink-400">{role}</div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate("/"))}
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-brand-600">
            Ultimate Tech
          </div>
          <div className="text-base font-semibold tracking-tight">Order System</div>
        </div>
        <button
          onClick={() => signOut().then(() => navigate("/"))}
          aria-label="Sign out"
          className="rounded-lg p-2 text-ink-400 hover:bg-ink-100"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Content */}
      <main className="px-4 pb-24 pt-4 sm:px-6 lg:ml-60 lg:px-8 lg:pb-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {mobileItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                isActive ? "text-brand-600" : "text-ink-400"
              )
            }
          >
            <Icon size={22} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
