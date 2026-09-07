export const config = {
  runtime: "edge",
};

// In-memory sliding-window rate limiter for serverless edge instances
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // Max 20 requests/min per IP

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
  const backendUrl = (
    process.env.BACKEND_URL ||
    process.env.FASTAPI_BACKEND_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  // Health / diagnostic GET route: checks Python FastAPI backend status
  if (req.method === "GET") {
    try {
      const resp = await fetch(`${backendUrl}/health`, { method: "GET" }).catch(() => null);
      if (resp && resp.ok) {
        return new Response(
          JSON.stringify({
            status: "connected",
            backend: "Python FastAPI",
            backendUrl,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          status: "backend_offline",
          message: `FastAPI backend at ${backendUrl} is not currently reachable. Ensure 'python -m backend.main' is running.`,
          backendUrl,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: "Failed to ping Python backend", details: err.message }),
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
    if (!body) {
      return new Response(
        JSON.stringify({ error: "Invalid request: JSON body required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Forward request payload directly to Python FastAPI backend
    const fastApiResp = await fetch(`${backendUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!fastApiResp.ok) {
      const errorText = await fastApiResp.text();
      return new Response(
        JSON.stringify({
          error: `Backend error (${fastApiResp.status}): ${errorText}`,
        }),
        {
          status: fastApiResp.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const fastApiData = await fastApiResp.json();
    const answer = fastApiData.answer || fastApiData.response || "No response received.";

    // Return using AI SDK Data Stream protocol for seamless compatibility with frontend useChat
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(answer)}\n`));
        controller.enqueue(new TextEncoder().encode(`d:{"finishReason":"stop"}\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-vercel-ai-data-stream": "v1",
      },
    });
  } catch (error: any) {
    console.error("Gateway error forwarding to Python backend:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to connect to Python FastAPI backend. Ensure the backend server is running.",
        details: error.message,
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
