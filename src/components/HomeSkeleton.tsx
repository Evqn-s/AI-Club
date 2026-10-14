import { Skeleton } from "@/components/ui/skeleton";

// Mimics HomePage's SQL-backed club_info layout exactly:
// hero title + CTA row, 2-card grid (meeting times + 3 contact rows), vision line.
// Same fluid tokens / heights as src/pages/HomePage.tsx → no layout shift.
export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading club information"
      className="flex-1 flex flex-col justify-between gap-[clamp(1rem,2vw,1.75rem)] py-[clamp(0.75rem,2vw,1.25rem)] animate-in fade-in duration-200"
      aria-hidden="true"
    >
      {/* Hero */}
      <section className="text-center max-w-[var(--fluid-container-max)] mx-auto w-full space-y-[var(--fluid-gap)] pt-[clamp(0.5rem,1vw,1rem)] pb-[clamp(0.25rem,1vw,0.75rem)]">
        <Skeleton className="h-[clamp(3rem,10vw,5rem)] w-3/4 mx-auto rounded-2xl" />
        <div className="flex flex-wrap items-center justify-center gap-[clamp(0.5rem,2vw,0.75rem)] pt-[clamp(0.25rem,1.5vw,0.5rem)]">
          <Skeleton className="h-12 w-40 rounded-full" />
          <Skeleton className="h-12 w-32 rounded-full" />
        </div>
      </section>

      {/* Cards grid */}
      <div className="grid gap-[var(--fluid-gap)] sm:grid-cols-2 flex-1 content-center">
        <div className="rounded-[var(--fluid-radius-lg)] border border-[#242021] p-[var(--fluid-card-pad)] space-y-3">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-6 w-44 rounded-lg" />
          <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" />
        </div>
        <div className="rounded-[var(--fluid-radius-lg)] border border-[#242021] p-[var(--fluid-card-pad)] space-y-3">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-6 w-40 rounded-lg" />
          <div className="space-y-[var(--fluid-gap-sm)]">
            <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
            <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
            <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
          </div>
        </div>
      </div>

      {/* Vision */}
      <div className="max-w-[var(--fluid-container-narrow)] mx-auto w-full space-y-2">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3 mx-auto rounded-md" />
      </div>
      <span className="sr-only">Loading club information…</span>
    </div>
  );
}

export default HomeSkeleton;
