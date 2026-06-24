import { useRef, useState } from "react";
import { Upload, FileJson, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  buildPreview,
  commitImport,
  parseJSON,
  TARGET_FIELDS,
  type ImportType,
  type ImportPreview,
  type ImportResult,
} from "@/services/importer";
import { exportCollection } from "@/services/backup";
import { parseCSV } from "@/utils/csv";
import { useAuth } from "@/hooks/useAuth";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Select,
  PageLoader,
  cn,
} from "@/components/ui";

const TYPES: { value: ImportType; label: string }[] = [
  { value: "customers", label: "Customers" },
  { value: "products", label: "Products" },
  { value: "orders", label: "Orders" },
];

export function ImportBackup() {
  const { user, profile } = useAuth();
  const by = profile?.email || user?.email || "";
  const [type, setType] = useState<ImportType>("customers");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const text = await file.text();
      const rows = file.name.toLowerCase().endsWith(".json") ? parseJSON(text) : parseCSV(text);
      if (rows.length === 0) return toast.error("No rows found in file.");
      setRawRows(rows);
      const p = await buildPreview(type, rows);
      setPreview(p);
      setMapping({});
    } catch (err) {
      console.error(err);
      toast.error("Couldn't parse the file.");
    }
  }

  async function rePreview(newMapping: Record<string, string>) {
    setMapping(newMapping);
    setPreview(await buildPreview(type, rawRows, newMapping));
  }

  async function runImport() {
    if (!preview) return;
    setBusy(true);
    try {
      const res = await commitImport(preview, { overwrite, fileName, by });
      setResult(res);
      toast.success(`Imported ${res.imported}, skipped ${res.skipped}`);
      setPreview(null);
      setRawRows([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      console.error(e);
      toast.error("Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const head = preview ? preview.rows.slice(0, 25) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Import / Backup" subtitle="Load CSV or JSON, or export your data." />

      {/* ---- Import ---- */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink-700">Import data</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select
              label="Type"
              value={type}
              options={TYPES}
              onChange={(e) => {
                setType(e.target.value as ImportType);
                setPreview(null);
                setRawRows([]);
                setResult(null);
              }}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            onChange={onFile}
            className="hidden"
            id="import-file"
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Choose CSV / JSON
          </Button>
          {fileName && <span className="text-sm text-ink-500">{fileName}</span>}
        </div>

        {preview && (
          <div className="mt-4 space-y-3">
            {/* summary */}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="green">{preview.okCount} ready</Badge>
              {preview.errorCount > 0 && <Badge tone="red">{preview.errorCount} with errors</Badge>}
              {preview.existingDupCount > 0 && (
                <Badge tone="amber">{preview.existingDupCount} already exist</Badge>
              )}
              {preview.fileDupCount > 0 && (
                <Badge tone="amber">{preview.fileDupCount} duplicate in file</Badge>
              )}
            </div>

            {/* column mapping */}
            <details className="rounded-lg bg-ink-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-ink-700">
                Column mapping ({preview.headers.length} columns detected)
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TARGET_FIELDS[type].map((target) => (
                  <label key={target} className="text-xs text-ink-600">
                    {target}
                    <Select
                      className="mt-1 h-9"
                      value={mapping[target] ?? autoGuess(preview.headers, target) ?? ""}
                      options={[
                        { value: "", label: "— none —" },
                        ...preview.headers.map((h) => ({ value: h, label: h })),
                      ]}
                      onChange={(e) => rePreview({ ...mapping, [target]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </details>

            {/* preview table */}
            <div className="overflow-x-auto rounded-lg ring-1 ring-ink-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 text-ink-500">
                  <tr>
                    <th className="px-2 py-1.5">Row</th>
                    {TARGET_FIELDS[type].slice(0, 5).map((t) => (
                      <th key={t} className="px-2 py-1.5">{t}</th>
                    ))}
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {head.map((r, i) => (
                    <tr key={i} className={cn("border-t border-ink-50", r.issues.length > 0 && "bg-red-50/40")}>
                      <td className="px-2 py-1.5 font-mono text-ink-400">{i + 1}</td>
                      {TARGET_FIELDS[type].slice(0, 5).map((t) => (
                        <td key={t} className="max-w-[160px] truncate px-2 py-1.5 text-ink-700">
                          {String(r.mapped[t] ?? "")}
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        {r.issues.length > 0 ? (
                          <Badge tone="red">{r.issues.join(", ")}</Badge>
                        ) : r.duplicate === "existing" ? (
                          <Badge tone="amber">exists</Badge>
                        ) : r.duplicate === "in_file" ? (
                          <Badge tone="amber">dup</Badge>
                        ) : (
                          <Badge tone="green">ok</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 25 && (
                <div className="px-2 py-1.5 text-xs text-ink-400">
                  Showing 25 of {preview.rows.length} rows.
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Overwrite records that already exist (off = skip them)
            </label>

            <div className="flex items-center gap-2">
              <Button onClick={runImport} loading={busy} disabled={preview.okCount === 0}>
                Import {preview.okCount} record{preview.okCount === 1 ? "" : "s"}
              </Button>
              {preview.errorCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle size={13} /> Rows with errors are skipped.
                </span>
              )}
            </div>
          </div>
        )}

        {busy && !preview && <PageLoader label="Importing…" />}

        {result && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 size={16} />
            Imported {result.imported}, skipped {result.skipped}, errors {result.errors}.
          </div>
        )}

        <p className="mt-3 text-xs text-ink-400">
          The migrated files in <code>migration-output/</code> import directly — choose the
          matching type and select the JSON. IDs are preserved, so re-importing won't duplicate.
        </p>
      </Card>

      {/* ---- Backup ---- */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink-700">Backup / export</h2>
        <p className="mt-1 text-xs text-ink-400">
          Download a full copy of any collection. Orders export in pages, so the 7,935-row file
          may take a moment.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(["customers", "products", "orders"] as const).map((c) => (
            <ExportCard key={c} collection={c} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function autoGuess(headers: string[], target: string): string | undefined {
  const lc = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  return headers.find((h) => lc(h) === lc(target));
}

function ExportCard({ collection }: { collection: "customers" | "products" | "orders" }) {
  const [busy, setBusy] = useState<"json" | "csv" | null>(null);
  const [count, setCount] = useState<number | null>(null);

  async function go(format: "json" | "csv") {
    setBusy(format);
    try {
      const n = await exportCollection(collection, format, (c) => setCount(c));
      setCount(n);
      toast.success(`Exported ${n} ${collection}`);
    } catch {
      toast.error("Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg ring-1 ring-ink-100 p-3">
      <div className="text-sm font-medium capitalize text-ink-800">{collection}</div>
      {busy && count != null && (
        <div className="mt-1 text-xs text-ink-400">{count.toLocaleString()} rows…</div>
      )}
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => go("json")} loading={busy === "json"}>
          <FileJson size={14} /> JSON
        </Button>
        <Button size="sm" variant="secondary" onClick={() => go("csv")} loading={busy === "csv"}>
          <FileSpreadsheet size={14} /> CSV
        </Button>
      </div>
    </div>
  );
}
