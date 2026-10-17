import { useEffect, useState } from "react";
import { Link } from "wouter";
import { type ClubInfo } from "@/lib/supabase";
import { getCachedHome } from "@/lib/cache";
import { prefetchHome } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HomeSkeleton } from "@/components/HomeSkeleton";
import { Clock, Mail, ArrowRight, GraduationCap, Instagram, ExternalLink, MessageSquare } from "lucide-react";

// Home reads strictly from the Supabase club_info record: skeleton while
// loading, content when it lands. When the database cannot be reached the
// page shell (hero CTAs, section chrome, footer anchors) still renders and
// only the SQL-backed text values show skeleton shimmer — the page never
// shows a "cannot connect" wall.
// No placeholder content is rendered at any point.
// SQL-backed (skeleton when missing): club_name, mission, meeting_times,
// contact_email, google_classroom_*, instagram_*, vision.
// Static (always rendered): section labels, CTA buttons, card chrome.
export function HomePage() {
  const cached = getCachedHome();
  const [info, setInfo] = useState<ClubInfo | null>(() => cached);
  const [loading, setLoading] = useState<boolean>(() => !cached);

  useEffect(() => {
    let isMounted = true;

    const sync = () => {
      prefetchHome()
        .then((data) => {
          if (isMounted) {
            setInfo(data);
            setLoading(false);
          }
        })
        .catch(() => {
          // No database: stay on the page shell with skeleton shimmer in the
          // SQL-backed slots. Never show a "cannot connect" wall.
          if (isMounted) {
            setLoading(false);
          }
        });
    };

    // If we already have warm cache, sync immediately; otherwise defer the
    // network + client load until after first paint so LCP is never blocked.
    if (cached) {
      sync();
    } else {
      const t = setTimeout(sync, 800);
      return () => {
        isMounted = false;
        clearTimeout(t);
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Skeleton while the Supabase record loads — no placeholder text flash,
  // no layout shift when data lands.
  if (loading) {
    return <HomeSkeleton />;
  }

  // No database record: render the full page shell with skeleton shimmer
  // standing in for every SQL-backed value. Static chrome (labels, CTAs,
  // card shells, icons) renders normally — there is no "cannot connect" wall.
  const contactEmail = info?.contact_email;
  const classroomCode = info?.google_classroom_code;
  const classroomUrl = info?.google_classroom_url;
  const instagramHandle = info?.instagram_handle;
  const instagramUrl = info?.instagram_url;
  const visionText = info?.vision || info?.mission;
  // Mission/vision are optional on the record — but without a record the
  // vision slot shows shimmer so the anchor keeps its shape.
  const showVision = info ? Boolean(visionText) : true;

  return (
    <div className="flex-1 flex flex-col justify-between gap-[clamp(1rem,2vw,1.75rem)] py-[clamp(0.75rem,2vw,1.25rem)]">
      {/* Editorial Centered Hero with Bold Scale & Negative Space */}
      <section className="text-center max-w-[var(--fluid-container-max)] mx-auto w-full space-y-[var(--fluid-gap)] pt-[clamp(0.5rem,1vw,1rem)] pb-[clamp(0.25rem,1vw,0.75rem)]">
        {info?.club_name ? (
        <h1 className="text-fluid-hero font-black tracking-[-0.04em] font-display text-[#E5E5E7] leading-[0.95] select-none">
          {info.club_name}
        </h1>
        ) : (
        <Skeleton className="h-[clamp(3rem,10vw,5rem)] w-3/4 mx-auto rounded-2xl" aria-label="Loading club name" />
        )}

        <div className="flex flex-wrap items-center justify-center gap-[clamp(0.5rem,2vw,0.75rem)] pt-[clamp(0.25rem,1.5vw,0.5rem)]">
          <Button
            asChild
            variant="glass"
            size="lg"
          >
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
            className="text-[#E5E5E7] hover:text-[#FFFFFF]"
          >
            <MessageSquare className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" />
            <span>Ask AI</span>
          </Button>
        </div>
      </section>

      {/* Structured Minimalist Cards Grid */}
      <div className="grid gap-[var(--fluid-gap)] sm:grid-cols-2 flex-1 content-center">
        {/* Schedule */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#E0A3AA] mb-1">
              <Clock className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA]" />
              <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Schedule</span>
            </div>
            <CardTitle className="text-[#E5E5E7]">Regular Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-[var(--fluid-gap-sm)] sm:grid-cols-2">
              {/* Regular Meetings */}
              <div className="p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] glass-cell">
                <div className="text-fluid-label font-medium tracking-[0.06em] uppercase text-[#9B98A0] mb-1">Regular Meetings</div>
                {info?.meeting_times ? (
                  <div className="text-[#E5E5E7] text-fluid-body font-medium">{info.meeting_times}</div>
                ) : (
                  <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" aria-label="Loading meeting times" />
                )}
              </div>
              {/* Discord Server */}
              <div className="p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] glass-cell">
                <div className="text-fluid-label font-medium tracking-[0.06em] uppercase text-[#9B98A0] mb-1">Discord Server</div>
                {info?.discord_server_name ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={info.discord_server_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors break-all"
                    >
                      {info.discord_server_name}
                    </a>
                    <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
                  </div>
                ) : (
                  <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" aria-label="Loading discord server" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact & Social Links (Managed directly via Supabase PostgreSQL club_info table) */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#E0A3AA] mb-1">
              <Mail className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA]" />
              <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Connect</span>
            </div>
            <CardTitle className="text-[#E5E5E7]">Get in Touch</CardTitle>
          </CardHeader>
          <CardContent>
            {info ? (
              <div className="space-y-[clamp(0.5rem,2vw,0.625rem)]">
                {/* Email from SQL backend */}
                {contactEmail && (
                <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] glass-cell text-fluid-small">
                  <div className="flex items-center gap-2.5 text-[#9B98A0]">
                    <Mail className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.06em] text-fluid-label">Email</span>
                  </div>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors break-all"
                  >
                    {contactEmail}
                  </a>
                </div>
                )}

                {/* Google Classroom from SQL backend — only when the record has it */}
                {(classroomCode || classroomUrl) && (
                <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] glass-cell text-fluid-small">
                  <div className="flex items-center gap-2.5 text-[#9B98A0]">
                    <GraduationCap className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.06em] text-fluid-label">Classroom</span>
                  </div>
                  <a
                    href={classroomUrl || "https://classroom.google.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors flex items-center gap-1.5 break-all"
                  >
                    <span>Code: {classroomCode}</span>
                    <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
                  </a>
                </div>
                )}

                {/* Instagram from SQL backend — only when the record has it */}
                {(instagramHandle || instagramUrl) && (
                <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] glass-cell text-fluid-small">
                  <div className="flex items-center gap-2.5 text-[#9B98A0]">
                    <Instagram className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.06em] text-fluid-label">Instagram</span>
                  </div>
                  <a
                    href={instagramUrl || "https://instagram.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors flex items-center gap-1.5 break-all"
                  >
                    <span>{instagramHandle}</span>
                    <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
                  </a>
                </div>
                )}
              </div>
            ) : (
              <div className="space-y-[var(--fluid-gap-sm)]" aria-label="Loading contact details">
                <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
                <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
                <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vision Statement — bottom anchor; shimmer when there is no record */}
      {showVision && (
      <div className="text-center pt-[clamp(0.25rem,1vw,0.75rem)] pb-[clamp(0.5rem,1.5vw,1rem)] max-w-[var(--fluid-container-narrow)] mx-auto px-[var(--fluid-pad-x)]">
        {visionText ? (
        <p className="text-fluid-body text-[#9B98A0] font-normal tracking-wide leading-relaxed">
          {visionText}
        </p>
        ) : (
        <div className="space-y-2" aria-label="Loading vision statement">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-2/3 mx-auto rounded-md" />
        </div>
        )}
      </div>
      )}
    </div>
  );
}
