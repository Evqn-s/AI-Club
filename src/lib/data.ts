// ── Async data layer: dynamic-import target only. ──
// NEVER statically import this file from the initial bundle path.
// It is loaded via import("@/lib/data") on user intent or after paint,
// so the Supabase client + queries never block FCP/LCP.
import { isSupabaseConfigured } from "./supabase";
import type { ClubInfo, NewsItem, CalendarEvent } from "./supabase";
import {
  getCachedHome,
  setCachedHome,
  getCachedNews,
  setCachedNews,
  getCachedCalendar,
  setCachedCalendar,
  fallbackClubInfo,
  fallbackNews,
  fallbackEvents,
} from "./cache";

// In-flight promise tracker (dedups concurrent prefetches)
const inFlight = new Map<string, Promise<unknown>>();

// Keep the Supabase runtime out of the initial bundle; callers can still
// prefetch data on hover or after paint without duplicating client creation.
// Lazy-load the heavy Supabase client only when it is actually needed.
async function getClient() {
  if (!isSupabaseConfigured) return null;
  const { supabase } = await import("./supabaseLazy");
  return supabase;
}

// Background prefetch methods
export async function prefetchHome(): Promise<ClubInfo> {
  const cached = getCachedHome();
  if (cached) return cached;

  if (inFlight.has("home")) {
    return inFlight.get("home") as Promise<ClubInfo>;
  }

  const promise = (async () => {
    try {
      const supabase = await getClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("club_info")
          .select(
            "id,club_name,mission,vision,meeting_times,contact_email,google_classroom_code,google_classroom_url,instagram_handle,instagram_url"
          )
          .single();
        if (error) throw error;
        if (data) {
          setCachedHome(data);
          return data as ClubInfo;
        }
      }
    } catch (e) {
      console.error("Failed to prefetch club info:", e);
      throw e;
    }
    // A failed or unconfigured remote read still resolves with usable content;
    // callers do not need a separate offline data path.
    setCachedHome(fallbackClubInfo);
    return fallbackClubInfo;
  })().finally(() => {
    inFlight.delete("home");
  });

  inFlight.set("home", promise);
  return promise;
}

export async function prefetchNews(): Promise<NewsItem[]> {
  const cached = getCachedNews();
  if (cached) return cached;

  if (inFlight.has("news")) {
    return inFlight.get("news") as Promise<NewsItem[]>;
  }

  const promise = (async () => {
    try {
      const supabase = await getClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("news")
          .select("id,content,author,timestamp")
          .order("timestamp", { ascending: false })
          .limit(20);
        if (error) throw error;
        if (data) {
          setCachedNews(data);
          return data as NewsItem[];
        }
      }
    } catch (e) {
      console.error("Failed to prefetch news:", e);
      throw e;
    }
    setCachedNews(fallbackNews);
    return fallbackNews;
  })().finally(() => {
    inFlight.delete("news");
  });

  inFlight.set("news", promise);
  return promise;
}

export async function prefetchCalendar(): Promise<CalendarEvent[]> {
  const cached = getCachedCalendar();
  if (cached) return cached;

  if (inFlight.has("calendar")) {
    return inFlight.get("calendar") as Promise<CalendarEvent[]>;
  }

  const promise = (async () => {
    try {
      const supabase = await getClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("events")
          .select("id,title,date,time,location,description,category")
          .order("date", { ascending: true })
          .limit(100);
        if (error) throw error;
        if (data) {
          setCachedCalendar(data);
          return data as CalendarEvent[];
        }
      }
    } catch (e) {
      console.error("Failed to prefetch events:", e);
      throw e;
    }
    setCachedCalendar(fallbackEvents);
    return fallbackEvents;
  })().finally(() => {
    inFlight.delete("calendar");
  });

  inFlight.set("calendar", promise);
  return promise;
}

/**
 * Route-based prefetch triggered on hover or focus
 */
export function prefetchRoute(route: string): void {
  const clean = route.toLowerCase().split("?")[0].replace(/\/$/, "") || "/";
  if (clean === "/") {
    void prefetchHome().catch(() => undefined);
  } else if (clean === "/news") {
    void prefetchNews().catch(() => undefined);
  } else if (clean === "/calendar") {
    void prefetchCalendar().catch(() => undefined);
  }
}
