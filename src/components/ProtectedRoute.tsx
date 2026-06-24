import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "@/components/ui";
import { Login } from "@/pages/Login";
import { Pending } from "@/pages/Pending";
import { AppLayout } from "@/layouts/AppLayout";
import type { Role } from "@/types";

/**
 * Wraps protected content. Flow:
 *  loading → spinner; no user → Login; user but inactive → Pending;
 *  active but role too low → access notice; otherwise render inside AppLayout.
 */
export function ProtectedRoute({
  children,
  min,
}: {
  children: ReactNode;
  min?: Role;
}) {
  const { user, profile, loading, isActive, hasRole } = useAuth();

  if (loading) return <PageLoader label="Signing you in…" />;
  if (!user) return <Login />;
  if (!profile || !isActive) return <Pending />;

  if (min && !hasRole(min)) {
    return (
      <AppLayout>
        <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h2 className="font-semibold">You don't have access to this page</h2>
          <p className="mt-1 text-sm">
            Ask an admin to upgrade your role if you need it.
          </p>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}
