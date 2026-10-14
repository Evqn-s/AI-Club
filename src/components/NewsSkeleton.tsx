import { Skeleton } from "@/components/ui/skeleton";

// Mimics the exact layout of a News SQL row card:
// CardHeader (author Badge pill + date) + CardContent (3 content lines).
// Heights/widths match src/pages/NewsPage.tsx so there is zero layout shift.
function NewsCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-[var(--fluid-radius-lg)] border border-[#242021] p-[var(--fluid-card-pad)] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-[clamp(0.5rem,2vw,0.75rem)]">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-28 rounded-md" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-[92%] rounded-md" />
        <Skeleton className="h-4 w-[68%] rounded-md" />
      </div>
    </div>
  );
}

export function NewsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading announcements"
      className="space-y-3 animate-in fade-in duration-200"
    >
      {Array.from({ length: count }).map((_, i) => (
        <NewsCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading announcements…</span>
    </div>
  );
}

export default NewsSkeleton;
