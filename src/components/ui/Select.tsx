import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, className, id, ...rest },
  ref
) {
  const sid = id || rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={sid} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={sid}
        className={cn(
          "h-10 w-full rounded-lg bg-white px-3 text-ink-900 ring-1 ring-inset ring-ink-200",
          "focus:outline-none focus:ring-2 focus:ring-brand-500",
          className
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
});
