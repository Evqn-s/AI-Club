import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, type CalendarEvent } from "@/lib/supabase";
import {
  prefetchCalendar,
  getCachedCalendar,
  fallbackEvents,
  invalidateCache,
} from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, Clock, MapPin, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

export function CalendarPage() {
  const cached = getCachedCalendar();
  const [events, setEvents] = useState<CalendarEvent[]>(() => cached || fallbackEvents);
  const [loading, setLoading] = useState<boolean>(() => !cached);
  const [error, setError] = useState<string | null>(null);

  async function fetchEvents(force = false) {
    if (force) {
      invalidateCache("calendar");
      setLoading(true);
    }
    setError(null);
    try {
      const data = await prefetchCalendar();
      setEvents(data);
    } catch (err: any) {
      console.error("Failed to load events:", err);
      setError("Unable to connect to events database. Showing local offline schedule.");
      setEvents(fallbackEvents);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetchEvents();

    // State & Mutation Synchronization: Real-time Supabase listener with cleanup
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel("realtime-events")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "events" },
          () => {
            if (isMounted) {
              fetchEvents();
            }
          }
        )
        .subscribe();
    }

    // Memory & Listener Cleanup
    return () => {
      isMounted = false;
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  function generateGoogleCalendarUrl(evt: CalendarEvent) {
    const formattedDate = evt.date.replace(/-/g, "");
    const formattedTime = evt.time.replace(":", "") + "00";
    const startIso = `${formattedDate}T${formattedTime}Z`;
    const endHour = (parseInt(evt.time.split(":")[0], 10) + 1).toString().padStart(2, "0");
    const endMinute = evt.time.split(":")[1] || "00";
    const endIso = `${formattedDate}T${endHour}${endMinute}00Z`;

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: evt.title,
      dates: `${startIso}/${endIso}`,
      details: evt.description,
      location: evt.location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  return (
    <div className="space-y-[var(--fluid-gap)] py-[var(--fluid-section-y)] max-w-[var(--fluid-container-max)] mx-auto px-[var(--fluid-pad-x)]">
      {/* Header */}
      <div className="border-b border-[#242021] pb-4">
        <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Schedule</span>
        <h1 className="text-fluid-h1 font-extrabold tracking-[-0.03em] font-display text-[#E5E5E7] mt-1">
          Club Calendar
        </h1>
      </div>

      {/* Explicit Error State Alert if Network Failed */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[var(--fluid-radius-lg)] border border-[#5E2C32] bg-[#241416] text-fluid-small text-[#E0A3AA] animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA] shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchEvents(true)} className="shrink-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[clamp(10rem,30vw,14rem)] w-full rounded-[var(--fluid-radius-lg)]" />
          <Skeleton className="h-[clamp(10rem,30vw,14rem)] w-full rounded-[var(--fluid-radius-lg)]" />
        </div>
      ) : events.length === 0 ? (
        <Card className="border-[#242021] bg-[#141213]">
          <CardContent className="py-[clamp(2.5rem,10vw,4rem)] text-center text-[#9B98A0]">
            <p className="font-display text-fluid-body font-bold text-[#E5E5E7]">No scheduled events</p>
            <p className="text-fluid-label uppercase tracking-[0.06em] mt-1.5 text-[#67646C]">New workshops and hackathons will be posted soon.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((evt) => (
            <Card key={evt.id} className="border-[#242021] bg-[#141213] flex flex-col justify-between hover:border-[#382D30] transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-[#E5E5E7]">{evt.title}</CardTitle>
                <CardDescription className="flex flex-col gap-2 pt-2 text-[#9B98A0]">
                  <span className="flex flex-wrap items-center gap-2">
                    <CalendarIcon className="h-[clamp(0.75rem,2vw,0.875rem)] w-[clamp(0.75rem,2vw,0.875rem)] text-[#E0A3AA] shrink-0" />
                    <span className="font-mono text-fluid-small">{evt.date}</span>
                    <Clock className="h-[clamp(0.75rem,2vw,0.875rem)] w-[clamp(0.75rem,2vw,0.875rem)] text-[#E0A3AA] shrink-0 ml-2" />
                    <span className="font-mono text-fluid-small">{evt.time}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-[clamp(0.75rem,2vw,0.875rem)] w-[clamp(0.75rem,2vw,0.875rem)] text-[#E0A3AA] shrink-0" />
                    <span className="text-fluid-small">{evt.location}</span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-fluid-body text-[#E5E5E7] leading-relaxed font-normal">{evt.description}</p>
              </CardContent>
              <CardFooter className="pt-2">
                <Button variant="outline" size="sm" asChild className="w-full gap-2">
                  <a
                    href={generateGoogleCalendarUrl(evt)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span>Google Calendar</span>
                    <ExternalLink className="h-3.5 w-3.5 text-[#E0A3AA]" />
                  </a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
