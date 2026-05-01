import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center">
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span
        className={cn(
          "h-6 w-11 rounded-full border border-transparent bg-input transition-colors peer-checked:bg-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
          className,
        )}
      />
      <span className="pointer-events-none absolute left-1 h-4 w-4 rounded-full bg-background shadow-sm transition-transform peer-checked:translate-x-5" />
    </span>
  ),
);

Switch.displayName = "Switch";
