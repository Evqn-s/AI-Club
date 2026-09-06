import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured, type NewsItem } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const fallbackNews: NewsItem[] = [
  {
    id: "msg_1",
    content: "Welcome to the new semester! Join our Discord and check out our upcoming AI workshop series.",
    author: "Admin",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    id: "msg_2",
    content: "Hackathon project groups will be finalized during our next Tuesday session. Bring your project ideas!",
    author: "President",
    timestamp: "2026-09-04T18:30:00Z",
  },
];

export function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchNews() {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: sbError } = await supabase
          .from("news")
          .select("*")
          .order("timestamp", { ascending: false });

        if (sbError) throw sbError;

        if (data) {
          setNews(data.length > 0 ? data : fallbackNews);
          setLoading(false);
          return;
        }
      }

      // Local fallback / demo mode
      setNews(fallbackNews);
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
              setNews((prev) => [payload.new as NewsItem, ...prev]);
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
    <div className="space-y-8 py-12 max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b border-[#242021] pb-6">
        <span className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#9B98A0]">Announcements</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] font-display text-[#E5E5E7] mt-1">
          Latest News
        </h1>
      </div>

      {/* Explicit Error State Alert if Network Failed */}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl border border-[#5E2C32] bg-[#241416] text-xs text-[#E0A3AA] animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-[#E0A3AA] shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchNews} className="h-8 px-3 text-xs shrink-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : news.length === 0 ? (
        <Card className="border-[#242021] bg-[#131214]">
          <CardContent className="py-16 text-center text-[#9B98A0]">
            <p className="font-display text-base font-bold text-[#E5E5E7]">No announcements recorded</p>
            <p className="text-xs uppercase tracking-[0.06em] mt-1.5 text-[#67646C]">New posts will appear automatically here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {news.map((item) => (
            <Card key={item.id} className="border-[#242021] bg-[#131214] hover:border-[#382D30] transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="default">{item.author}</Badge>
                  <time dateTime={item.timestamp} className="text-xs font-mono text-[#67646C]">
                    {new Date(item.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-[#E5E5E7] leading-relaxed text-sm whitespace-pre-wrap font-normal">
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
