# AI Club Website — Project Documentation (`read.md`)

## 1. Overview

The AI Club Website is the official web portal for a student AI Club: it publishes club facts, announcements (news), and event schedules, and embeds an AI assistant chatbot that answers questions about the club using its live data. The system is a three-tier, JavaScript-first architecture built around graceful degradation. Tier 1 is a **React 19 + TypeScript + Vite SPA** (`src/`, styled with Tailwind CSS v4) that reads club content directly from a **Supabase PostgreSQL** cloud database using a public anon key, caches it in memory, and subscribes to Supabase Realtime so news and events update live without a page refresh; if Supabase is unreachable or unconfigured, every page falls back to hardcoded offline data in `src/lib/cache.ts`. Tier 2 is the **serverless proxy layer**: a Vercel Edge Function (`api/chat.ts`) that rate-limits chat traffic and forwards it to the Tier-3 service, returning its plain-JSON answer. Tier 3 is the required, self-hosted **Python FastAPI backend** (`backend/`), the only API provider: it serves the RAG chat endpoint (Google Gemini + Supabase club context) plus database endpoints and a Discord webhook endpoint, backed by Supabase with a local SQLite fallback (`backend/club_data.db`). No Vercel AI SDK packages are used anywhere. A **Supabase Edge Function** (`supabase/functions/discord-sync/index.ts`) allows a Discord bot to POST announcements straight into the Supabase `news` table, which the frontend instantly renders via realtime subscriptions. The whole stack deploys as: GitHub repo → Vercel (hosting the built SPA + `/api/chat` Edge Function) + Supabase (database, realtime, discord-sync function), as detailed in `DEPLOYMENT_GUIDE.md`.

---

## 2. Repository Root — Project Configuration & Entry Point

**Section Overview:** This section holds the build, type, lint, deployment, and secret configuration that wires every other section together. Nothing here contains application logic; instead these files define how the frontend is bundled (`vite.config.ts`, `index.html`), how TypeScript/ESLint validate coandde, how Vercel serves the app in production (`vercel.json`), and which credentials each tier reads (`.env`). The root also hosts the two human-oriented documents (`DEPLOYMENT_GUIDE.md`, `SKILL.md`).

### File Breakdown

- **`package.json`** — Node/npm manifest. Declares the project name (`club-web-app`), scripts (`dev` → Vite dev server, `build` → `tsc -b && vite build`, `lint`, `format`), and all dependencies: React 19, `wouter` (routing), `@supabase/supabase-js` (database client), Radix UI + `class-variance-authority` + `clsx` + `tailwind-merge` + `lucide-react` (UI primitives/icons), and dev-time Vite 6, Tailwind v4, TypeScript. It is the single source of truth for the toolchain used by `vite.config.ts` and `tsconfig.json`.
- **`package-lock.json`** — Lockfile pinning exact dependency versions for reproducible installs; no logic, consumed only by npm.
- **`index.html`** — The single HTML entry point that Vite injects the bundle into. Loads Google Fonts (Inter, Plus Jakarta Sans), sets the page title/meta description, the initial dark-mode body colors, and the `#root` div plus `/src/main.tsx` module script. In production builds it is transformed and emitted into `dist/index.html`.
- **`vite.config.ts`** — Vite build configuration. Registers the React and Tailwind v4 plugins, defines the `@/*` → `./src/*` path alias (matching `tsconfig.json` `paths`), sets dev port 3000, and crucially proxies `/api/*` to `http://127.0.0.1:8000` during development so the SPA's chat calls reach the local FastAPI service (mirroring the `/api/chat` production route).
- **`tsconfig.json`** — TypeScript compiler config for `src` and `api` (strict mode, `bundler` module resolution, `@/*` path mapping). Paired with the `build` script's `tsc -b` for type-checking before bundling.
- **`tsconfig.tsbuildinfo`** — Incremental build cache artifact produced by `tsc -b`; safe to delete, not hand-edited.
- **`vercel.json`** — Production routing for Vercel. Keeps `/api/(.*)` requests going to the serverless functions (`api/chat.ts`) and rewrites every other route to `/index.html`, enabling SPA-style client routing for `wouter` on deep links like `/news`.
- **`.env`** *(local, git-ignored)* and **`.env.example`** — Real secrets and their documented template respectively. Defines four groups: public frontend vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) consumed by `src/lib/supabase.ts`; the Vercel proxy target (`BACKEND_URL`/`FASTAPI_BACKEND_URL`) consumed by `api/chat.ts`; private Python-backend vars (`GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) consumed by `backend/gemini_rag.py` and `backend/sql_db.py`; the optional direct-backend URL (`VITE_BACKEND_URL`) consumed by `ChatWidget.tsx`; and the Supabase Edge Function secret (`DISCORD_BOT_TOKEN`) used by `supabase/functions/discord-sync/index.ts`.
- **`.eslintrc.cjs`** — ESLint config (TypeScript parser, `eslint:recommended` + `@typescript-eslint/recommended` + Prettier). Backs the `npm run lint` script for all `.ts/.tsx` files.
- **`.gitignore`** — Excludes `node_modules/`, `dist/`, `.env`/`.env.*`, `.vercel/`, `.supabase/`, and Python artifacts so secrets and build outputs stay out of GitHub.
- **`DEPLOYMENT_GUIDE.md`** — Step-by-step operator manual for the three deployment targets (GitHub, Supabase, Vercel), including SQL setup and environment-variable placement.
- **`SKILL.md`** — A template-style agent/skill instruction file for this project; currently a scaffold ("first step / additional step" placeholders) with no active logic.
- **`.vscode/extensions.json`** — VS Code workspace manifest whose standard role is recommending extensions when the workspace opens; it is present but empty/optional and affects nothing at build time.

---

## 3. `src/` — React Frontend Application Core

**Section Overview:** The browser tier. These four root files bootstrap the SPA, define client-side routing and global layout, and establish the design system (Tailwind theme + light/dark theme CSS). They import and compose everything from `src/pages/`, `src/components/`, and `src/lib/`, so this section is the hub all other `src/` sections hang off of. It connects outward to `api/chat.ts` (via ChatWidget's `/api/chat` call) and Supabase (via `src/lib/supabase.ts`).

### File Breakdown

- **`src/main.tsx`** — Bootstrap entry. Mounts `<App />` inside `React.StrictMode` into `index.html`'s `#root` and imports the global stylesheet. Nothing else in `src/` runs until this executes.
- **`src/App.tsx`** — Application shell and router. Wraps the tree in `ThemeProvider` (from `components/ThemeBar`), renders the global `OrganicBackground`, sticky `Navbar`, a `wouter` `<Switch>` mapping `/` → `HomePage`, `/news` → `NewsPage`, `/calendar` → `CalendarPage` (plus a 404 fallback), and the always-mounted floating `ChatWidget`. On mount it schedules `prefetchRoute` calls (from `lib/cache`) for all three routes so first navigation is instant. This is the only file that knows every top-level component at once.
- **`src/index.css`** — Global stylesheet and design system. Imports Tailwind, declares the custom `@theme` palette (canvas/surface greys, crimson accent ramp `#2A1215 → #E0A3AA`, text/border tokens, display/sans fonts) and `:root`/`:root.light` CSS variables for theming. The bulk is aggressive light-mode overrides that repaint the dark-mode utility classes (red borders → blue `#2563EB`, dark surfaces → white, red selection → blue) keyed off the `html.light` class that `ThemeBar` toggles. `SineWaveBackground` also reacts to that class per frame. Without this file the components' hex classes have no light-mode counterpart.
- **`src/vite-env.d.ts`** — One-line Vite ambient type reference (`vite/client`), enabling `import.meta.env` typing used by `src/lib/supabase.ts`.

---

## 4. `src/pages/` — Route-Level Page Components

**Section Overview:** One component per route, rendered by `App.tsx`'s `<Switch>`. Each page follows the same pattern: initialize state from the in-memory cache (`src/lib/cache.ts`), fetch/refresh through that same module, subscribe to Supabase Realtime where relevant, render skeleton/empty/error/list states with `src/components/ui/` primitives, and degrade to hardcoded fallback data when the database is unavailable. Pages never talk to `api/chat.ts` or the FastAPI backend; their only data source is Supabase via `lib/`.

### File Breakdown

- **`src/pages/HomePage.tsx`** — Route `/`. Renders the giant club-name hero (from `club_info.club_name`), CTA buttons that prefetch their target routes on hover/focus/touch, a two-card grid (Regular Meetings schedule, Get in Touch with email/Google Classroom/Instagram links pulled from `club_info`), and the vision/mission line. Reads only `getCachedHome`/`prefetchHome`/`fallbackClubInfo`; shows `Skeleton`s while `prefetchHome` resolves.
- **`src/pages/NewsPage.tsx`** — Route `/news`. Lists announcement cards (author `Badge`, date, content) from the Supabase `news` table via `prefetchNews`/`getCachedNews`, with `fallbackNews` for offline mode. Subscribes to a `postgres_changes` channel for `INSERT`s on `news`, prepending new rows to state and the cache in real time, and unsubscribes on unmount. Includes an error banner with a Retry button that calls `invalidateCache("news")` and refetches.
- **`src/pages/CalendarPage.tsx`** — Route `/calendar`. Shows upcoming events from the Supabase `events` table via `prefetchCalendar`/`getCachedCalendar` (fallback: `fallbackEvents`) as a two-column card grid with date/time/location and a generated Google Calendar "add event" link (`generateGoogleCalendarUrl`). Subscribes to all changes (`*`) on `events` and refetches on any mutation; same error/retry pattern as NewsPage.

---

## 5. `src/components/` — Shared Layout & Feature Components

**Section Overview:** Reusable presentational/behavioral components mounted by `App.tsx` (and, for `ui/`, by the pages). Splits into five feature components plus a `ui/` subdirectory of primitive building blocks. `Navbar` and `ChatWidget` are the two components that reach beyond pure presentation: Navbar triggers route prefetching through `lib/cache`, and ChatWidget is the frontend half of the AI chat pipeline that terminates in `api/chat.ts` / `backend/`.

### File Breakdown

- **`src/components/Navbar.tsx`** — Sticky top bar. Uses `wouter`'s `useLocation` for active-link styling, renders the brand pill and nav links (Home/News/Calendar), and calls `prefetchRoute(link.href)` on hover/focus/touchstart of every link so `lib/cache` warms the data before the user clicks. Embeds the `ThemeBar` component; the two are siblings inside the same header.
- **`src/components/ThemeBar.tsx`** — Theme state owner and toggle UI. Exports `ThemeProvider` (a React context persisting `"dark" | "light"` to `localStorage` under `aiclub-theme` and toggling the `dark`/`light` classes on `<html>`), `useTheme`, and the `ThemeBar` Dark/Light pill buttons. It is the *only* source of the `html.light` class that `src/index.css` and `SineWaveBackground.tsx` key off, making it the coupling point for the entire light-mode design.
- **`src/components/ChatWidget.tsx`** — The AI assistant frontend. POSTs plain JSON `{query, history}` to `/api/chat` (proxied by `vite.config.ts` to FastAPI in dev; forwarded by the Vercel Edge Function `api/chat.ts` to the Python backend in production) using `fetch`, with no AI SDK dependency. Contains the collapsible chat panel, message bubbles with a per-character `TypewriterMessage` reveal (blinking cursor), a "Processing" three-dot indicator while awaiting the first token, an error banner, and a client-side cooldown (2.5s countdown started after the typewriter finishes) that disables input/submit. Imports `Button` and `Input` from `components/ui/` for the form.
- **`src/components/OrganicBackground.tsx`** — Thin composition wrapper for the fixed, non-interactive (`pointer-events-none`) background layer: mounts `SineWaveBackground` plus a top "perimeter accent line" gradient. Exists purely so `App.tsx` can mount one decorative unit.
- **`src/components/SineWaveBackground.tsx`** — Canvas animation drawing 10 layered sine/cosine "ribbon strands" with depth-based amplitude, color, and glow, plus faint 3D ribs. Honors `prefers-reduced-motion` (renders a single static frame), handles DPR-aware resizing, and reads `document.documentElement.classList` every frame to switch between the dark (crimson/rose) and light (blue/sapphire) palettes, staying in sync with `ThemeBar`'s class toggling.

### Subsection: `src/components/ui/` — Primitive UI Building Blocks

**Subsection Overview:** shadcn/ui-style primitives shared by pages and `ChatWidget`. All five files import the `cn` helper from `src/lib/utils.ts` to merge custom classes with variant defaults; `button.tsx` and `badge.tsx` additionally use `class-variance-authority` for variants. They are leaf nodes: nothing in `ui/` imports outside `lib/utils` (plus Radix for `Button`), so the app has no circular dependency through them.

- **`ui/button.tsx`** — `Button` with `cva` variants (default/outline/secondary/ghost/link) and sizes, `asChild` slot support via `@radix-ui/react-slot` (used to wrap `wouter` `Link`s on HomePage). Consumed by all three pages and `ChatWidget`.
- **`ui/card.tsx`** — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` family used by HomePage, NewsPage, and CalendarPage layouts.
- **`ui/badge.tsx`** — `Badge` label chip (default/secondary/destructive/outline variants); used for news author tags.
- **`ui/input.tsx`** — Styled text `Input`; used by the ChatWidget message form.
- **`ui/skeleton.tsx`** — Pulsing placeholder `Skeleton` shown by all pages while data loads.

---

## 6. `src/lib/` — Client Data Layer & Utilities

**Section Overview:** The frontend's non-UI engine room. `supabase.ts` owns the typed database client, `cache.ts` owns caching/prefetch/fallback data and is the *only* module the pages use for data access, and `utils.ts` provides the class-merge helper used by every UI primitive. This section is the frontend's gateway to Supabase (the same database defined by `supabase/schema.sql`) and deliberately contains no React so it can be imported from anywhere.

### File Breakdown

- **`src/lib/supabase.ts`** — Database client factory and shared types. Reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from Vite env, exports `supabase` (or `null`) and the `isSupabaseConfigured` flag, and defines the `ClubInfo`, `NewsItem`, and `CalendarEvent` interfaces that mirror the Supabase `club_info`, `news`, and `events` tables. Every other consumer (`cache.ts`, `NewsPage.tsx`, `CalendarPage.tsx`) imports these types/client from here.
- **`src/lib/cache.ts`** — Caching + data access layer. Holds the hardcoded `fallbackClubInfo`/`fallbackNews`/`fallbackEvents` (offline defaults), a module-level `Map` cache with a 10-minute TTL (`getCached`/`setCached`/`invalidateCache`), an in-flight promise dedup (`inFlight`), per-route accessors (`getCachedHome` etc.), and the `prefetchHome/News/Calendar` functions that query Supabase via `supabase.ts` and fall back to the static data on any error. `prefetchRoute(route)` maps a URL to the right prefetcher; it is invoked by `App.tsx` on idle startup and by `Navbar`/`HomePage` on link hover/focus/touch. This file is the single dependency shared by all three pages and both navigation components.
- **`src/lib/utils.ts`** — One-liner `cn()` helper combining `clsx` + `tailwind-merge`. Imported by all five `components/ui/` files; has no other coupling.

---

## 7. `api/` — Vercel Serverless Edge Function

**Section Overview:** The production server-side tier for chat. Deployed automatically by Vercel (routed via `vercel.json`'s `/api/(.*)` rewrite) and executed on the edge runtime, this single function is the production entry point of `src/components/ChatWidget.tsx`. It does not run any AI itself: it rate-limits by IP and forwards every request to the Python FastAPI service (`backend/`, address given by `BACKEND_URL`/`FASTAPI_BACKEND_URL`).

### File Breakdown

- **`api/chat.ts`** — Thin proxy to the Python backend. One handler, three behaviors by method:
  - **GET (diagnostics):** Reports Python backend reachability via a `/health` probe (`connected`/`unreachable`/`not_configured`) plus whether `BACKEND_URL` is set. Used for browser-based setup troubleshooting.
  - **Rate limiting:** An in-memory sliding-window limiter keyed by client IP (`x-forwarded-for`), 25 requests/minute, returning HTTP 429 with `Retry-After`.
  - **POST (chat):** Forwards the incoming JSON body untouched to the Python backend (`POST {BACKEND_URL}/api/chat`, 25s timeout) and returns its JSON response verbatim (`{"answer": ...}`, preserving status codes). If `BACKEND_URL`/`FASTAPI_BACKEND_URL` is unset it returns HTTP 503; if the backend is unreachable it returns HTTP 502. It never touches Gemini or Supabase itself — Gemini calls happen only inside `backend/gemini_rag.py`.

---

## 8. `backend/` — Python FastAPI Service (Self-Hosted Tier)

**Section Overview:** The required Python backend that owns all chat and data APIs (plain JSON, no Vercel AI SDK protocol). Internally it is layered like a classic service: `main.py` (app/CORS/lifecycle) → `api.py` (routes/DTOs/auth) → `sql_db.py` (data access, Supabase-first with SQLite fallback) → `gemini_rag.py` (LLM prompt/answer). In dev it is reached through `vite.config.ts`'s `/api` proxy; in production `api/chat.ts` forwards to it via `BACKEND_URL`. Every route degrades gracefully if Supabase or Gemini is unavailable.

### File Breakdown

- **`backend/__init__.py`** — Empty package marker that makes the folder importable as `backend.*` (required because `main.py`, `api.py`, `gemini_rag.py`, and `sql_db.py` import each other via `from backend.xxx import ...`, and uvicorn loads `backend.main:app`).
- **`backend/main.py`** — FastAPI app factory and entry point. Creates the app, adds a 404-logging middleware, permissive CORS (any origin, so the Vercel frontend and dev Vite server may call it), mounts the router from `api.py`, and exposes `/` (service descriptor listing endpoints) and `/health` (liveness probe consumed by `api/chat.ts`'s GET diagnostics and its forwarding path). `python backend/main.py` runs uvicorn on port 8000 (or `PORT`).
- **`backend/api.py`** — HTTP routes and request models. Defines `ChatQuery`/`DiscordMessage` Pydantic models and the endpoints: `GET /api/club-info`, `GET /api/news`, `GET /api/calendar` (thin wrappers over `sql_db.py` getters), `POST /api/chat` (accepts either a plain `{query, history}` body or a legacy `{messages: [...]}` array using the last entry as the query; calls `gemini_rag.generate_rag_answer` and always returns plain JSON `{"answer": ...}` — no streaming protocol), and `POST /api/discord-webhook` (bearer-token-authenticated endpoint validating `WEBHOOK_SECRET` and persisting via `sql_db.add_news`). It is the only backend file that knows about HTTP concerns.
- **`backend/sql_db.py`** — Data access layer with dual backends. Loads `.env` from the repo root or `backend/`, lazily creates a Supabase client (service-role key preferred) and, for every operation (`get_club_info`, `get_news`, `get_calendar`, `add_news`, `get_secret`), tries Supabase first and silently falls back to local SQLite (`club_data.db`) on failure. `init_local_db()` runs at import time to create/seed the `club_info`, `news`, and `events` SQLite tables (same shape as `supabase/schema.sql`) with default rows. `get_secret` additionally falls back to `os.getenv`, providing the Gemini key lookup used by `gemini_rag.py` (the only place app secrets are read server-side, replacing the old `api/chat.ts` lookup).
- **`backend/gemini_rag.py`** — RAG answer generator. Resolves the Gemini API key (env → `sql_db.get_secret`), assembles context from `sql_db` (`club_info`, 5 events, 5 news), formats the last 4 history turns, and builds a club-assistant prompt (strictly use context, ≤150 words, no em dashes, admit unknowns), then calls `google-genai` `generate_content` on `gemini-3.1-flash-lite` and returns the text. Called only by `api.py`; this is the single place Gemini is invoked.
- **`backend/requirements.txt`** — Python dependency pins (`fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, `google-genai`, `supabase`, `requests`) for `pip install -r`.
- **`backend/club_data.db`** — Generated SQLite database file (runtime artifact of `init_local_db`); not source code, safe to delete and recreate.
- **`backend/__pycache__/`** — Compiled bytecode artifacts (includes a stale `test_backend.cpython-313.pyc` even though no `test_backend.py` exists in the tree); never edited by hand.

---

## 9. `supabase/` — Cloud Database Schema & Edge Function

**Section Overview:** Everything that runs *inside* Supabase rather than in the repo's Node or Python processes. `schema.sql` defines the shared PostgreSQL tables that the React frontend (`src/lib/`), the Vercel Edge Function (`api/chat.ts`), and the Python backend (`backend/sql_db.py`) all read, and the `functions/discord-sync` Edge Function provides the write path for Discord-sourced announcements. This section is therefore the data contract for the whole system.

### File Breakdown

- **`supabase/schema.sql`** — Database definition and seed. Creates `public.club_info` (single row `club_main`: name, mission, meeting times, rules, contact email, Google Classroom code/URL, Instagram handle/URL), `public.news` (id, content, author, timestamp; descending timestamp index), and `public.events` (id, title, date, time, location, description; ascending date index); inserts the default `club_info` row; enables Row Level Security; and grants public read-only (`select`) policies for `anon`/`authenticated` on all three tables — exactly matching the frontend's anon-key queries and the `ClubInfo`/`NewsItem`/`CalendarEvent` interfaces. (`app_secrets` reads and `news` writes use the service-role key, which bypasses RLS.)
- **`supabase/functions/discord-sync/index.ts`** — Deno Edge Function that lets a Discord bot publish announcements. Handles CORS preflight, accepts only POST, validates the `Authorization` header against the `DISCORD_BOT_TOKEN` secret, validates/limits the JSON body (`content` ≤ 4000 chars, `author` ≤ 100 chars), then uses Supabase's auto-injected `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to insert a `msg_<timestamp>` row into `public.news`. That insert instantly reaches browsers via the Realtime subscription in `NewsPage.tsx`. The header comment documents deployment (`supabase functions deploy discord-sync`) and bot setup.
- **`supabase/.temp/`** — Supabase CLI working files (linked project ref, migration/storage versions, pooler URL, etc.) generated by `supabase link`/`init`; local metadata only, not application code.

---

## 10. `dist/` — Production Build Output (Generated)

**Section Overview:** The static bundle produced by `npm run build` (tsc type-check + Vite build) and uploaded to Vercel. Entirely derived: `dist/index.html` is the transformed root `index.html` referencing hashed assets, and `dist/assets/` holds the single content-hashed CSS and JS chunks containing all of `src/`. Never hand-edited; delete and rebuild at any time. Vercel serves these files and falls back to `dist/index.html` for unknown paths per `vercel.json`'s SPA rewrite.

- **`dist/index.html`** — Built HTML entry referencing the hashed asset files.
- **`dist/assets/index-*.css` / `dist/assets/index-*.js`** — Hashed Tailwind stylesheet and bundled application JS (React + pages + components + lib).

---

## 11. End-to-End Interaction Flows (How Sections Connect)

1. **Page content flow:** `main.tsx` → `App.tsx` routes → a page in `src/pages/` → `src/lib/cache.ts` (cache/prefetch, dedup, TTL) → `src/lib/supabase.ts` → Supabase tables from `supabase/schema.sql`. Failure or unconfigured Supabase → hardcoded fallbacks in `cache.ts`. `Navbar.tsx`/`App.tsx` warm the cache via `prefetchRoute` before navigation.
2. **Chat flow (production):** `ChatWidget.tsx` (plain `fetch` JSON) → `POST /api/chat` → Vercel Edge Function `api/chat.ts` (IP rate limit only) → `BACKEND_URL` → `backend/api.py` → `backend/gemini_rag.py` → `backend/sql_db.py` (Supabase/SQLite) → Gemini → plain `{"answer": ...}` JSON back → typewriter reveal in the widget. (Or set `VITE_BACKEND_URL` so the widget calls the Python service directly.) Rate limits: Edge Function 25 req/min/IP plus the widget's client-side 2.5s cooldown.
3. **Chat flow (development):** `vite.config.ts` proxies `/api/*` to `127.0.0.1:8000`, where `backend/main.py` serves the same `POST /api/chat` endpoint directly.
4. **Announcement publishing flow:** Discord bot → `supabase/functions/discord-sync/index.ts` (token check) → insert into `public.news` → Supabase Realtime → `NewsPage.tsx` subscription updates the list and `src/lib/cache.ts` instantly. (Alternative: bot → `POST /api/discord-webhook` on the FastAPI service → `backend/sql_db.py: add_news` → same table.)
5. **Theming flow:** `ThemeBar.tsx` toggles `html.light` + `localStorage` → `src/index.css` overrides and `SineWaveBackground.tsx` palette react to that class.

## 12. Environment Variable Cheat Sheet

| Variable | Set where | Consumed by |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env` (public) | `src/lib/supabase.ts`, `backend/sql_db.py` (fallback) |
| `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | Server `.env` or Supabase `app_secrets` | `backend/gemini_rag.py` (the only Gemini caller) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server `.env` | `backend/sql_db.py`, injected into `discord-sync` |
| `BACKEND_URL` / `FASTAPI_BACKEND_URL` | Vercel env | `api/chat.ts` (required proxy target) |
| `VITE_BACKEND_URL` | `.env` (public, optional) | `ChatWidget.tsx` (direct Python-backend calls) |
| `DISCORD_BOT_TOKEN` / `WEBHOOK_SECRET` | Supabase Edge secrets / backend `.env` | `supabase/functions/discord-sync/index.ts`, `backend/api.py` |

*Generated artifacts (safe to ignore/delete): `tsconfig.tsbuildinfo`, `backend/__pycache__/`, `backend/club_data.db`, `supabase/.temp/`, `dist/`, `package-lock.json` (keep for installs).*
