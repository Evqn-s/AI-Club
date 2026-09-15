import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the calendar toolbar and grid dimensions so lazy loading does not
// cause the page layout to jump when CalendarPage finishes loading.
export function CalendarSkeleton() {
  return (
    <div className="space-y-[var(--fluid-gap)] py-[var(--fluid-section-y)] max-w-[var(--fluid-container-max)] mx-auto px-[var(--fluid-pad-x)] animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="border-b border-[#242021] pb-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      {/* Controls Bar Skeleton */}
      <div className="flex flex-col gap-4">
        {/* Top Controls Row: Search + View Switcher */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Skeleton className="h-10 w-full sm:w-72 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>


        {/* Date Stepper Bar Skeleton */}
        <div className="flex items-center justify-between py-2 border-y border-[#242021]/60">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="space-y-2">
        {/* Day of week header */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded-md" />
          ))}
        </div>

        {/* Calendar Month Cells */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-[clamp(4.5rem,10vw,7.5rem)] w-full rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default CalendarSkeleton;
