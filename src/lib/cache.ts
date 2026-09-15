// ── Sync cache core: zero network deps. Safe to import anywhere. ──
// Fallbacks live here so HomePage renders instantly with zero fetches.
import type { ClubInfo, NewsItem, CalendarEvent } from "./supabase";

export const fallbackClubInfo: ClubInfo = {
  id: "club_main",
  club_name: "AI Club",
  mission: "Empowering students to explore, build, and innovate with artificial intelligence.",
  vision: "Empowering students to explore, build, and innovate with artificial intelligence.",
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
    category: "Meeting",
  },
  {
    id: "evt_2",
    title: "AI Workshop: Neural Networks 101",
    date: "2026-09-22",
    time: "17:30",
    description:
      "Hands-on session building your first neural network from scratch using Python and PyTorch.",
    location: "Engineering Lab B",
    category: "Workshop",
  },
  {
    id: "evt_3",
    title: "Hackathon Prep & Team Formation",
    date: "2026-09-18",
    time: "16:00",
    description:
      "Brainstorming tracks, pitching project ideas, and finding teammates for the fall AI Hackathon.",
    location: "Innovation Hub",
    category: "Hackathon",
  },
  {
    id: "evt_4",
    title: "AI Research Paper Discussion: Diffusion & Transformers",
    date: "2026-09-26",
    time: "15:00",
    description:
      "Interactive reading group breaking down breakthrough architectures in generative modeling.",
    location: "Online (Discord Voice)",
    category: "Research",
  },
  {
    id: "evt_5",
    title: "Industry Speaker: ML Engineering in Production",
    date: "2026-10-02",
    time: "18:30",
    description:
      "Guest tech talk with Q&A on deploying large-scale multimodal models in cloud environments.",
    location: "Auditorium A",
    category: "Speaker",
  },
];

// Module-level in-memory cache and in-flight promise tracker
const cache = new Map<string, { data: unknown; ts: number }>();
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

// Background prefetch methods — lazy wrappers.
// The heavy Supabase client + queries live in ./data and load on demand,
// so static imports of THIS module never inflate the initial bundle.
export async function prefetchHome() {
  const { prefetchHome } = await import("./data");
  return prefetchHome();
}

export async function prefetchNews() {
  const { prefetchNews } = await import("./data");
  return prefetchNews();
}

export async function prefetchCalendar() {
  const { prefetchCalendar } = await import("./data");
  return prefetchCalendar();
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
