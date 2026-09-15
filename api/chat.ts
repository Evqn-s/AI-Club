import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatRequest = {
  query?: unknown;
  history?: unknown;
  messages?: unknown;
};

const MODEL = "gemini-3.1-flash-lite";
const MAX_HISTORY = 8;
const MAX_MESSAGE_LENGTH = 1000;

const fallbackContext = {
  club_info: {
    club_name: "AI Club",
    meeting_times: "Every Tuesday at 6 PM",
    contact_email: "contact.aiclub@gmail.com",
    google_classroom_code: "aiclub2026",
    instagram_handle: "@aiclub.official",
  },
  news: [],
  calendar: [],
  info: [],
};

export const config = { runtime: "edge" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeMessages(body: ChatRequest): ChatMessage[] {
  const source = Array.isArray(body.messages)
    ? body.messages
    : [
        ...(Array.isArray(body.history) ? body.history : []),
        { role: "user", content: body.query },
      ];

  return source
    .slice(-MAX_HISTORY)
    .map((message) => {
      const item = message as { role?: unknown; content?: unknown };
      const role: ChatMessage["role"] =
        item.role === "assistant" || item.role === "system" ? item.role : "user";
      return {
        role,
        content: typeof item.content === "string" ? item.content.slice(0, MAX_MESSAGE_LENGTH) : "",
      };
    })
    .filter((message) => message.content.trim().length > 0);
}

async function fetchSupabaseContext(): Promise<Record<string, unknown>> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return fallbackContext;

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const request = async (table: string, query: string) => {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?${query}`, { headers });
    if (!response.ok) throw new Error(`Supabase ${table} request failed`);
    return response.json();
  };

  try {
    const [clubInfo, news, calendar, info] = await Promise.all([
      request("club_info", "id=eq.club_main&limit=1"),
      request("news", "select=*&order=timestamp.desc&limit=5"),
      request("events", "select=*&order=date.asc&limit=5"),
      request("info", "select=title,description&order=title.asc&limit=25"),
    ]);
    return {
      club_info: clubInfo[0] || fallbackContext.club_info,
      news: news || [],
      calendar: calendar || [],
      info: info || [],
    };
  } catch (error) {
    console.warn("Supabase context unavailable; using fallback context", error);
    return fallbackContext;
  }
}

async function getApiKey(): Promise<string> {
  const directKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (directKey) return directKey;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return "";

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/app_secrets?key=eq.GOOGLE_GENERATIVE_AI_API_KEY&select=value&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!response.ok) return "";
    const rows = (await response.json()) as Array<{ value?: string }>;
    return rows[0]?.value?.trim() || "";
  } catch {
    return "";
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messages = normalizeMessages(body);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return json({ error: "A non-empty user query is required" }, 400);
  }

  const apiKey = await getApiKey();
  if (!apiKey) return json({ error: "Gemini API key is not configured" }, 503);

  const context = await fetchSupabaseContext();
  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const result = streamText({
      model: google(MODEL),
      messages,
      maxTokens: 1024,
      temperature: 0.1,
      topP: 1,
      system: `You are a helpful, concise assistant for the AI Club.
Answer the user query strictly using the Club Context Data below.
If asked follow-up questions, use the conversation history.

Rules:
1. Do not use em dashes; use commas, colons, or periods instead.
2. If the answer is not in context, say you don't have that information.
3. Be friendly, clear, and direct. Keep answers under 150 words.

Club Context Data:
${JSON.stringify(context, null, 2)}`,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Vercel chat handler failed", error);
    return json({ error: "Failed to process chat request" }, 502);
  }
}
