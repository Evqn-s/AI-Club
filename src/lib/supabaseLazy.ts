// Single dynamic-import target for the heavy Supabase runtime.
// Loaded on demand only (data prefetch, realtime subscribe, live search),
// so @supabase/supabase-js never ships in the initial bundle.
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "./supabase";

export { isSupabaseConfigured };

const { url, anonKey } = getSupabaseEnv();

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;