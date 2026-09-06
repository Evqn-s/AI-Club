// supabase/functions/discord-sync/index.ts
//
// Supabase Edge Function (Deno runtime)
// Receives messages from a Discord bot and writes them to the Supabase "news" table.
//
// SETUP:
//   1. Deploy:  supabase functions deploy discord-sync
//   2. Set secrets in Supabase dashboard (Settings → Edge Functions → Secrets):
//        DISCORD_BOT_TOKEN  — paste your Discord bot token here when ready
//   3. Point your bot to POST:
//        https://<project-ref>.supabase.co/functions/v1/discord-sync
//        Authorization: <DISCORD_BOT_TOKEN>
//        Content-Type: application/json
//        Body: { "content": "announcement text", "author": "username" }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // --- Auth: validate Discord bot token ---
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
    console.error("DISCORD_BOT_TOKEN secret is not set in Supabase Edge Function secrets.");
    return new Response(
      JSON.stringify({ error: "Server not configured: DISCORD_BOT_TOKEN missing." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== botToken) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: invalid or missing bot token." }),
      { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // --- Parse + validate body ---
  let body: { content?: unknown; author?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed JSON body." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const { content, author } = body ?? {};

  if (typeof content !== "string" || typeof author !== "string") {
    return new Response(
      JSON.stringify({ error: "Both 'content' and 'author' must be non-empty strings." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const cleanContent = content.trim();
  const cleanAuthor = author.trim();

  if (!cleanContent || !cleanAuthor) {
    return new Response(
      JSON.stringify({ error: "'content' and 'author' cannot be blank." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (cleanContent.length > 4000 || cleanAuthor.length > 100) {
    return new Response(
      JSON.stringify({ error: "Payload too large: content max 4000 chars, author max 100 chars." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // --- Write to Supabase PostgreSQL ---
  // These env vars are automatically injected by Supabase — no setup needed.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey);

  const newId = `msg_${Date.now()}`;
  const timestamp = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("news")
    .insert([{ id: newId, content: cleanContent, author: cleanAuthor, timestamp }]);

  if (insertError) {
    console.error("Supabase insert failed:", insertError);
    return new Response(
      JSON.stringify({ error: "Failed to save announcement to database." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  console.log(`Discord sync: inserted news row ${newId} from author "${cleanAuthor}"`);
  return new Response(
    JSON.stringify({ status: "success", id: newId }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
