import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { listUsers, setUserRole, setUserActive } from "@/services/users";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Select,
  PageLoader,
  EmptyState,
} from "@/components/ui";
import { fmtRelative } from "@/utils/format";
import type { AppUser, Role } from "@/types";
import { ROLE_LABELS } from "@/types";

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((r) => ({
  value: r,
  label: ROLE_LABELS[r],
}));

export function AdminUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch {
      toast.error("Couldn't load users.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function changeRole(u: AppUser, role: Role) {
    await setUserRole(u.id, role);
    setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, role } : x)));
    toast.success(`${u.displayName} is now ${ROLE_LABELS[role]}`);
  }

  async function toggleActive(u: AppUser) {
    await setUserActive(u.id, !u.active);
    setUsers((cur) => cur.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    toast.success(u.active ? "Access disabled" : "Access approved");
  }

  if (loading) return <PageLoader label="Loading users…" />;

  const pending = users.filter((u) => !u.active);
  const active = users.filter((u) => u.active);

  return (
    <div className="space-y-5">
      <PageHeader title="Admin users" subtitle={`${users.length} accounts`} />

      {pending.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-amber-700">
            Pending approval ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                self={u.email === profile?.email}
                onRole={changeRole}
                onToggle={toggleActive}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Active ({active.length})</h2>
        {active.length === 0 ? (
          <EmptyState title="No active users" />
        ) : (
          <div className="space-y-2">
            {active.map((u) => (
              <UserRow
                key={u.id}
                user={u}
                self={u.email === profile?.email}
                onRole={changeRole}
                onToggle={toggleActive}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({
  user,
  self,
  onRole,
  onToggle,
}: {
  user: AppUser;
  self: boolean;
  onRole: (u: AppUser, r: Role) => void;
  onToggle: (u: AppUser) => void;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="h-9 w-9 rounded-full" />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-full bg-ink-200 text-sm font-semibold text-ink-600">
          {(user.displayName || "?")[0].toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink-900">{user.displayName}</span>
          {self && <Badge tone="blue">You</Badge>}
          {!user.active && <Badge tone="amber">Pending</Badge>}
        </div>
        <div className="truncate text-xs text-ink-500">
          {user.email} · last seen {fmtRelative(user.lastLoginAt)}
        </div>
      </div>
      <div className="w-32">
        <Select
          value={user.role}
          options={ROLE_OPTIONS}
          disabled={self}
          onChange={(e) => onRole(user, e.target.value as Role)}
        />
      </div>
      <Button
        size="sm"
        variant={user.active ? "secondary" : "success"}
        disabled={self}
        onClick={() => onToggle(user)}
      >
        {user.active ? "Disable" : "Approve"}
      </Button>
    </Card>
  );
}
