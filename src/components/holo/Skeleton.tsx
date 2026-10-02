import { cn } from "@/lib/utils";

/** Shimmer block matching the holo palette. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("holo-skeleton rounded-md", className)} />;
}

/** Dashboard / module card placeholder. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("holo-panel p-4", className)} aria-hidden>
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-md shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-14" />
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Chat transcript placeholder. */
export function SkeletonChat() {
  return (
    <div className="space-y-5 p-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className={i % 2 === 1 ? "flex justify-end" : "flex gap-3"}>
          {i % 2 === 0 && <Skeleton className="w-7 h-7 rounded-full shrink-0" />}
          <div className={cn("space-y-2", i % 2 === 1 ? "w-1/2" : "w-3/4")}>
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            {i % 2 === 0 && <Skeleton className="h-3.5 w-2/3" />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Sidebar thread list placeholder. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
