import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoloButton } from "@/components/holo/HoloButton";
import { Skeleton } from "@/components/holo/Skeleton";

/* ------------------------------------------------------------------ *
 * Shared design system used by every module screen.
 * One spacing scale, one radius, one border weight, restrained glow.
 * ------------------------------------------------------------------ */

/** Standard module page header: title, one-line description, optional actions. */
export function ModuleHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-6 sm:mb-8",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <span className="hud-text text-[10px] text-[oklch(0.7_0.12_220)]">{eyebrow}</span>
        )}
        <h1 className="font-display text-xl sm:text-2xl text-glow-cyan mt-1 leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Section heading inside a page. */
export function SectionHeader({
  title,
  hint,
  actions,
  className,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3", className)}>
      <div className="min-w-0">
        <h2 className="hud-text text-[11px] text-[oklch(0.82_0.16_220)]">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Neutral surface card — the single card style for the whole app. */
export function Card({
  children,
  className,
  accent = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-[oklch(0.1_0.04_270/0.5)] sm:backdrop-blur-sm",
        accent
          ? "border-[oklch(0.85_0.2_200/0.45)]"
          : "border-[oklch(0.7_0.15_220/0.18)]",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Vertical rhythm wrapper so every screen stacks the same way. */
export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("space-y-4 sm:space-y-5", className)}>{children}</div>;
}

export function LoadingState({ label = "Loading", lines = 3 }: { label?: string; lines?: number }) {
  return (
    <Card>
      <span className="sr-only">{label}</span>
      <div className="space-y-3" aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-lg border border-[oklch(0.7_0.15_220/0.25)] text-[oklch(0.75_0.12_220)]">
        {icon ?? <Inbox className="h-4 w-4" />}
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = "Something went wrong",
}: {
  message?: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <Card className="border-[oklch(0.7_0.18_25/0.35)]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.78_0.17_35)]" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {message && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground break-words">
              {message}
            </p>
          )}
          {onRetry && (
            <HoloButton variant="ghost" onClick={onRetry} className="mt-3">
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </HoloButton>
          )}
        </div>
      </div>
    </Card>
  );
}
