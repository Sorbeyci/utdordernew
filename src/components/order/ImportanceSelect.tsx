import { cn } from "@/components/ui";
import type { Importance } from "@/types";
import { IMPORTANCE_LABELS } from "@/types";

const OPTIONS: { value: Importance; tone: string }[] = [
  { value: "tomorrow", tone: "peer-checked:bg-amber-500 peer-checked:ring-amber-500" },
  { value: "anytime_this_week", tone: "peer-checked:bg-brand-600 peer-checked:ring-brand-600" },
  { value: "urgent", tone: "peer-checked:bg-red-600 peer-checked:ring-red-600" },
  { value: "hold", tone: "peer-checked:bg-violet-600 peer-checked:ring-violet-600" },
];

export function ImportanceSelect({
  value,
  onChange,
}: {
  value: Importance;
  onChange: (i: Importance) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {OPTIONS.map((o) => (
        <label key={o.value} className="cursor-pointer">
          <input
            type="radio"
            name="importance"
            className="peer sr-only"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span
            className={cn(
              "block rounded-lg bg-white px-3 py-2.5 text-center text-sm font-medium text-ink-600 ring-1 ring-inset ring-ink-200 transition",
              "peer-checked:text-white peer-checked:ring-2",
              o.tone
            )}
          >
            {IMPORTANCE_LABELS[o.value]}
          </span>
        </label>
      ))}
    </div>
  );
}
