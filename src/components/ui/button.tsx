import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[clamp(0.6875rem,0.65rem_+_0.4vw,0.75rem)] font-medium uppercase tracking-[0.06em] transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[var(--fluid-control-h)] px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.5rem,2vw,0.625rem)]",
  {
    variants: {
      variant: {
        default: "bg-[#241416] text-[#FFFFFF] border border-[#5E2C32] hover:bg-[#33181C] hover:border-[#BD6B75] shadow-sm",
        outline: "border border-[#382D30] bg-[#141213] text-[#E5E5E7] hover:border-[#5E2C32] hover:text-[#FFFFFF] hover:bg-[#1E1A1B]",
        secondary: "bg-[#1E1A1B] text-[#9B98A0] border border-[#382D30] hover:text-[#FFFFFF] hover:border-[#5E2C32]",
        ghost: "hover:bg-[#1E1A1B] text-[#9B98A0] hover:text-[#FFFFFF]",
        link: "text-[#E0A3AA] hover:text-[#FFFFFF] underline-offset-4 hover:underline p-0 min-h-0 normal-case tracking-normal",
        glass: "glass-button hover:scale-[1.02] active:scale-[0.98]",
      },
      size: {
        default: "h-[var(--fluid-control-h)] px-[clamp(1rem,3vw,1.5rem)]",
        sm: "min-h-[var(--fluid-control-h-sm)] px-[clamp(0.75rem,2.5vw,1rem)] text-fluid-label",
        lg: "min-h-[clamp(2.75rem,2.25rem_+_3vw,3.25rem)] px-[clamp(1.5rem,4vw,2rem)] text-fluid-body",
        icon: "h-[var(--fluid-control-h)] w-[var(--fluid-control-h)] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
