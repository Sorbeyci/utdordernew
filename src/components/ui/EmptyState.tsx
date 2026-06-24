import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl2 border border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
      <div className="text-ink-300">{icon ?? <Inbox size={32} />}</div>
      <h3 className="text-base font-semibold text-ink-700">{title}</h3>
      {message && <p className="max-w-sm text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
