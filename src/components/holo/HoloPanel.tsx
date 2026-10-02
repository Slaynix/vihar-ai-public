import { cn } from "@/lib/utils";
import type { ReactNode, HTMLAttributes } from "react";

export function HoloPanel({
  className,
  glow = "cyan",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { glow?: "cyan" | "purple" | "none"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "holo-panel p-5",
        glow === "cyan" && "neon-border",
        glow === "purple" && "neon-border-purple",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function HudLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("hud-text text-xs text-[oklch(0.82_0.16_220)]", className)}>{children}</span>
  );
}
