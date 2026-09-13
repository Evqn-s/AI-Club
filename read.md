# AI Club Website — read.md

> **Welcome!** This is the friendly field guide to the AI Club Website codebase.
> Whether you are a new developer joining the club, or an AI assistant getting
> up to speed, read this file top to bottom once and you will know where
> everything lives, what each file actually does, and how the pieces talk to
> each other.

## Contents

1. [Overview — what this project is](#1-overview--what-this-project-is)
2. [Repository root — mission control](#2-repository-root--mission-control)
3. [`src/` — app shell and startup](#3-src--app-shell-and-startup)
4. [`src/pages/` — Home, News, and Calendar](#4-srcpages--home-news-and-calendar)
5. [`src/components/` — navbar, theme, chat, and ambience](#5-srccomponents--navbar-theme-chat-and-ambience)
6. [`src/components/ui/` — the design system](#6-srccomponentsui--the-design-system)
7. [`src/lib/` — data layer and helpers](#7-srclib--data-layer-and-helpers)
8. [`api/` — the Vercel chat function](#8-api--the-vercel-chat-function)
9. [`backend/` — the Python FastAPI service](#9-backend--the-python-fastapi-service)
10. [`supabase/` — database and bot sync](#10-supabase--database-and-bot-sync)
11. [`club-discord-bot/` — the Discord publisher](#11-club-discord-bot--the-discord-publisher)
12. [How it all fits together](#12-how-it-all-fits-together)
13. [Environment variables cheat sheet](#13-environment-variables-cheat-sheet)

---

## 1. Overview — what this project is

The **AI Club Website** is the official web home of a student AI club. It has
three jobs: **show off the club** (who we are, when and where we meet, how to
join), **publish fresh updates** (announcements and an event calendar that
appear live with no page refresh), and **answer visitor questions** through a
floating AI chatbot that grounds every reply in the club's real data.

Under the hood it is a three-layer system, and every layer is built to degrade
gracefully so the site never looks broken:

- **Layer 1 — the website itself** (`src/`). A React 19 + TypeScript +
  Vite single-page app styled with Tailwind CSS v4. It reads club content
  straight from a Supabase Postgres database, keeps it in a small in-memory
  cache, and subscribes to Supabase Realtime so new announcements and events
  pop onto the screen instantly. If the database is unreachable, each page
  quietly falls back to built-in sample content.
- **Layer 2 — the chatbot brain on Vercel** (`api/chat.ts`). A serverless
  Edge Function behind `POST /api/chat`. It rate-limits callers, gathers
  fresh club context (club info, latest news, upcoming events) from Supabase,
  and streams an answer from Google Gemini using the Vercel AI SDK. If a
  self-hosted Python backend is configured, it forwards the chat there first
  and only runs Gemini itself as a fallback.
- **Layer 3 — the optional Python backend** (`backend/`). A FastAPI service
  offering the same chat endpoint plus plain data endpoints and a
  Discord webhook, backed by Supabase with a local SQLite file as backup.
- **The publishing pipeline** (`supabase/functions/discord-sync` plus
  `club-discord-bot/`). A Discord bot posts announcements into the `news`
  table, and every open browser updates live through Realtime.

Deployment is GitHub (source of truth) → Vercel (static site + chat
function) + Supabase (database, realtime, bot sync), exactly as described in
`DEPLOYMENT_GUIDE.md`.

## 2. Repository root — mission control

**Section overview.** The repo root is the project's wiring closet: the files here never render a single pixel, but they decide *how* the app is built (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`), *how* it is deployed (`vercel.json`), *what secrets* it needs (`.env` / `.env.example`), and *what guardrails* keep it clean (ESLint, `.gitignore`). Every other section plugs into something defined here.

### File breakdown

- **`index.html`** — The single HTML entry point that Vite starts from. It loads the Google Fonts (Inter, Plus Jakarta Sans), sets the page title and meta description, paints the background dark *before* the app boots (so there is never a white flash), and provides the `<div id="root">` that `/src/main.tsx` attaches to. At build time Vite rewrites these references to the hashed bundle files and emits the result as `dist/index.html`. Want to change the site's `<title>` or fonts? This is the front door.
- **`package.json`** — The npm manifest and source of truth for the toolchain. It defines the scripts — `dev` (Vite dev server), `build` (`tsc -b` type-check then `vite build`), `preview`, `lint` (ESLint), `format` (Prettier) — and every dependency, which fall into four families: the **React frontend** (`react`, `react-dom`, `wouter` routing, `lucide-react` icons), the **chat bot** (`ai`, `@ai-sdk/react` for the widget, `@ai-sdk/google` for the Edge Function), the **data layer** (`@supabase/supabase-js`), and the **design system** (`clsx`, `class-variance-authority`, `tailwind-merge`, Radix UI). The dev dependencies (Vite 6, Tailwind v4 plugin, TypeScript, ESLint, Prettier) power the build pipeline.
- **`package-lock.json`** — The receipt from `npm install`. It pins the exact version of every package (and all transitive dependencies) so any machine — including Vercel — installs an identical tree. Never hand-edit; npm regenerates it.
- **`vite.config.ts`** — The Vite dev-server and build configuration. It registers the path alias `@` → `src/` (so imports like `@/components/ui/button` work everywhere) and, crucially for local development, a proxy that forwards every request to `/api/*` on to `http://127.0.0.1:8000`. That single rule is why `npm run dev` can call `POST /api/chat` and have the Python FastAPI backend answer with no CORS setup in the browser.

- **`tsconfig.json`** — TypeScript compiler settings for the whole app: strict mode, React 19 JSX conventions, the same `@` → `src/` path mapping as Vite, and resolution rules. The `build` script runs `tsc -b` against it before bundling, so the IDE, the build, and the dev server all agree on paths.
- **`vercel.json`** — Vercel's routing and framework hint. It declares the Vite framework, sends anything matching `/api/(.*)` to the serverless functions in `api/`, and rewrites every other path to `index.html`. That last rule is what makes deep links work: the site is a `wouter` single-page app, so a visitor refreshing `/news` must receive the app shell (not a 404) — the router then shows the News page.
- **`.env`** (local, git-ignored) **and `.env.example`** (safe template) — Environment configuration. `.env` holds real secrets on your machine and is never committed; `.env.example` is the documented template that new developers copy. Values fall into groups: public frontend vars consumed by `src/lib/supabase.ts` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), server-side vars for the chat layer (`GOOGLE_GENERATIVE_AI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKEND_URL`), backend vars (same Gemini/Supabase keys plus `WEBHOOK_SECRET`), and `DISCORD_BOT_TOKEN` for the Supabase Edge Function and bot.
- **`.eslintrc.cjs`** — ESLint config backing `npm run lint`: TypeScript-aware rules on top of the recommended presets with Prettier integration so linting and formatting agree.
- **`.gitignore`** — Keeps generated and secret files out of git: `node_modules/`, `dist/`, `.env` and friends, `.vercel/`, `.supabase/`, Python cache files, and the local SQLite database.
- **`DEPLOYMENT_GUIDE.md`** — The step-by-step playbook for shipping the site: GitHub setup, Supabase project creation + schema SQL + realtime + discord-sync deployment, Vercel build settings, every environment variable, and post-deploy verification.
- **`SKILL.md`** — A front-matter template for an agent skill; currently a placeholder and unused.
- **`read.md`** — This very file, the developer onboarding guide.

---

## 3. `src/` — app shell and startup

**Section overview.** The frontend's nervous system. `main.tsx` boots the React app inside the theme provider, `App.tsx` composes the global layout and the page routes, `index.css` is the visual design system (Tailwind + light/dark palettes + animations), and `vite-env.d.ts` gives TypeScript the Vite import types. Everything else in `src/` — pages, components, lib — plugs into the layout that `App.tsx` mounts.

### File breakdown

- **`src/main.tsx`** — The program entry point (loaded by `index.html`). It wraps the whole app in `ThemeProvider` (from `src/components/ThemeBar.tsx`) so light/dark theming is available everywhere, then renders `App`. On boot it also kicks off the prefetch of the first screen's data, so content is already cached by the time the user navigates. It even ships a tiny "built for a caret" tooltip easter egg.

- **`src/App.tsx`** — The composition root. It mounts the fixed `OrganicBackground` ambience layer, the sticky `Navbar`, a `wouter` `<Switch>` that maps `/`, `/news`, and `/calendar` to `HomePage`, `NewsPage`, and `CalendarPage`, and the global floating `ChatWidget`. This is the only file that knows the complete page layout and the only one that wires the router and theme bar together.
- **`src/index.css`** — The global stylesheet: imports Tailwind (v4), defines the CSS variables for the dark and light palettes, styles fonts (including the `font-display` utility), and declares the custom animation classes (the typewriter caret, the pulsing "thinking" dots, fade-ins) plus scrollbar styling. When `ThemeBar` toggles `html.light`, this file is where the whole site actually changes color.
- **`src/vite-env.d.ts`** — A two-line Vite-generated shim that imports Vite's client types so `import.meta.env.*` and asset imports pass the type-checker.

---

## 4. `src/pages/` — Home, News, and Calendar

**Section overview.** One component per route, chosen by `App.tsx`'s `<Switch>`, and each one controls the *look and feel* of its screen: **HomePage** is the big-brand landing page, **NewsPage** renders the announcement feed, and **CalendarPage** renders the event schedule. All three follow the same lifecycle — seed state from the in-memory cache for instant paint, refresh from Supabase in the background, subscribe to Realtime where relevant, render skeleton/empty/error/list states with `components/ui/` primitives, and degrade to hardcoded fallback data when the database is unavailable. Pages never talk to `api/chat.ts` or the FastAPI backend; their only data source is Supabase, reached through `src/lib/`.

### File breakdown

- **`src/pages/HomePage.tsx`** — *Controls the looks of the homepage.* Renders the giant club-name headline (from `club_info`), the two hero buttons ("View Schedule" → `/calendar` and "Announcements" → `/news`, both calling `prefetchRoute` on hover/focus/touch so the destination page is already warm in the cache), and a two-card grid: one card for regular meeting times and one "Get in Touch" card with email, Google Classroom code, and Instagram — each row becoming a clickable link. While content loads it shows skeleton placeholders; if anything is missing it silently falls back to `fallbackClubInfo`. A small vision/mission line floats at the bottom. Built from `Card`, `Button`, and `Skeleton`.
- **`src/pages/NewsPage.tsx`** — *Controls the looks of the news page.* Turns every announcement into a card with the author's badge, the formatted date, and the message text. It refreshes through `prefetchNews()`, shows skeleton cards while loading, and if the fetch fails shows an error banner with a Retry button before falling back to `fallbackNews`. The standout behavior is **realtime**: when Supabase is configured it subscribes to `INSERT` events on the `news` table, so an announcement posted by the Discord bot appears at the top of the list within a second and is written straight into the shared cache (`setCachedNews`). The Realtime channel is cleaned up on unmount to avoid leaks.
- **`src/pages/CalendarPage.tsx`** — *Controls the looks of the calendar page.* Renders every event as a card with title, date/time/location, description, and an "Add to Google Calendar" button that opens a pre-filled Google Calendar URL (a small helper, `generateGoogleCalendarUrl`, formats the event into the calendar's `TEMPLATE` link). It follows the same cache-first lifecycle — `getCachedCalendar()`/`prefetchCalendar()`, skeleton grid, error banner + Retry + `fallbackEvents`, and an empty state — and subscribes to *all* changes on the `events` table, re-fetching whenever an admin edits the schedule so the page stays perfectly in sync.

---

## 5. `src/components/` — navbar, theme, chat, and ambience

**Section overview.** Reusable, self-contained pieces that `App.tsx` mounts: the sticky navigation, the theme switcher, the floating AI chat, and two background layers that give the site its animation. Each component talks to the rest of the app through well-defined hooks — props, the theme context, or the shared `lib/` data layer.

### File breakdown

- **`src/components/Navbar.tsx`** — The sticky top navigation bar. Uses `wouter`'s `useLocation` to detect the active page and highlight the matching link, renders the brand pill and the Home / News / Calendar links, and calls `prefetchRoute(link.href)` on hover, focus, and touch so every destination's data is already fetched before the user clicks. It embeds `ThemeBar`, so the nav and the theme toggle always render together in the same header.
- **`src/components/ThemeBar.tsx`** — The owner of light/dark theming, and it exports three things: `ThemeProvider` (a React context that persists the choice in localStorage under `aiclub-theme` and applies it by toggling the `dark`/`light` classes on `<html>`), `useTheme` (the hook any component calls to read or flip the theme), and the `ThemeBar` pill buttons shown in the nav. It is the *single* source of the `html.light` class that both `src/index.css` and `SineWaveBackground.tsx` key off — flip the theme here and the whole site, canvas animation included, changes palette.
- **`src/components/ChatWidget.tsx`** — The AI assistant frontend. Renders the floating button in the corner that expands into the chat panel, and drives the conversation with `useChat` from `@ai-sdk/react`, pointed at `POST /api/chat` — which the Vite proxy routes to FastAPI in dev and to the Vercel Edge Function in production. It owns every interaction detail: the message list with the per-character `TypewriterMessage` reveal and blinking caret, a "Processing" three-dot bubble while waiting for the first token, an error banner when the request fails, and a 2.5-second cooldown after each answer that disables the input and counts down on the send button, plus smooth auto-scrolling. Its form is built from the `Input` and `Button` primitives.
- **`src/components/OrganicBackground.tsx`** — A small composition helper: it wraps `SineWaveBackground` plus a thin "perimeter accent line" gradient into a single fixed, non-interactive (`pointer-events-none`) layer, so `App.tsx` can mount one decorative unit behind the whole site.
- **`src/components/SineWaveBackground.tsx`** — The animated backdrop. Draws ten layered sine/cosine "ribbon strands" onto a full-screen canvas with depth-based amplitude, color, and glow for a slow, organic, 3D feel. It handles Retina screens (DPR-aware resizing), respects `prefers-reduced-motion` (renders one still frame for users who disable animation), and reads the `<html>` theme class every frame to switch between the dark crimson/rose palette and the light blue/sapphire one. This is the main "the site is alive" visual.

---

## 6. `src/components/ui/` — the design system

**Section overview.** The visual building blocks — small, shadcn-style components built on `cva` (class-variance-authority), `clsx`, and `tailwind-merge`. Every page and the chat widget use these instead of raw styled elements, which is what keeps the site looking consistent. They are pure presentation: no data, no business logic.

### File breakdown

- **`src/components/ui/button.tsx`** — The `Button` primitive with three variants (`default`, `outline`, `ghost`) and three sizes, plus an `asChild` mode that lets pages wrap the button styling around a `wouter` `<Link>` or plain `<a>` while still forwarding events like `onMouseEnter`. Powers the homepage hero buttons, the retry buttons on error banners, the "Google Calendar" footer buttons, and the chat send button.
- **`src/components/ui/card.tsx`** — `Card` plus its parts — `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` — composed as styled `div`s. This is the skeleton behind the schedule/contact cards on the home page, every announcement card on the news page, and every event card on the calendar page. `Card` accepts className overrides (e.g. `hover:border-[#382D30]`) so pages can fine-tune borders and backgrounds.
- **`src/components/ui/badge.tsx`** — A small pill/label with a few color variants. The news page uses it to display each announcement's author.
- **`src/components/ui/input.tsx`** — A styled single-line text field that forwards `ref`s — which is exactly how the chat widget focuses and reads the message box. Used only by the chat widget.
- **`src/components/ui/skeleton.tsx`** — A shimmering grey placeholder block, the loading state: pages render skeletons shaped like the content that is about to arrive instead of an empty gap.

---

## 7. `src/lib/` — data layer and helpers

**Section overview.** The plumbing under the pages: it creates the Supabase client, defines the TypeScript shapes of the database rows, and — most importantly — implements the whole cache/prefetch strategy that makes the site fast (instant paint from memory) and resilient (fallback data when offline). Pages import from here; components rarely do.

### File breakdown

- **`src/lib/supabase.ts`** — Creates the single `supabase` client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, exports those two constants plus an `isSupabaseConfigured` flag (for when the env vars are missing), and defines the database row types `ClubInfo`, `NewsItem`, and `CalendarEvent`. It is the *only* file that touches the Supabase SDK directly. If the env vars are absent, `supabase` is `null` and every page runs in offline mode.
- **`src/lib/cache.ts`** — The in-memory cache + prefetch engine and the real heart of the frontend's resilience. It exposes a generic `fetchCached(route, fetcher, {ttl})` that caches results in a module-level `Map` with a timestamp, deduplicates concurrent requests for the same route (so ten callers asking at once hit Supabase exactly once), and only re-fetches after the TTL expires. On top of that it provides per-route helpers — `prefetchHome`/`prefetchNews`/`prefetchCalendar` (the async refreshers), `getCachedHome`/`getCachedNews`/`getCachedCalendar` (the synchronous reads for instant paint), `setCachedNews` (used by the Realtime listener), `invalidateCache`, and `prefetchRoute` (used by the nav and hero links) — plus the hardcoded `fallbackClubInfo`, `fallbackNews`, and `fallbackEvents` data that pages drop to when Supabase cannot be reached.
- **`src/lib/utils.ts`** — One tiny helper, `cn(...)`: the classic `clsx` + `tailwind-merge` combination that merges and dedupes Tailwind class names. The `ui/` primitives use it for every className they build.

---

## 8. `api/` — the Vercel chat function

**Section overview.** The production server tier of the chatbot. When the site is deployed on Vercel, `POST /api/chat` lands here, in a single Edge Function that rate-limits callers, then either forwards to the Python backend or answers directly with Google Gemini. It is the server-side link between the chat widget and the LLM, and the reason the Gemini key never ships to the browser.

### File breakdown

- **`api/chat.ts`** — The only file in the folder, and it behaves differently by HTTP method:
  - **GET (diagnostics):** A browser-usable health check. Reports where the Gemini key came from (Vercel env or the Supabase `app_secrets` table), the configured model, whether the Python backend is reachable (a quick `/health` probe), and the list of Gemini models the key can access. This is the first thing to open when the bot misbehaves — it tells you exactly which layer is misconfigured.
  - **POST (chat):** The real work. It parses the AI-SDK `{messages: [...], system: ...}` body the widget sends, applies rate limiting (an in-memory sliding window, 25 requests per minute per IP, returning HTTP 429 with a `Retry-After` header), then follows **Option A**: if `BACKEND_URL` is set and the FastAPI service answers within ~3.5 s, it forwards the body there and streams the backend's answer back in the Vercel AI Data Stream wire format the widget understands. If there is no backend or it times out, it follows **Option B**: fetches `club_info`, the 5 latest news items and the 5 next events from Supabase (plus the Gemini key, preferring the `app_secrets` table), injects them as JSON into a system prompt (concise club assistant, ≤150 words, no em dashes, admit unknowns), and streams the reply from Gemini via the Vercel AI SDK. Secrets stay server-side — it only reads Vercel env vars and Supabase, never the browser bundle.

---

## 9. `backend/` — the Python FastAPI service

**Section overview.** The self-hosted companion tier that mirrors the chat endpoint with its own RAG, serves the plain club-data endpoints, and accepts Discord webhook posts. It is layered like a classic service: `main.py` (app + CORS) → `api.py` (routes + auth) → `sql_db.py` (data access, Supabase-first with SQLite fallback) → `gemini_rag.py` (LLM prompt/answer). In development the Vite proxy reaches it at `127.0.0.1:8000`; in production the Edge Function forwards to it when `BACKEND_URL` is set.

### File breakdown

- **`backend/main.py`** — The FastAPI app factory and entry point. Creates the app, logs any 404 paths (handy for debugging routes), adds permissive CORS so the Vercel frontend and the Vite dev server may call it, mounts the router from `api.py`, and exposes `/` (a JSON menu of the endpoints) and `/health` (the liveness probe `api/chat.ts` uses to decide whether to forward). Running `python backend/main.py` starts uvicorn on port 8000 (or `$PORT`).
- **`backend/api.py`** — The HTTP surface: Pydantic models (`ChatQuery`, `DiscordMessage`) plus the routes — `GET /api/club-info`, `GET /api/news`, `GET /api/calendar` (thin wrappers over the `sql_db.py` getters), `POST /api/chat` (accepts either a plain `{query, history}` body or an AI-SDK `{messages}` array, calls `gemini_rag.generate_rag_answer`, then returns either a `StreamingResponse` in the Vercel Data Stream wire format — which the widget's `useChat` understands — or plain `{"answer": ...}` JSON depending on the client), and `POST /api/discord-webhook` (bearer-token protected with `WEBHOOK_SECRET`, validates the payload, and persists through `sql_db.add_news`). It is the only backend file that knows about HTTP.
- **`backend/sql_db.py`** — The data access layer with the dual-backend trick. Loads `.env` from the repo root or `backend/`, lazily creates a Supabase client (service-role key when available), and every operation — `get_club_info`, `get_news`, `get_calendar`, `add_news`, `get_secret` — tries Supabase first and, on any failure, silently falls back to a local SQLite file (`backend/club_data.db`) whose tables mirror `supabase/schema.sql` (created and seeded at import time). `get_secret` also checks `os.getenv` as a last stop, which is how `gemini_rag.py` finds the Gemini key.
- **`backend/gemini_rag.py`** — The RAG answer generator. Resolves the Gemini API key (env → `sql_db.get_secret`), assembles fresh context from `sql_db` (club info, 5 events, 5 news items), shapes the last few conversation turns into a compact history, and builds a strict prompt ("answer only from the context, ≤150 words, no em dashes, admit when you don't know") before calling the `google-genai` client's `generate_content` and returning the text. Called only by `api.py`.
- **`backend/requirements.txt`** — The Python dependency list (`fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, `google-genai`, `supabase`, `requests`) so `pip install -r backend/requirements.txt` sets up the service. (The `requirements.txt` at the repo root belongs to the Discord bot.)
- **`backend/__init__.py`** — An empty marker that makes `backend` an importable Python package — required because the modules import each other as `from backend.xxx import ...` and uvicorn loads `backend.main:app`.

---

## 10. `supabase/` — database and bot sync

**Section overview.** Everything about the cloud database: `schema.sql` defines the tables the whole site queries, and a Deno Edge Function in `functions/` gives the Discord bot a direct path to insert announcements. Every page, the chat function, and the Python backend read from these tables — adding or editing rows here shows up live on the site.

### File breakdown

- **`supabase/schema.sql`** — The one-time database definition plus seed, designed to be pasted into the Supabase SQL editor. It creates `club_info` (a singleton row with name, mission, meeting times, rules, contact email, Google Classroom code/URL, Instagram handle/URL), `news` (id, content, author, timestamp, with a descending-timestamp index), and `events` (id, title, date, time, location, description, with an ascending-date index). It inserts the default club row, enables Row Level Security, and grants public read-only (`select`) policies to `anon`/`authenticated` so the frontend's anon key can read freely — exactly matching the `ClubInfo`/`NewsItem`/`CalendarEvent` interfaces in `src/lib/supabase.ts`.
- **`supabase/functions/discord-sync/index.ts`** — A Deno Edge Function that lets the Discord bot publish announcements. It handles CORS preflight, accepts only POST, checks the `Authorization` header against the `DISCORD_BOT_TOKEN` secret, validates the payload (content ≤ 4000 chars, author ≤ 100), and uses the auto-injected `SUPABASE_SERVICE_ROLE_KEY` to insert a fresh row into `public.news`. That insert lands in every open browser through the Realtime subscription in `NewsPage.tsx`. The header comment documents deployment (`supabase functions deploy discord-sync`) and bot setup.

---

## 11. `club-discord-bot/` — the Discord publisher

**Section overview.** A small standalone Python script that bridges Discord and the site: it watches a Discord channel and reposts new announcements into the Supabase `news` table (through the `discord-sync` Edge Function), so whatever is typed in the club's Discord shows up on the website within seconds.

### File breakdown

- **`club-discord-bot/bot.py`** — The bot itself. Uses discord.py to stream a channel's messages, filters for announcements, and forwards each one to the `discord-sync` endpoint with the shared `DISCORD_BOT_TOKEN`, on a small cooldown. It depends on the root `requirements.txt` (discord.py, requests, python-dotenv). Deployment is manual — run it on any always-on machine or VPS — and the Supabase Edge Function call can be swapped for the FastAPI webhook (`POST /api/discord-webhook`) when the backend is reachable.
- **`club-discord-bot/supabase/.temp/`** — Boring Supabase CLI metadata (`cli-latest`, `linked-project.json`) generated by `supabase link`; local bookkeeping only.

---

## 12. How it all fits together

1. **Page content:** `main.tsx` → `App.tsx` routes → a page in `src/pages/` → `src/lib/cache.ts` (cache/prefetch, dedup, TTL) → `src/lib/supabase.ts` → Supabase tables from `supabase/schema.sql`. Any failure or missing config → hardcoded fallbacks in `cache.ts`. The `Navbar.tsx` and hero links keep the cache warm via `prefetchRoute` before the user clicks.
2. **Chat (production):** `ChatWidget.tsx` (`useChat`) → `POST /api/chat` → Vercel Edge Function `api/chat.ts` → Option A: `BACKEND_URL` → `backend/api.py` → `gemini_rag.py` → `sql_db.py` (Supabase/SQLite) → Gemini, streamed back in AI Data Stream format → typewriter reveal in the widget. Option B (fallback): `api/chat.ts` fetches Supabase context itself and streams Gemini directly. Rate limits: 25 req/min/IP at the edge plus the widget's 2.5 s client cooldown.
3. **Chat (development):** `vite.config.ts` proxies `/api/*` → `127.0.0.1:8000`, where `backend/main.py` serves the same `POST /api/chat` endpoint directly.
4. **Announcements:** Discord bot (`club-discord-bot/bot.py`) → `supabase/functions/discord-sync/index.ts` (token-checked insert) → `public.news` → Supabase Realtime → `NewsPage.tsx` updates the list and the cache instantly. (Webhook alternative: bot → `POST /api/discord-webhook` on the Python service → `backend/sql_db.py: add_news` → same table.)
5. **Theming:** `ThemeBar.tsx` toggles `html.light` → `src/index.css` and `SineWaveBackground.tsx` re-skin to the light palette, and `useTheme` lets any component read the current mode.

---

## 13. Environment variables cheat sheet

| Variable | Where it's set | Who reads it |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Local `.env` (browser-visible) / Vercel | `src/lib/supabase.ts` (also `api/chat.ts` and `backend/sql_db.py` as fallbacks) |
| `GOOGLE_GENERATIVE_AI_API_KEY` (alias `GEMINI_API_KEY`) | Backend host or Supabase `app_secrets` | `api/chat.ts`, `backend/gemini_rag.py` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Backend host / Vercel | `backend/sql_db.py`, `api/chat.ts`, auto-injected into `discord-sync` |
| `BACKEND_URL` (alias `FASTAPI_BACKEND_URL`) | Vercel | `api/chat.ts` |
| `WEBHOOK_SECRET` | Backend `.env` | `backend/api.py` (Discord webhook auth) |
| `DISCORD_BOT_TOKEN` | Supabase Edge Function secrets + bot | `supabase/functions/discord-sync/index.ts`, `club-discord-bot/bot.py` |
