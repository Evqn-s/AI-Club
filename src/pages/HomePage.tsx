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
import { Clock, Mail, ArrowRight, GraduationCap, Instagram, ExternalLink } from "lucide-react";

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
    <div className="space-y-16 py-12">
      {/* Editorial Centered Hero with Bold Scale & Negative Space */}
      <section className="text-center max-w-5xl mx-auto space-y-8 pt-6 pb-2">
        <h1 className="text-7xl sm:text-8xl md:text-9xl lg:text-[9.5rem] xl:text-[10.5rem] font-black tracking-[-0.04em] font-display text-[#E5E5E7] leading-[0.95] select-none">
          {info?.club_name || "AI Club"}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button asChild size="lg">
            <Link
              href="/calendar"
              onMouseEnter={() => prefetchRoute("/calendar")}
              onFocus={() => prefetchRoute("/calendar")}
              onTouchStart={() => prefetchRoute("/calendar")}
            >
              <span>View Schedule</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link
              href="/news"
              onMouseEnter={() => prefetchRoute("/news")}
              onFocus={() => prefetchRoute("/news")}
              onTouchStart={() => prefetchRoute("/news")}
            >
              <span>Announcements</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Structured Minimalist Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Schedule */}
        <Card className="border-[#242021] bg-[#141213]">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#E0A3AA] mb-1">
              <Clock className="h-4 w-4 text-[#E0A3AA]" />
              <span className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Schedule</span>
            </div>
            <CardTitle className="text-xl sm:text-2xl text-[#E5E5E7]">Regular Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-6 w-3/4" />
            ) : (
              <div className="p-4 rounded-xl border border-[#242021] bg-[#0A090A] text-[#E5E5E7] text-sm font-medium">
                {info?.meeting_times || "Every Tuesday at 6 PM"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact & Social Links (Managed directly via Supabase PostgreSQL club_info table) */}
        <Card className="border-[#242021] bg-[#141213]">
          <CardHeader>
            <div className="flex items-center gap-2 text-[#E0A3AA] mb-1">
              <Mail className="h-4 w-4 text-[#E0A3AA]" />
              <span className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Connect</span>
            </div>
            <CardTitle className="text-xl sm:text-2xl text-[#E5E5E7]">Get in Touch</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Email from SQL backend */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-[#242021] bg-[#0A090A] text-xs">
                  <div className="flex items-center gap-2.5 text-[#9B98A0]">
                    <Mail className="h-4 w-4 text-[#E0A3AA] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.06em] text-[10px]">Email</span>
                  </div>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors"
                  >
                    {contactEmail}
                  </a>
                </div>

                {/* Google Classroom from SQL backend */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-[#242021] bg-[#0A090A] text-xs">
                  <div className="flex items-center gap-2.5 text-[#9B98A0]">
                    <GraduationCap className="h-4 w-4 text-[#E0A3AA] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.06em] text-[10px]">Classroom</span>
                  </div>
                  <a
                    href={classroomUrl || "https://classroom.google.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors flex items-center gap-1.5"
                  >
                    <span>Code: {classroomCode}</span>
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                </div>

                {/* Instagram from SQL backend */}
                <div className="flex items-center justify-between p-3 rounded-xl border border-[#242021] bg-[#0A090A] text-xs">
                  <div className="flex items-center gap-2.5 text-[#9B98A0]">
                    <Instagram className="h-4 w-4 text-[#E0A3AA] shrink-0" />
                    <span className="font-medium uppercase tracking-[0.06em] text-[10px]">Instagram</span>
                  </div>
                  <a
                    href={instagramUrl || "https://instagram.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[#E0A3AA] hover:text-[#FFFFFF] hover:underline transition-colors flex items-center gap-1.5"
                  >
                    <span>{instagramHandle}</span>
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vision Statement - Small Floating Text (No Widget) */}
      <div className="text-center pt-2 pb-8 max-w-2xl mx-auto px-4">
        <p className="text-xs sm:text-sm text-[#9B98A0] font-normal tracking-wide leading-relaxed">
          {visionText}
        </p>
      </div>
    </div>
  );
}
