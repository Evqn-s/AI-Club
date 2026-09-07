import {
  supabase,
  isSupabaseConfigured,
  type ClubInfo,
  type NewsItem,
  type CalendarEvent,
} from "./supabase";

export const fallbackClubInfo: ClubInfo = {
  id: "club_main",
  club_name: "AI Club",
  mission: "",
  meeting_times: "Every Tuesday at 6 PM",
  rules: [],
  contact_email: "contact.aiclub@gmail.com",
  google_classroom_code: "aiclub2026",
  google_classroom_url: "https://classroom.google.com",
  instagram_handle: "@aiclub.official",
  instagram_url: "https://instagram.com/aiclub.official",
};

export const fallbackNews: NewsItem[] = [
  {
    id: "msg_1",
    content:
      "Welcome to the new semester! Join our Discord and check out our upcoming AI workshop series.",
    author: "Admin",
    timestamp: "2026-09-01T12:00:00Z",
  },
  {
    id: "msg_2",
    content:
      "Hackathon project groups will be finalized during our next Tuesday session. Bring your project ideas!",
    author: "President",
    timestamp: "2026-09-04T18:30:00Z",
  },
];

export const fallbackEvents: CalendarEvent[] = [
  {
    id: "evt_1",
    title: "General Meeting",
    date: "2026-09-15",
    time: "18:00",
    description:
      "Monthly general assembly to discuss upcoming hackathons and workshop sessions.",
    location: "Room 101",
  },
  {
    id: "evt_2",
    title: "AI Workshop: Neural Networks 101",
    date: "2026-09-22",
    time: "17:30",
    description:
      "Hands-on session building your first neural network from scratch using Python and PyTorch.",
    location: "Engineering Lab B",
  },
];

// Module-level in-memory cache and in-flight promise tracker
const cache = new Map<string, { data: unknown; ts: number }>();
const inFlight = new Map<string, Promise<unknown>>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) return null;
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

// Specialized accessors
export function getCachedHome(): ClubInfo | null {
  return getCached<ClubInfo>("home");
}

export function setCachedHome(data: ClubInfo): void {
  setCached("home", data);
}

export function getCachedNews(): NewsItem[] | null {
  return getCached<NewsItem[]>("news");
}

export function setCachedNews(data: NewsItem[]): void {
  setCached("news", data);
}

export function getCachedCalendar(): CalendarEvent[] | null {
  return getCached<CalendarEvent[]>("calendar");
}

export function setCachedCalendar(data: CalendarEvent[]): void {
  setCached("calendar", data);
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("club_info")
          .select("*")
          .single();
        if (!error && data) {
          setCachedHome(data);
          return data as ClubInfo;
        }
      }
    } catch (e) {
      console.error("Failed to prefetch club info:", e);
    }
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("news")
          .select("*")
          .order("timestamp", { ascending: false });
        if (!error && data && data.length > 0) {
          setCachedNews(data);
          return data as NewsItem[];
        }
      }
    } catch (e) {
      console.error("Failed to prefetch news:", e);
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
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .order("date", { ascending: true });
        if (!error && data && data.length > 0) {
          setCachedCalendar(data);
          return data as CalendarEvent[];
        }
      }
    } catch (e) {
      console.error("Failed to prefetch events:", e);
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
    prefetchHome();
  } else if (clean === "/news") {
    prefetchNews();
  } else if (clean === "/calendar") {
    prefetchCalendar();
  }
}
