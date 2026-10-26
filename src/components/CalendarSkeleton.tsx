import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the calendar toolbar + month grid dimensions 1:1 so lazy loading
// and SQL refetch never cause layout shift. Each day cell mimics the real
// MonthDayCell: day-number header row + 1-2 compact event-card shapes
// (title line + time pill) matching src/pages/CalendarPage.tsx.
function MonthCellSkeleton({ withEvents }: { withEvents: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="min-h-[46px] sm:min-h-[54px] md:min-h-[85px] lg:min-h-[96px] xl:min-h-[105px] rounded-lg md:rounded-xl glass-cell p-1 md:p-1.5 flex flex-col justify-between gap-1"
    >
      <div className="flex items-center justify-between pb-0.5 border-b border-white/10">
        <Skeleton className="h-3 w-5 rounded" />
      </div>
      {withEvents ? (
        <div className="hidden md:flex flex-col gap-1 flex-1 mt-1">
          <div className="rounded-lg border border-white/10 p-1 space-y-1">
            <div className="flex items-start justify-between gap-1">
              <Skeleton className="h-2.5 w-3/4 rounded" />
              <Skeleton className="h-2.5 w-8 rounded" />
            </div>
            <Skeleton className="hidden lg:block h-2 w-full rounded" />
          </div>
          <div className="rounded-lg border border-white/10 p-1">
            <Skeleton className="h-2.5 w-2/3 rounded" />
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {/* Mobile dot row */}
      <div className="flex md:hidden items-center justify-center py-1">
        {withEvents && <Skeleton className="h-2.5 w-2.5 !rounded-full" />}
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading calendar"
      className="space-y-[var(--fluid-gap)] py-[var(--fluid-section-y)] max-w-[var(--fluid-container-max)] mx-auto px-[var(--fluid-pad-x)] animate-in fade-in duration-200 w-full"
    >
      {/* Header */}
      <div className="border-b border-white/10 pb-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-10 w-64 rounded-xl" />
      </div>

      {/* Controls: search + view switcher */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Skeleton className="h-10 w-full sm:w-72 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-36 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>

        {/* Date stepper */}
        <div className="flex items-center justify-between py-2 border-y border-white/10">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-8 w-8 !rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 !rounded-full" />
          </div>
        </div>
      </div>

      {/* Weekday header */}
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full rounded-md" />
          ))}
        </div>

        {/* Month cells — every ~3rd cell carries event shapes like real data */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <MonthCellSkeleton key={i} withEvents={i % 3 === 1} />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading calendar…</span>
    </div>
  );
}

export default CalendarSkeleton;
