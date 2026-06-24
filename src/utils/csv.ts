import Papa from "papaparse";

/** Serialize an array of objects to CSV using the given column order. */
export function toCSV(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return Papa.unparse(
    rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of cols) {
        const v = r[c];
        o[c] = v != null && typeof v === "object" ? JSON.stringify(v) : v ?? "";
      }
      return o;
    }),
    { columns: cols }
  );
}

/** Parse a CSV string into row objects (header row required). */
export function parseCSV(text: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return res.data;
}

export function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown) {
  download(filename, JSON.stringify(data, null, 2), "application/json");
}

export function downloadCSV(filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  download(filename, toCSV(rows, columns), "text/csv");
}

export function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}
