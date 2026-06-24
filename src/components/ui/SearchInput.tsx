import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "./cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { className, ...rest },
  ref
) {
  return (
    <div className="relative">
      <Search
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
      />
      <input
        ref={ref}
        type="search"
        className={cn(
          "h-10 w-full rounded-lg bg-white pl-10 pr-3 text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400",
          "focus:outline-none focus:ring-2 focus:ring-brand-500",
          className
        )}
        {...rest}
      />
    </div>
  );
});
