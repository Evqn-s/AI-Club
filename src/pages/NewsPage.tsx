import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, type NewsItem } from "@/lib/supabase";
import {
  getCachedNews,
  setCachedNews,
  invalidateCache,
} from "@/lib/cache";
import { prefetchNews } from "@/lib/data";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewsSkeleton } from "@/components/NewsSkeleton";
import { AlertCircle, RefreshCw, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

export function NewsPage() {
  const cached = getCachedNews();
  const [news, setNews] = useState<NewsItem[]>(() => cached ?? []);
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
    } catch (err: unknown) {
      console.error("Failed to load news:", err);
      setError("Unable to connect to announcements database.");
      setNews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetchNews();

    let channel: RealtimeChannel | null = null;
    let supabaseClient: SupabaseClient | null = null;
    if (isSupabaseConfigured) {
      import("@/lib/supabaseLazy").then(({ supabase }) => {
        if (!isMounted || !supabase) return;
        supabaseClient = supabase;
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
      });
    }

    return () => {
      isMounted = false;
      if (channel && supabaseClient) {
        supabaseClient.removeChannel(channel);
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
      <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-fluid-label font-medium tracking-[0.05em] uppercase text-[#8E8E93]">Announcements</span>
          <h1 className="text-fluid-h1 font-bold tracking-[-0.02em] text-white mt-1">
            Latest News
          </h1>
        </div>

        {/* Sort Toggle Button with Animation */}
        <button
          onClick={() => setSortNewest((v) => !v)}
          aria-label={`Sort announcements: currently ${sortNewest ? "newest first" : "oldest first"}`}
          className="self-start sm:self-auto flex items-center gap-1.5 min-h-[44px] px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.05em] rounded-full transition-all text-white glass-button active:scale-95 cursor-pointer"
        >
          <ArrowUpDown className="h-3.5 w-3.5 text-[#FF3B30]" />
          <span>{sortNewest ? "Newest first" : "Oldest first"}</span>
        </button>
      </div>

      {/* Explicit Error State Alert if Network Failed */}
      {error && (
        <div role="alert" className="status-error flex flex-wrap items-center justify-between gap-2 p-3 rounded-[var(--fluid-radius-lg)] border text-fluid-small animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-[clamp(0.875rem,2vw,1rem)] w-[clamp(0.875rem,2vw,1rem)] status-error-icon shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchNews(true)} className="shrink-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {loading ? (
        <NewsSkeleton count={3} />
      ) : sortedNews.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-[clamp(2.5rem,10vw,4rem)] text-center text-[#8E8E93]">
            <p className="text-fluid-body font-semibold text-white">No announcements recorded</p>
            <p className="text-fluid-label uppercase tracking-[0.05em] mt-1.5 text-[#8E8E93]">New posts will appear automatically here.</p>
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
                      <time dateTime={item.timestamp} className="text-fluid-small font-medium text-[#8E8E93]">
                        {new Date(item.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-white leading-relaxed text-fluid-body font-normal">
                      <ReactMarkdown
                        remarkPlugins={[remarkBreaks]}
                        components={{
                          h1: ({ node, ...props }) => (
                            <h1 className="text-fluid-h2 font-semibold text-white mt-4 mb-2 first:mt-0 tracking-tight" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="text-fluid-h3 font-semibold text-white mt-3 mb-2 first:mt-0 tracking-tight" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="text-lg font-semibold text-white mt-3 mb-1 first:mt-0 tracking-tight" {...props} />
                          ),
                          p: ({ node, ...props }) => (
                            <p className="mb-3 last:mb-0" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong className="font-semibold text-white" {...props} />
                          ),
                          em: ({ node, ...props }) => (
                            <em className="italic" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />
                          ),
                          a: ({ node, ...props }) => (
                            <a className="text-[#FF3B30] hover:text-[#FF6961] hover:underline transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
                          ),
                        }}
                      >
                        {item.content}
                      </ReactMarkdown>
                    </div>
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
