import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, type CalendarEvent } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, Clock, MapPin, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";

const fallbackEvents: CalendarEvent[] = [
  {
    id: "evt_1",
    title: "General Meeting",
    date: "2026-09-15",
    time: "18:00",
    description: "Monthly general assembly to discuss upcoming hackathons and workshop sessions.",
    location: "Room 101",
  },
  {
    id: "evt_2",
    title: "AI Workshop: Neural Networks 101",
    date: "2026-09-22",
    time: "17:30",
    description: "Hands-on session building your first neural network from scratch using Python and PyTorch.",
    location: "Engineering Lab B",
  },
];

export function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchEvents() {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: sbError } = await supabase
          .from("events")
          .select("*")
          .order("date", { ascending: true });

        if (sbError) throw sbError;

        if (data) {
          setEvents(data.length > 0 ? data : fallbackEvents);
          setLoading(false);
          return;
        }
      }

      // Local fallback / demo mode
      setEvents(fallbackEvents);
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
    <div className="space-y-8 py-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#242021] pb-6">
        <span className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Schedule</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] font-display text-[#E5E5E7] mt-1">
          Club Calendar
        </h1>
      </div>

      {/* Explicit Error State Alert if Network Failed */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-[#5E2C32] bg-[#241416] text-xs text-[#E0A3AA] animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-[#E0A3AA] shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEvents} className="h-8 px-3 text-xs shrink-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      ) : events.length === 0 ? (
        <Card className="border-[#242021] bg-[#141213]">
          <CardContent className="py-16 text-center text-[#9B98A0]">
            <p className="font-display text-base font-bold text-[#E5E5E7]">No scheduled events</p>
            <p className="text-xs uppercase tracking-[0.06em] mt-1.5 text-[#67646C]">New workshops and hackathons will be posted soon.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {events.map((evt) => (
            <Card key={evt.id} className="border-[#242021] bg-[#141213] flex flex-col justify-between hover:border-[#382D30] transition-colors">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold text-[#E5E5E7]">{evt.title}</CardTitle>
                <CardDescription className="flex flex-col gap-2 pt-2 text-[#9B98A0]">
                  <span className="flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#E0A3AA] shrink-0" />
                    <span className="font-mono text-xs">{evt.date}</span>
                    <Clock className="h-3.5 w-3.5 text-[#E0A3AA] shrink-0 ml-2" />
                    <span className="font-mono text-xs">{evt.time}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-[#E0A3AA] shrink-0" />
                    <span className="text-xs">{evt.location}</span>
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#E5E5E7] leading-relaxed font-normal">{evt.description}</p>
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
