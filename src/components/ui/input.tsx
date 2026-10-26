import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[var(--fluid-control-h)] w-full rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-[clamp(0.75rem,2.5vw,1rem)] py-2 text-fluid-body text-white placeholder:text-[#8E8E93] focus-visible:outline-none focus-visible:border-[#0A84FF] focus-visible:ring-1 focus-visible:ring-[#0A84FF] disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
