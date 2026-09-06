import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.06em] uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-[#5E2C32] bg-[#241416] text-[#E0A3AA]",
        secondary: "border-[#30292B] bg-[#1E1A1B] text-[#9B98A0]",
        destructive: "border-[#5E1A20] bg-[#290C0F] text-[#F09DA4]",
        outline: "border-[#30292B] bg-transparent text-[#9B98A0]",
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
