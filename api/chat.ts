import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

// In-memory sliding-window rate limiter for serverless edge instances
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // Max 15 requests/min per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  record.count += 1;
  return false;
}

export default async function handler(req: Request) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  // Diagnostic GET route: lets you visit /api/chat in the browser to test the key and see all available models
  if (req.method === "GET") {
    let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    let keySource = apiKey ? "process.env" : "none";
    let customModel = "gemini-2.5-flash";

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const [secretRes, modelRes] = await Promise.all([
          supabase.from("app_secrets").select("value").eq("key", "GOOGLE_GENERATIVE_AI_API_KEY").single(),
          supabase.from("app_secrets").select("value").eq("key", "GEMINI_MODEL").single(),
        ]);
        if (secretRes.data?.value && secretRes.data.value.trim() !== "") {
          apiKey = secretRes.data.value.trim();
          keySource = "supabase.app_secrets";
        }
        if (modelRes.data?.value && modelRes.data.value.trim() !== "") {
          customModel = modelRes.data.value.trim();
        }
      } catch (dbErr: any) {
        return new Response(
          JSON.stringify({ error: "Failed connecting to Supabase", details: dbErr.message }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          status: "missing_key",
          message: "No Google Generative AI API key found in Supabase 'app_secrets' or environment variables.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const googleResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      const data = await googleResp.json();

      if (!googleResp.ok) {
        return new Response(
          JSON.stringify({
            status: "google_api_error",
            httpStatus: googleResp.status,
            keySource,
            error: data,
          }, null, 2),
          { status: googleResp.status, headers: { "Content-Type": "application/json" } }
        );
      }

      const availableModels = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => m.name.replace("models/", ""));

      return new Response(
        JSON.stringify({
          status: "connected",
          keySource,
          configuredModel: customModel,
          availableModels,
        }, null, 2),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ status: "fetch_error", error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting check
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment before sending another message." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      }
    );
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: 'messages' must be a non-empty array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Input sanitization: Slice to last 10 messages and truncate long inputs (cost & abuse control)
    const sanitizedMessages = body.messages.slice(-10).map((m: any) => {
      const content = typeof m.content === "string" ? m.content.slice(0, 1000) : "";
      const role = m.role === "user" || m.role === "assistant" || m.role === "system" ? m.role : "user";
      return { role, content };
    });

    let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    let selectedModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    let clubContext = {
      club_info: {
        club_name: "AI Club",
        meeting_times: "Every Tuesday at 6 PM",
        contact_email: "contact.aiclub@gmail.com",
        google_classroom_code: "aiclub2026",
        instagram_handle: "@aiclub.official",
      },
      news: [
        {
          content: "Welcome to the new semester! Join our Discord and check out our upcoming AI workshop series.",
          author: "Admin",
          timestamp: "2026-09-01T12:00:00Z",
        },
      ],
      calendar: [
        {
          title: "General Meeting",
          date: "2026-09-15",
          time: "18:00",
          location: "Room 101",
          description: "Monthly general assembly to discuss upcoming hackathons and workshop sessions.",
        },
      ],
    };

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const [infoRes, newsRes, eventsRes, secretRes, modelRes] = await Promise.all([
          supabase.from("club_info").select("*").single(),
          supabase.from("news").select("*").order("timestamp", { ascending: false }).limit(5),
          supabase.from("events").select("*").order("date", { ascending: true }).limit(5),
          supabase.from("app_secrets").select("value").eq("key", "GOOGLE_GENERATIVE_AI_API_KEY").single(),
          supabase.from("app_secrets").select("value").eq("key", "GEMINI_MODEL").single(),
        ]);

        if (infoRes.data) clubContext.club_info = infoRes.data;
        if (newsRes.data && newsRes.data.length > 0) clubContext.news = newsRes.data;
        if (eventsRes.data && eventsRes.data.length > 0) clubContext.calendar = eventsRes.data;

        // If the API key exists in Supabase app_secrets table, prioritize it!
        if (secretRes.data?.value && secretRes.data.value.trim() !== "") {
          apiKey = secretRes.data.value.trim();
        }

        // If a model is specified in Supabase app_secrets table (key: 'GEMINI_MODEL'), prioritize it
        if (modelRes.data?.value && modelRes.data.value.trim() !== "") {
          selectedModel = modelRes.data.value.trim();
        }
      } catch (dbError) {
        console.error("Failed to query context from Supabase:", dbError);
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "Gemini API key is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY in the Supabase 'app_secrets' table or in Vercel environment variables.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const model = google(selectedModel);

    const result = streamText({
      model,
      messages: sanitizedMessages,
      maxTokens: 2048,
      temperature: 0.7,
      topP: 1,
      system: `You are a helpful, concise assistant for the AI Club.
Answer user questions accurately using the club context below.
If asked follow-up questions, reference the conversation history.

Rules:
- Do not use em dashes (—); use commas, colons, or periods instead.
- If you don't know the answer or it's not in the context, say you don't have that information.
- Be friendly, clear, and direct. Keep answers under 150 words.

Club Context Data:
${JSON.stringify(clubContext, null, 2)}`,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("AI Chat handler exception:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request. Please try again shortly." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
