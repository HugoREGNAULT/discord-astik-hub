import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 uppercase tracking-wide",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-[3px] border-primary shadow-[3px_3px_0px_#000000] motion-safe:transition-all motion-safe:hover:shadow-[1px_1px_0px_#000000] motion-safe:hover:translate-x-[2px] motion-safe:hover:translate-y-[2px]",
        destructive:
          "bg-destructive text-destructive-foreground border-[3px] border-destructive shadow-[3px_3px_0px_#000000] motion-safe:transition-all motion-safe:hover:shadow-[1px_1px_0px_#000000] motion-safe:hover:translate-x-[2px] motion-safe:hover:translate-y-[2px]",
        outline:
          "border-[3px] border-primary bg-transparent text-primary hover:bg-primary/10 motion-safe:transition-colors",
        secondary:
          "bg-secondary text-secondary-foreground border-[3px] border-border hover:bg-secondary/80 motion-safe:transition-colors",
        ghost: "hover:bg-accent hover:text-accent-foreground motion-safe:transition-colors",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
