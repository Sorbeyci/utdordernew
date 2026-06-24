import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Store, X } from "lucide-react";
import { useCustomers, searchCustomers } from "@/services/catalog";
import { SearchInput, LoadingSpinner, cn } from "@/components/ui";
import type { Customer } from "@/types";

export function CustomerPicker({
  value,
  onChange,
}: {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
}) {
  const { customers, loading } = useCustomers();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchCustomers(customers, q, 30), [customers, q]);

  return (
    <div className="relative" ref={boxRef}>
      {value && !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 hover:ring-brand-400"
        >
          <Store size={18} className="text-brand-600" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-ink-900">
              {value.customerName}
            </span>
            <span className="block truncate text-xs text-ink-500">
              {[value.address, value.city, value.state].filter(Boolean).join(", ") || "No address"}
            </span>
          </span>
          <ChevronDown size={18} className="text-ink-400" />
        </button>
      ) : (
        <div className="rounded-lg ring-1 ring-inset ring-ink-200 focus-within:ring-2 focus-within:ring-brand-500">
          <SearchInput
            autoFocus
            placeholder="Search customer by name…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="border-0 ring-0 focus:ring-0"
          />
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg bg-white py-1 shadow-pop ring-1 ring-ink-200">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQ("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <X size={15} /> Clear selection
            </button>
          )}
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-ink-400">
              <LoadingSpinner className="h-4 w-4" /> Loading customers…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-400">No customers match "{q}".</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                  setQ("");
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-50",
                  value?.id === c.id && "bg-brand-50"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {c.customerName}
                  </span>
                  <span className="block truncate text-xs text-ink-500">
                    {[c.address, c.city, c.state].filter(Boolean).join(", ") || "No address"}
                  </span>
                </span>
                {value?.id === c.id && <Check size={16} className="text-brand-600" />}
              </button>
            ))
          )}
        </div>
      )}

      {/* click-away */}
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
    </div>
  );
}
