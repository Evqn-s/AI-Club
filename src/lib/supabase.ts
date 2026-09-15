// Lightweight module: env flag + shared types ONLY.
// Must never import @supabase/supabase-js — this file is statically imported
// by every page, so it stays in the initial bundle. The heavy client lives in
// supabaseLazy.ts and loads on demand.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseEnv(): { url: string; anonKey: string } {
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

export interface ClubInfo {
  id: string;
  club_name: string;
  mission?: string;
  vision?: string;
  meeting_times: string;
  rules?: string[];
  contact_email: string;
  google_classroom_code?: string;
  google_classroom_url?: string;
  instagram_handle?: string;
  instagram_url?: string;
}

export interface NewsItem {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  category?: string;
}
