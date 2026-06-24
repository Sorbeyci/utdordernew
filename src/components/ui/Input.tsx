import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, mono, className, id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "h-10 w-full rounded-lg bg-white px-3 text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-500",
          mono && "font-mono tabular",
          error && "ring-red-400 focus:ring-red-500",
          className
        )}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-ink-400">{hint}</span>
      ) : null}
    </div>
  );
});
