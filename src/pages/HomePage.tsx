import { useEffect, useState } from "react";
import { Link } from "wouter";
import { type ClubInfo } from "@/lib/supabase";
import {
  prefetchHome,
  getCachedHome,
  fallbackClubInfo,
  prefetchRoute,
} from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Mail, ArrowRight, GraduationCap, Instagram, ExternalLink, MessageSquare } from "lucide-react";

export function HomePage() {
  const cached = getCachedHome();
  const [info, setInfo] = useState<ClubInfo>(() => cached || fallbackClubInfo);
  const [loading, setLoading] = useState<boolean>(() => !cached);

  useEffect(() => {
    let isMounted = true;

    prefetchHome().then((data) => {
      if (isMounted) {
        setInfo(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const contactEmail = info?.contact_email || fallbackClubInfo.contact_email;
  const classroomCode = info?.google_classroom_code || fallbackClubInfo.google_classroom_code;
  const classroomUrl = info?.google_classroom_url || fallbackClubInfo.google_classroom_url;
  const instagramHandle = info?.instagram_handle || fallbackClubInfo.instagram_handle;
  const instagramUrl = info?.instagram_url || fallbackClubInfo.instagram_url;
  const visionText =
    info?.vision ||
    info?.mission ||
    fallbackClubInfo.vision ||
    "Empowering students to explore, build, and innovate with artificial intelligence.";

  return (
    <div className="space-y-[var(--fluid-stack)] py-[var(--fluid-section-y)]">
      {/* Editorial Centered Hero with Bold Scale & Negative Space */}
      <section className="text-center max-w-[var(--fluid-container-max)] mx-auto space-y-[var(--fluid-gap)] pt-[clamp(0.75rem,3vw,1.5rem)] pb-[clamp(0.25rem,1vw,0.5rem)]">
        <h1 className="text-fluid-hero font-black tracking-[-0.04em] font-display text-[#E5E5E7] leading-[0.95] select-none">
          {info?.club_name || "AI Club"}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-[clamp(0.5rem,2vw,0.75rem)] pt-[clamp(0.25rem,1.5vw,0.5rem)]">
          <Button asChild size="lg">
            <Link
              href="/calendar"
              onMouseEnter={() => prefetchRoute("/calendar")}
              onFocus={() => prefetchRoute("/calendar")}
              onTouchStart={() => prefetchRoute("/calendar")}
            >
              <span>View Schedule</span>
              <ArrowRight className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] ml-1.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("aiclub:open-chat"))}
          >
            <MessageSquare className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)]" />
            <span>Ask AI</span>
          </Button>
        </div>
      </section>

      {/* Structured Minimalist Cards Grid */}
      <div className="grid gap-[var(--fluid-gap)] sm:grid-cols-2">
        {/* Schedule */}
        <Card className="border-[#242021] bg-[#141213]">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#E0A3AA] mb-1">
              <Clock className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA]" />
              <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Schedule</span>
            </div>
            <CardTitle className="text-[#E5E5E7]">Regular Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[clamp(1.25rem,4vw,1.5rem)] w-3/4 rounded-[var(--fluid-radius)]" />
            ) : (
              <div className="p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] bg-[#0A090A] text-[#E5E5E7] text-fluid-body font-medium">
                {info?.meeting_times || "Every Tuesday at 6 PM"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact & Social Links (Managed directly via Supabase PostgreSQL club_info table) */}
        <Card className="border-[#242021] bg-[#141213]">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#E0A3AA] mb-1">
              <Mail className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA]" />
              <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Connect</span>
            </div>
            <CardTitle className="text-[#E5E5E7]">Get in Touch</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-[var(--fluid-gap-sm)]">
                <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
                <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
                <Skeleton className="h-[var(--fluid-control-h)] w-full rounded-[var(--fluid-radius)]" />
              </div>
            ) : (
              <div className="space-y-[clamp(0.5rem,2vw,0.625rem)]">
                {/* Email from SQL backend */}
                <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] bg-[#0A090A] text-fluid-small">
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

                {/* Google Classroom from SQL backend */}
                <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] bg-[#0A090A] text-fluid-small">
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

                {/* Instagram from SQL backend */}
                <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius)] border border-[#242021] bg-[#0A090A] text-fluid-small">
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vision Statement - Small Floating Text (No Widget) */}
      <div className="text-center pt-[clamp(0.5rem,2vw,0.5rem)] pb-[clamp(1rem,4vw,2rem)] max-w-[var(--fluid-container-narrow)] mx-auto px-[var(--fluid-pad-x)]">
        <p className="text-fluid-body text-[#9B98A0] font-normal tracking-wide leading-relaxed">
          {visionText}
        </p>
      </div>
    </div>
  );
}
