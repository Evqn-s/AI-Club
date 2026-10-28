import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowRight, MessageSquare } from "lucide-react";

// Mirrors src/pages/HomePage.tsx exactly — same root, hero, button sizes,
// card chrome (glass-panel), headers, outlined boxes (glass-cell) and vision
// anchor. Static chrome (labels, titles) renders as real text so the
// skeleton has identical geometry; only SQL-backed values shimmer.
// The hero title is shown as "AI Club" in-page; "Peths AI Club" is reserved
// for browser tab and search metadata. The CTAs remain fully functional while
// the Supabase record loads.
export function HomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading club information"
      className="flex-1 flex flex-col justify-between gap-[clamp(1rem,2vw,1.75rem)] py-[clamp(0.75rem,2vw,1.25rem)] animate-in fade-in duration-200"
    >
      {/* Hero — real title + functional CTAs (identical markup to HomePage) */}
      <section className="text-center max-w-[var(--fluid-container-max)] mx-auto w-full space-y-[var(--fluid-gap)] pt-[clamp(0.5rem,1vw,1rem)] pb-[clamp(0.25rem,1vw,0.75rem)]">
        <h1 className="text-fluid-hero font-bold tracking-[-0.02em] text-white leading-[0.98] select-none">
          AI Club
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-[clamp(0.5rem,2vw,0.75rem)] pt-[clamp(0.25rem,1.5vw,0.5rem)]">
          <Button asChild variant="glass" size="lg">
            <Link
              href="/calendar"
              onMouseEnter={() => import("@/lib/data").then(({ prefetchRoute }) => prefetchRoute("/calendar"))}
              onFocus={() => import("@/lib/data").then(({ prefetchRoute }) => prefetchRoute("/calendar"))}
              onTouchStart={() => import("@/lib/data").then(({ prefetchRoute }) => prefetchRoute("/calendar"))}
            >
              <span>View Schedule</span>
              <ArrowRight className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] ml-1.5" />
            </Link>
          </Button>
          <Button
            variant="glass"
            size="lg"
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("aiclub:open-chat"))}
            className="text-white hover:text-white"
          >
            <MessageSquare className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF]" />
            <span>Ask AI</span>
          </Button>
        </div>
      </section>

      {/* Cards grid — same 2-col grid; left = stacked Schedule + Discord */}
      <div className="grid gap-[var(--fluid-gap)] sm:grid-cols-2 flex-1 content-center">
        <div className="flex flex-col gap-[var(--fluid-gap)]">
          <Card className="glass-panel flex-1">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
                <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Schedule</span>
              </div>
              <CardTitle className="text-white font-semibold">Regular Meetings</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center">
              <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" />
            </CardContent>
          </Card>

          <Card className="glass-panel flex-1">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
                <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Discord Server</span>
              </div>
              <CardTitle className="text-white font-semibold">Join Our Community</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center">
              <div className="w-full flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Connect — static header, 3 outlined rows */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
              <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Connect</span>
            </div>
            <CardTitle className="text-white font-semibold">Get in Touch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-[clamp(0.5rem,2vw,0.625rem)]">
              <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-44 max-w-full rounded-md" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] rounded-full shrink-0" />
                  <Skeleton className="h-4 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-28 rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vision — single centered line like the real statement */}
      <div className="text-center pt-[clamp(0.25rem,1vw,0.75rem)] pb-[clamp(0.5rem,1.5vw,1rem)] max-w-[var(--fluid-container-narrow)] mx-auto px-[var(--fluid-pad-x)] w-full">
        <Skeleton className="h-4 w-[min(90%,42rem)] mx-auto rounded-md" />
      </div>
      <span className="sr-only">Loading club information…</span>
    </div>
  );
}

export default HomeSkeleton;
