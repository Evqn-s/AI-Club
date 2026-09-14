import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, type NewsItem } from "@/lib/supabase";
import {
  prefetchNews,
  getCachedNews,
  fallbackNews,
  setCachedNews,
  invalidateCache,
} from "@/lib/cache";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewsPage() {
  const cached = getCachedNews();
  const [news, setNews] = useState<NewsItem[]>(() => cached || fallbackNews);
  const [loading, setLoading] = useState<boolean>(() => !cached);
  const [error, setError] = useState<string | null>(null);

  async function fetchNews(force = false) {
    if (force) {
      invalidateCache("news");
      setLoading(true);
    }
    setError(null);
    try {
      const data = await prefetchNews();
      setNews(data);
    } catch (err: any) {
      console.error("Failed to load news:", err);
      setError("Unable to connect to announcements database. Showing local offline data.");
      setNews(fallbackNews);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetchNews();

    // State & Mutation Synchronization: Real-time Supabase listener with cleanup
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      channel = supabase
        .channel("realtime-news")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "news" },
          (payload) => {
            if (isMounted && payload.new) {
              setNews((prev) => {
                const next = [payload.new as NewsItem, ...prev];
                setCachedNews(next);
                return next;
              });
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

  return (
    <div className="space-y-[var(--fluid-gap)] py-[var(--fluid-section-y)] max-w-[var(--fluid-container-narrow)] mx-auto px-[var(--fluid-pad-x)]">
      {/* Header */}
      <div className="border-b border-[#242021] pb-[clamp(1rem,4vw,1.5rem)]">
        <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Announcements</span>
        <h1 className="text-fluid-h1 font-extrabold tracking-[-0.03em] font-display text-[#E5E5E7] mt-1">
          Latest News
        </h1>
      </div>

      {/* Explicit Error State Alert if Network Failed */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-[clamp(0.5rem,2vw,0.75rem)] p-[var(--fluid-gap-sm)] rounded-[var(--fluid-radius-lg)] border border-[#5E2C32] bg-[#241416] text-fluid-small text-[#E0A3AA] animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] text-[#E0A3AA] shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchNews(true)} className="shrink-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-[var(--fluid-gap-sm)]">
          <Skeleton className="h-[clamp(6rem,20vw,8rem)] w-full rounded-[var(--fluid-radius-lg)]" />
          <Skeleton className="h-[clamp(6rem,20vw,8rem)] w-full rounded-[var(--fluid-radius-lg)]" />
        </div>
      ) : news.length === 0 ? (
        <Card className="border-[#242021] bg-[#131214]">
          <CardContent className="py-[clamp(2.5rem,10vw,4rem)] text-center text-[#9B98A0]">
            <p className="font-display text-fluid-body font-bold text-[#E5E5E7]">No announcements recorded</p>
            <p className="text-fluid-label uppercase tracking-[0.06em] mt-1.5 text-[#67646C]">New posts will appear automatically here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-[var(--fluid-gap-sm)]">
          {news.map((item) => (
            <Card key={item.id} className="border-[#242021] bg-[#131214] hover:border-[#382D30] transition-colors">
              <CardHeader className="pb-[clamp(0.5rem,2vw,0.75rem)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="default">{item.author}</Badge>
                  <time dateTime={item.timestamp} className="text-fluid-small font-mono text-[#67646C]">
                    {new Date(item.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[#E5E5E7] leading-relaxed text-fluid-body whitespace-pre-wrap font-normal">
                  {item.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
