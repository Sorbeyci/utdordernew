import { useMemo, useRef, useState } from "react";
import { Barcode, Camera, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useProducts, searchProducts, findByUpc } from "@/services/catalog";
import { LoadingSpinner, cn } from "@/components/ui";
import { fmtMoney } from "@/utils/format";
import { CameraScanner } from "./CameraScanner";
import type { Product } from "@/types";

/**
 * Fast product entry. Works with a handheld scanner out of the box: the input
 * auto-focuses, and a scan (which types the UPC then hits Enter) adds the product
 * instantly. Typing a name filters the list; Enter adds the exact-UPC match, or
 * the only result, or the first result.
 */
export function ProductSearch({ onAdd }: { onAdd: (p: Product) => void }) {
  const { products, loading } = useProducts();
  const [q, setQ] = useState("");
  const [camera, setCamera] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchProducts(products, q, 25), [products, q]);

  function add(p: Product) {
    onAdd(p);
    setQ("");
    inputRef.current?.focus();
  }

  function handleEnter() {
    const raw = q.trim();
    if (!raw) return;
    const exact = findByUpc(products, raw);
    if (exact) return add(exact);
    if (results.length >= 1) return add(results[0]);
    toast.error(`No product matches "${raw}". Add it as a custom line.`);
  }

  function handleScan(code: string) {
    setCamera(false);
    const p = findByUpc(products, code);
    if (p) add(p);
    else {
      setQ(code);
      toast.error("Scanned code not in catalog. Search or add a custom line.");
      inputRef.current?.focus();
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Barcode
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            ref={inputRef}
            autoFocus
            inputMode="search"
            placeholder="Scan barcode or search product…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleEnter();
              }
            }}
            className="h-12 w-full rounded-lg bg-white pl-10 pr-3 text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setCamera(true)}
          aria-label="Scan with camera"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
        >
          <Camera size={20} />
        </button>
      </div>

      {q.trim() !== "" && (
        <div className="mt-1 max-h-64 overflow-auto rounded-lg bg-white shadow-pop ring-1 ring-ink-200">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-ink-400">
              <LoadingSpinner className="h-4 w-4" /> Loading catalog…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-sm text-ink-400">
              No match. Press the custom-line button below to add it manually.
            </div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">
                    {p.productName}
                  </span>
                  <span className="flex gap-2 text-xs text-ink-400">
                    {p.upc && <span className="font-mono tabular">{p.upc}</span>}
                    {p.aisle && <span>Aisle {p.aisle}</span>}
                  </span>
                </span>
                <span className="font-mono text-sm tabular text-ink-600">
                  {fmtMoney(p.price)}
                </span>
                <Plus size={16} className="text-brand-600" />
              </button>
            ))
          )}
        </div>
      )}

      <CameraScanner open={camera} onClose={() => setCamera(false)} onDetected={handleScan} />
    </div>
  );
}

/** Quantity stepper shared by order item rows. */
export function QtyStepper({
  value,
  onChange,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center rounded-lg ring-1 ring-inset ring-ink-200", className)}>
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid h-9 w-9 place-items-center text-ink-500 hover:bg-ink-50"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value || "1", 10)))}
        className="h-9 w-12 border-x border-ink-100 text-center font-mono text-sm tabular focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-9 place-items-center text-ink-500 hover:bg-ink-50"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
