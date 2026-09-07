import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Allow only POST and DELETE
  if (req.method !== "POST" && req.method !== "DELETE") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST or DELETE." }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // --- Auth: validate Discord bot token ---
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!botToken) {
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

  // --- Parse body ---
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Malformed JSON body." }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // --- Initialize Supabase ---
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ==========================================
  // HANDLE NEW MESSAGES (POST)
  // ==========================================
  if (req.method === "POST") {
    const { content, author, discord_message_id } = body;

    if (!content || !author || !discord_message_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: content, author, discord_message_id." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const newId = `msg_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("news")
      .insert([{ 
        id: newId, 
        content: String(content).trim(), 
        author: String(author).trim(), 
        timestamp,
        discord_message_id: String(discord_message_id)
      }]);

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save announcement.", details: insertError }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "success", id: newId }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // ==========================================
  // HANDLE DELETED MESSAGES (DELETE)
  // ==========================================
  if (req.method === "DELETE") {
    const { discord_message_id } = body;

    if (!discord_message_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: discord_message_id." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { error: deleteError } = await supabase
      .from("news")
      .delete()
      .eq("discord_message_id", String(discord_message_id));

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: "Failed to delete announcement.", details: deleteError }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "deleted" }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});