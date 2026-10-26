import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-[clamp(0.625rem,2vw,0.75rem)] py-[clamp(0.125rem,1vw,0.25rem)] text-fluid-label font-medium tracking-[0.05em] uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/20 bg-white/10 text-white",
        secondary: "border-white/10 bg-white/5 text-[#8E8E93]",
        accent: "border-[#FF3B30]/30 bg-[#FF3B30]/15 text-[#FF3B30]",
        destructive: "status-error",
        outline: "border-white/15 bg-transparent text-[#8E8E93]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
