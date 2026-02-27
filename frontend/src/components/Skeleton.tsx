import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-surface-border/40", className)} />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-7 h-7 rounded-md" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-4 space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface-card rounded-xl border border-surface-border p-5 space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}
