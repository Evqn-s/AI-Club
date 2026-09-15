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
  const prompt = `You are a helpful, concise assistant for the AI Club.
Answer strictly from the club context below. If the answer is unknown, say so.
Do not use em dashes. Keep the answer under 150 words.

Club context:
${JSON.stringify(context, null, 2)}

Conversation:
${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}

Answer:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );
    const result = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!response.ok) return json({ error: result.error?.message || "Gemini request failed" }, 502);

    const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    return answer ? json({ answer }) : json({ error: "Gemini returned no answer" }, 502);
  } catch (error) {
    console.error("Vercel chat handler failed", error);
    return json({ error: "Failed to process chat request" }, 502);
  }
}
