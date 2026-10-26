import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[clamp(14px,13.5px_+_0.1vw,15px)] font-medium uppercase tracking-[0.05em] transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[var(--fluid-control-h)] px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.5rem,2vw,0.625rem)] select-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-white/90 active:scale-[0.98] shadow-sm transition-all cursor-pointer font-semibold",
        outline:
          "border border-white/20 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:border-white/30 active:scale-[0.98] transition-all cursor-pointer backdrop-blur-md",
        secondary:
          "bg-white/10 text-white/90 hover:bg-white/15 active:scale-[0.98] border border-white/10 transition-all cursor-pointer",
        ghost:
          "hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer",
        link:
          "text-[#FF3B30] hover:text-[#FF6961] underline-offset-4 hover:underline p-0 min-h-0 normal-case tracking-normal cursor-pointer",
        glass:
          "glass-button hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
        "ask-ai":
          "glass-button hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
      },
      size: {
        default: "h-[var(--fluid-control-h)] px-[clamp(1rem,3vw,1.5rem)]",
        sm: "min-h-[var(--fluid-control-h-sm)] px-[clamp(0.75rem,2.5vw,1rem)] text-fluid-label",
        lg: "min-h-[clamp(44px,48px_+_0.3vw,52px)] px-[clamp(1.5rem,4vw,2rem)] text-fluid-body",
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
