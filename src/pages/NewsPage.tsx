import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { AlertCircle, RefreshCw, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewsPage() {
  const cached = getCachedNews();
  const [news, setNews] = useState<NewsItem[]>(() => cached || fallbackNews);
  const [loading, setLoading] = useState<boolean>(() => !cached);
  const [error, setError] = useState<string | null>(null);
  const [sortNewest, setSortNewest] = useState<boolean>(true);

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

  const sortedNews = useMemo(() => {
    return [...news].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortNewest ? tb - ta : ta - tb;
    });
  }, [news, sortNewest]);

  return (
    <div className="w-full max-w-[var(--fluid-container-narrow)] mx-auto px-[var(--fluid-pad-x)] py-4 sm:py-6 space-y-[var(--fluid-gap)]">
      {/* Header */}
      <div className="border-b border-[#242021] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-fluid-label font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Announcements</span>
          <h1 className="text-fluid-h1 font-extrabold tracking-[-0.03em] font-display text-[#E5E5E7] mt-1">
            Latest News
          </h1>
        </div>

        {/* Sort Toggle Button with Animation */}
        <button
          onClick={() => setSortNewest((v) => !v)}
          aria-label={`Sort announcements: currently ${sortNewest ? "newest first" : "oldest first"}`}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider rounded-full transition-all text-[#9B98A0] hover:text-[#FFFFFF] glass-button active:scale-95 cursor-pointer"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-[#E0A3AA]" />
          <span>{sortNewest ? "Newest first" : "Oldest first"}</span>
        </button>
      </div>

      {/* Explicit Error State Alert if Network Failed */}
      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[var(--fluid-radius-lg)] border border-[#5E2C32] bg-[#241416] text-fluid-small text-[#E0A3AA] animate-in fade-in duration-150">
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
        <div className="space-y-3">
          <Skeleton className="h-[clamp(6rem,20vw,8rem)] w-full rounded-[var(--fluid-radius-lg)]" />
          <Skeleton className="h-[clamp(6rem,20vw,8rem)] w-full rounded-[var(--fluid-radius-lg)]" />
        </div>
      ) : sortedNews.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-[clamp(2.5rem,10vw,4rem)] text-center text-[#9B98A0]">
            <p className="font-display text-fluid-body font-bold text-[#E5E5E7]">No announcements recorded</p>
            <p className="text-fluid-label uppercase tracking-[0.06em] mt-1.5 text-[#67646C]">New posts will appear automatically here.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div layout className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedNews.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  layout: { type: "spring", stiffness: 320, damping: 28 },
                  opacity: { duration: 0.2 },
                }}
              >
                <Card className="glass-panel glass-panel-hover transition-all">
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
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
