import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
}
