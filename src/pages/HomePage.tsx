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

// Discord brand mark (lucide-react has no official Discord icon) —
// rendered as an inline SVG so it matches the size/color of the other
// CONNECT icons while keeping the exact Discord silhouette.
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.319 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128c-.598.349-1.22.645-1.873.891a.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .031-.055c.501-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419Z" />
    </svg>
  );
}

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
          if (isMounted) {
            setLoading(false);
          }
        });
    };

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

  if (loading) {
    return <HomeSkeleton />;
  }

  const contactEmail = info?.contact_email;
  const classroomCode = info?.google_classroom_code;
  const classroomUrl = info?.google_classroom_url;
  const instagramHandle = info?.instagram_handle;
  const instagramUrl = info?.instagram_url;
  const visionText = info?.vision || info?.mission;
  const showVision = info ? Boolean(visionText) : true;

  return (
    <div className="flex-1 flex flex-col justify-between gap-[clamp(1rem,2vw,1.75rem)] py-[clamp(0.75rem,2vw,1.25rem)] page-enter">
      {/* Editorial Centered Hero with Bold Scale & Negative Space */}
      <section className="text-center max-w-[var(--fluid-container-max)] mx-auto w-full space-y-[var(--fluid-gap)] pt-[clamp(0.5rem,1vw,1rem)] pb-[clamp(0.25rem,1vw,0.75rem)]">
        {info?.club_name ? (
          <h1 className="text-fluid-hero font-bold tracking-[-0.02em] text-white leading-[0.98] select-none">
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
            className="text-white hover:text-white"
          >
            <MessageSquare className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF]" />
            <span>Ask AI</span>
          </Button>
        </div>
      </section>

      {/* Structured Minimalist Cards Grid */}
      <div className="grid gap-[var(--fluid-gap)] sm:grid-cols-2 flex-1 content-center">
        {/* Schedule column: two separate cards stacked vertically */}
        <div className="flex flex-col gap-[var(--fluid-gap)]">
          {/* Regular Meetings */}
          <Card className="glass-panel flex-1">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF]" />
                <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Schedule</span>
              </div>
              <CardTitle className="text-white font-semibold">Regular Meetings</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center">
              {info?.meeting_times ? (
                <div className="text-white text-fluid-body font-medium">{info.meeting_times}</div>
              ) : (
                <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" aria-label="Loading meeting times" />
              )}
            </CardContent>
          </Card>

          {/* Discord Server */}
          <Card className="glass-panel flex-1">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <DiscordIcon className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF]" />
                <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Discord Server</span>
              </div>
              <CardTitle className="text-white font-semibold">
                Join Our Community
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center">
              {info?.discord_server_name || info?.discord_server_url ? (
                <div className="w-full flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                  <div className="flex items-center gap-2.5 text-[#8E8E93]">
                    <DiscordIcon className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.05em] text-fluid-label">Discord</span>
                  </div>
                  <a
                    href={info?.discord_server_url || "https://discord.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#0A84FF] hover:text-[#64D2FF] hover:underline transition-colors flex items-center gap-1.5 break-all"
                  >
                    <span>{info?.discord_server_name || "Join Server"}</span>
                    <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
                  </a>
                </div>
              ) : (
                <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" aria-label="Loading discord server" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contact & Social Links */}
        <Card className="glass-panel">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF]" />
              <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Connect</span>
            </div>
            <CardTitle className="text-white font-semibold">Get in Touch</CardTitle>
          </CardHeader>
          <CardContent>
            {info ? (
              <div className="space-y-[clamp(0.5rem,2vw,0.625rem)]">
                {/* Email */}
                {contactEmail && (
                  <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                    <div className="flex items-center gap-2.5 text-[#8E8E93]">
                      <Mail className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF] shrink-0" />
                      <span className="font-medium uppercase tracking-[0.05em] text-fluid-label">Email</span>
                    </div>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="font-medium text-[#0A84FF] hover:text-[#64D2FF] hover:underline transition-colors break-all"
                    >
                      {contactEmail}
                    </a>
                  </div>
                )}

                {/* Google Classroom */}
                {(classroomCode || classroomUrl) && (
                  <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                    <div className="flex items-center gap-2.5 text-[#8E8E93]">
                      <GraduationCap className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF] shrink-0" />
                      <span className="font-medium uppercase tracking-[0.05em] text-fluid-label">Classroom</span>
                    </div>
                    <a
                      href={classroomUrl || "https://classroom.google.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#0A84FF] hover:text-[#64D2FF] hover:underline transition-colors flex items-center gap-1.5 break-all"
                    >
                      <span>Code: {classroomCode}</span>
                      <ExternalLink className="h-3 w-3 opacity-70 shrink-0" />
                    </a>
                  </div>
                )}

                {/* Instagram */}
                {(instagramHandle || instagramUrl) && (
                  <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] glass-cell text-fluid-small">
                    <div className="flex items-center gap-2.5 text-[#8E8E93]">
                      <Instagram className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#0A84FF] shrink-0" />
                      <span className="font-medium uppercase tracking-[0.05em] text-fluid-label">Instagram</span>
                    </div>
                    <a
                      href={instagramUrl || "https://instagram.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#0A84FF] hover:text-[#64D2FF] hover:underline transition-colors flex items-center gap-1.5 break-all"
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

      {/* Vision Statement */}
      {showVision && (
        <div className="text-center pt-[clamp(0.25rem,1vw,0.75rem)] pb-[clamp(0.5rem,1.5vw,1rem)] max-w-[var(--fluid-container-narrow)] mx-auto px-[var(--fluid-pad-x)]">
          {visionText ? (
            <p className="text-fluid-body text-[#8E8E93] font-normal leading-relaxed">
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
