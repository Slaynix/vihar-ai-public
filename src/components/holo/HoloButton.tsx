import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "purple";

export const HoloButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", children, ...rest }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-sans tracking-wide text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        variant === "primary" && "bg-primary text-primary-foreground border border-primary hover:bg-primary/90 shadow-sm",
        variant === "purple" && "bg-accent text-accent-foreground border border-accent hover:bg-accent/90 shadow-sm",
        variant === "ghost" && "text-foreground border border-border hover:border-primary/60 hover:bg-primary/10",
        className,
      )}
      {...rest}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
});
HoloButton.displayName = "HoloButton";
