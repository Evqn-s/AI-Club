import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-[var(--fluid-control-h)] w-full rounded-full border border-[#30292B] bg-[#141213] px-[clamp(0.75rem,2.5vw,1rem)] py-2 text-fluid-body text-[#E5E5E7] placeholder:text-[#67646C] focus-visible:outline-none focus-visible:border-[#5E2C32] disabled:cursor-not-allowed disabled:opacity-50",
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
