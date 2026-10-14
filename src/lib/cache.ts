// ── Sync cache core: zero network deps. Safe to import anywhere. ──
// Fallbacks live here so HomePage renders instantly with zero fetches.
import type { ClubInfo, NewsItem, CalendarEvent } from "./supabase";

// No placeholder rows: every page reads strictly from Supabase and renders
// its skeleton while loading, then the empty/error state when there is no
// data. Nothing here fabricates club_info, news, or events content.

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
