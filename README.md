# AI Club Website

A modern club website and AI assistant for the AI Club, built with React, TypeScript, Vite, FastAPI, Supabase, and Google Gemini. The project combines a polished public-facing web app with a data-backed chatbot that can answer questions about events, announcements, club info, and other site content.

## 1. Overview

This repository powers the club's online presence and the supporting AI experience behind it.

The app is intentionally split into a frontend and backend, with a clear separation of concerns:

- Frontend: a React 19 + TypeScript + Vite SPA with a responsive layout, animated background, and live content pages
- Data layer: Supabase for club records, announcements, events, and realtime updates
- AI layer: Google Gemini used for prompt-driven responses grounded in the club's content
- Backend: FastAPI endpoints exposing JSON data and chat functionality
- Deployment: Vercel for the frontend + Supabase for data + Python backend for API and AI processing

The project exists to help the club:

- publish structured information about membership, meetings, and events
- keep schedule and news content current
- provide an accessible chatbot for community questions
- make content updates easy through data-backed models instead of manually hard-coded content

## 2. What the app does

The application includes:

- a home page for club identity, mission, and intake information
- a news page backed by Supabase content
- a calendar page for upcoming events and session details
- a floating AI chat widget that answers club-related questions
- animated visual backgrounds for a more polished, modern look
- mobile-friendly responsive behavior and reduced-motion-aware fallback patterns
- Vite-based local development support with proxying to the Python backend

## 3. Architecture

The app is a static React SPA backed by Supabase, plus two independent server-side implementations of the chat endpoint. Three design decisions explain most of the code:

- **Supabase is the source of truth for content.** Pages read `club_info`, `news`, and `events` directly from Supabase with the public anon key and Row Level Security; the AI layer reads the same tables (plus `info`) on the server. The Python API is not on the page-render path, so page content still loads when the backend is down.
- **Loading is deferred aggressively.** The Supabase client, the News/Calendar page bundles, the AI SDK, and the canvas background are all behind `import()`. The initial bundle is the shell plus the home page. A 10-minute in-memory cache and hover prefetching make repeat navigation instant.
- **One chat contract, two runtimes.** `api/chat.ts` (Vercel edge, streaming) and `backend/api.py` (FastAPI, single JSON answer) accept the same payload shapes and build their prompt from the same Supabase tables. Which one answers depends on where the frontend is deployed.

### 3.1 Runtime topology

```text
Browser (React 19 SPA)
│
├── Supabase JS (lazy) ─────────────► Supabase Postgres
│     club_info / news / events         RLS: public SELECT only
│     Realtime channels ──────────────► news INSERT, events changes
│
└── POST /api/chat
      ├── Local dev: Vite proxy ─────► FastAPI (backend/main.py → api.py → gemini_rag.py)
      │                                  └── sql_db.py → Supabase, or SQLite fallback
      └── Vercel: file route ────────► api/chat.ts (edge runtime, streamText)

Discord bot ──► Supabase Edge Function (supabase/functions/discord-sync)
                  └── INSERT into public.news ──► Realtime ──► NewsPage updates live
```

Notes on the split:

- The browser never holds the service-role key or the Gemini key; all privileged reads and model calls happen in `backend/` or `api/chat.ts`.
- The FastAPI service also exposes read endpoints (`/api/club-info`, `/api/news`, `/api/calendar`) and a Discord webhook, but the React pages query Supabase directly rather than going through them.
- In development the Vite proxy forwards `/api` to `127.0.0.1:8000`, so the chat widget needs no configuration. On Vercel the same `/api/chat` URL resolves to the edge function. `VITE_BACKEND_URL` is documented for a separately hosted backend but is not currently read by the frontend code, which targets the same-origin `/api/chat`.

### 3.2 Request and data flows

**Initial page load**

1. `index.html` loads the fonts, SEO metadata, and `/src/main.tsx`.
2. `main.tsx` mounts `<App />`; `App.tsx` renders the theme provider, navbar, and the matched page (home is in the initial chunk).
3. If the page data is already in `src/lib/cache.ts`, it paints immediately and then refreshes in the background. Otherwise a geometry-matched skeleton renders while `src/lib/data.ts` lazily imports the Supabase client and queries.
4. Decorative and heavy chunks (canvas background, News, Calendar, ChatWidget → ChatPanel) load after first paint or on user intent.

**Live content updates**

- `NewsPage` subscribes to `INSERT` events on `public.news`, prepends the new row, and updates the in-memory cache.
- `CalendarPage` subscribes to all changes on `public.events` and refetches (invalidating the cache first), so inserts, updates, and deletes all appear.

**Chat**

1. `ChatPanel` posts the conversation to `/api/chat` through the AI SDK's `useChat`.
2. Either runtime normalizes the request, loads bounded club context, and calls Gemini with a system prompt that forbids answering outside that context.
3. The edge handler streams tokens back; the FastAPI handler returns one JSON `{ "answer": "..." }` response. `ChatPanel` renders assistant text with a typewriter effect either way.

**Discord → announcements**

A Discord bot posts `{ content, author }` to the `discord-sync` Edge Function with the bot token. The function validates the token and payload, inserts a row into `public.news` with the service-role key, and Realtime pushes it to every open News page. The FastAPI `/api/discord-webhook` route is an equivalent write path for self-hosted deployments.

### 3.3 File-by-file reference

#### Root and configuration

- **`index.html`** — Vite entry document. Defines the title, description, keywords, canonical URL, Open Graph/Twitter cards, and an `Organization` JSON-LD block for `pethsaiclub.tech`; points the favicon and Apple touch icon at the club logo; preloads the two self-hosted fonts; sets the dark body palette; mounts `#root` and loads `/src/main.tsx`. All crawlable metadata lives here because the SPA injects no head tags at runtime.
- **`package.json`** — Frontend manifest and scripts: `dev` (Vite), `build` (`tsc -b && vite build`), `preview`, `lint` (ESLint on `.ts`/`.tsx`), `format` (Prettier). Dependencies cover React 19, Wouter routing, Framer Motion, Radix primitives, Supabase JS, the Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/react`), `react-markdown` with GFM/breaks plugins, Lucide icons, and the `clsx`/`tailwind-merge`/`cva` class utilities. Dev dependencies are Vite 6, the Tailwind 4 Vite plugin, TypeScript 5.7, ESLint 8, and Prettier.
- **`package-lock.json`** — npm lockfile pinning the exact dependency tree; generated, not edited by hand.
- **`tsconfig.json`** — TypeScript config for `src/` and `api/`: ES2022 target, bundler module resolution, `react-jsx`, `strict`, unused local/parameter errors, `noEmit` (Vite emits the bundle), and the `@/*` → `src/*` alias used by every import. The Python backend is not type-checked here.
- **`vite.config.ts`** — Vite config. Registers the React and Tailwind plugins, mirrors the `@` alias, and defines `manualChunks` so vendor code splits into `motion`, `supabase`, `react-dom`, `vendor`, `icons`, `utils`, and `radix` chunks. The dev server runs on port 3000 and proxies `/api` to `http://127.0.0.1:8000` (paths preserved, matching the FastAPI routes).
- **`vercel.json`** — Vercel project config: Vite preset, immutable one-year caching for `/assets/*`, a pass-through rewrite for `/api/*` so serverless/edge functions are not swallowed, and an SPA fallback serving `index.html` for every other route.
- **`.env.example`** — Template for environment variables. Separates browser-safe `VITE_SUPABASE_*` values from server-only `GOOGLE_GENERATIVE_AI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_ORIGINS`, and the Discord token used by the Edge Function.
- **`.eslintrc.cjs`** — ESLint config: TypeScript parser, `eslint:recommended` plus `@typescript-eslint/recommended`, Prettier compatibility, and a warning (not error) for unused variables whose names start with `_`.
- **`.gitignore`** — Excludes dependencies, build output (`dist/`, `.vercel/`), all `.env*` files, Supabase local state, `*.tsbuildinfo`, Python bytecode, and `backend/club_data.db`.
- **`tsconfig.tsbuildinfo`** *(generated, gitignored)* — Incremental TypeScript cache produced by `tsc -b`; safe to delete.

#### Frontend shell

- **`src/main.tsx`** — React entry point. Finds `#root`, creates the React 19 root, and renders `<App />` inside `StrictMode`, importing the global stylesheet once.
- **`src/App.tsx`** — Application shell and routing. Wraps everything in `ThemeProvider`, renders `Navbar`, and routes `/`, `/news`, and `/calendar` with Wouter plus a catch-all "Page Not Found". It skips the decorative canvas below 768px and on coarse-pointer devices, widens the container on the calendar route, and lazy-loads `OrganicBackground`, `NewsPage`, `CalendarPage`, and `ChatWidget` behind skeletons. The calendar lazy loader consumes `calendarComponentPromise` from `Navbar` when a hover preload has already started, so the module is reused rather than downloaded twice. The chat widget is mounted once, globally, so it survives navigation.

#### Pages (`src/pages/`)

- **`HomePage.tsx`** — The club landing page. Reads `getCachedHome()` synchronously for an instant first paint; with no cache it waits 800 ms before fetching so the skeleton does not compete with the largest contentful paint, and with a cache it revalidates immediately in the background. Renders the hero (`club_name`), "View Schedule" (which prefetches the calendar route on hover, focus, and touch), "Ask AI" (which dispatches the `aiclub:open-chat` DOM event the widget listens for), cards for meeting times, the Discord server, and contact links (email, Google Classroom, Instagram), and the vision/mission statement. It defines a local inline Discord SVG because Lucide has no official mark, and inline SVG filters for the glass CTA. Missing fields render field-level skeletons rather than invented content.
- **`NewsPage.tsx`** — Announcements feed. Hydrates from the news cache, otherwise shows `NewsSkeleton` while `prefetchNews()` runs. Subscribes to Supabase Realtime `INSERT` events on `public.news`, prepending new rows and writing them back to the cache; the channel is removed on unmount. Supports newest-first/oldest-first sorting, a retry button that invalidates the cache and refetches, explicit loading, empty, and error states, and animated list reordering via Framer Motion (`layout` + `AnimatePresence`). Post bodies render as Markdown through `react-markdown` with `remark-breaks` and custom element renderers, so headings, lists, emphasis, and links match the site styling and links open in a new tab.

- **`CalendarPage.tsx`** — The largest module (~2,700 lines) and the most stateful screen. It owns the event list, three view modes (`month`, `week`, `list`), date navigation, search, and the event detail modal.
  - **Data:** hydrates from the calendar cache, otherwise fetches immediately; invalidates the cache before every fetch; subscribes to all `public.events` changes and refetches so live edits and deletes appear.
  - **Date helpers:** deterministic, timezone-safe date construction at noon to avoid DST edge cases; month grids pad with adjacent-month days to at least 35 cells and mark today; week grids start on Sunday and format a range title; `formatTime12h` converts `HH:MM` to a 12-hour label while leaving non-time strings alone.
  - **Navigation:** `activeIndex` is an offset from today's month or week, so the arrows and Today button work identically in every view. Month paging uses a flat three-sheet swipe; week paging uses a 3D coverflow arc; month ⇄ week ⇄ list switches animate as a fold/unfold ("deck of cards") driven by timed phases (`MODE_FOLD_MS`, `MODE_UNFOLD_MS`, `MODE_WEEK_SETTLE_MS`). These transitions dispatch `calendar:transition-start`/`calendar:transition-end` so the canvas background pauses while the layout moves.
  - **Search:** a debounced (350 ms) client-side search over the already-loaded events. `parseSearchDate` accepts ISO dates, `M/D`, month-name + day, and bare day numbers. A match pages or scrolls to the event, sets a highlighted event id and date, and the matching cells/cards get an accent ring.
  - **List view:** two interaction models. Below 640px it is a normal document-scrolling list with a passive, rAF-throttled tracker that highlights the top card without hijacking the scroll. On desktop it is a pager with a depth stack, wheel and vertical swipe gestures (listeners attached only in list mode, so month/week keep native page scrolling), and arrows that scroll the active card under the sticky navbar.
  - **Event details:** selecting an event opens a modal with time, location, description, category, and an "Add to Google Calendar" link built as a Google Calendar template URL with a one-hour default duration.
  - **Structure:** pure helpers and memoized subcomponents (`MonthPreview`, `MonthEventCard`, `MonthDayCell`, `MobileWeekView`, `DesktopWeekView`) sit at module scope so the main component rerenders cheaply. Only `CalendarPage` is exported.

#### Components (`src/components/`)

- **`Navbar.tsx`** — Site header: brand logo link, theme switcher, and the Home/News/Calendar pill navigation with active-route styling. It also implements intent prefetching: hovering or focusing Home/News warms the data cache through a dynamic `import("@/lib/data")`; hovering Calendar calls `preloadCalendar()`, which fetches calendar data *and* starts downloading the `CalendarPage` chunk. The module-level `calendarComponentPromise` export is what `App.tsx` reuses for its lazy route. Prefetching is skipped on touch devices to avoid wasted bandwidth.
- **`ChatWidget.tsx`** — The persistent floating "Ask AI" button. It renders nothing else until opened, listens for the `aiclub:open-chat` window event (used by the home hero), and lazy-loads `ChatPanel` on first open so the AI SDK is never in the initial bundle. The toggle button is rendered outside the dialog wrapper so it always stays bottom-right.
- **`ChatPanel.tsx`** — The chat surface. Uses `useChat({ api: "/api/chat" })` for message state, streaming, and errors; renders user/assistant bubbles, a three-dot "Processing" indicator before the first token, and a typewriter reveal (one character every 33 ms) for assistant text. It tracks completed message ids so older answers are not retyped, queues a submit while a response or the typewriter is still running, disables the send button accordingly, scrolls to the newest message, closes on Escape, and caps input at 1,000 characters. Includes dialog ARIA attributes and an error banner.
- **`ThemeToggle.tsx`** — Theme context and switcher. `ThemeProvider` reads `aiclub-theme` from `localStorage`, defaults to dark, and toggles the `dark`/`light` class on `<html>` inside `useLayoutEffect` so the correct palette exists before paint (no flash). `useTheme()` guards against use outside the provider; `ThemeToggle` renders the sun/moon button with an accessible label.
- **`ThemeBar.tsx`** — Thin wrapper that groups the theme toggle for the navbar and re-exports `ThemeProvider`/`useTheme`, so theme APIs can be imported from either module.
- **`OrganicBackground.tsx`** — Fixed, `aria-hidden` decorative layer behind the app. Composes `SineWaveBackground` with two large ambient gradient glows and a hairline accent line; `pointer-events-none` keeps it from intercepting input.
- **`SineWaveBackground.tsx`** — Canvas animation of eight sine strands over a 2D wave-physics simulation (ping-pong diffusion buffers). Tracks the pointer with smoothing, injects wakes on movement, adds ripples on click/tap, lets the user grab and stretch the nearest strand, and boosts strand speed with cursor velocity. It caps device pixel ratio and simulation grid size, renders at roughly 30 fps, pauses when the tab is hidden or during calendar transitions, re-themes its gradients through a `MutationObserver` on `<html>`, and returns `null` entirely on mobile or when `prefers-reduced-motion` is set. The tuning constants at the top are the intended knobs.
- **`HomeSkeleton.tsx`** — Loading placeholder matching `HomePage`'s geometry: real static labels, functional CTAs, shimmering values only where Supabase data will appear, and a single skeleton line for the vision statement. Uses `role="status"` and screen-reader text.
- **`NewsSkeleton.tsx`** — Placeholder cards shaped like a news row (author pill, date, three body lines). Accepts a `count` so both the route-level Suspense fallback and the in-page loading state reuse it.
- **`CalendarSkeleton.tsx`** — Mirrors the calendar toolbar, weekday header, and a 35-cell month grid, including compact event-card shapes on some cells and the mobile dot row, so the lazy route swap causes no layout shift.

#### UI primitives (`src/components/ui/`)

- **`button.tsx`** — `Button` built on `class-variance-authority` with `default`, `outline`, `secondary`, `ghost`, `link`, and `glass` variants plus `default`/`sm`/`lg`/`icon` sizes. Supports `asChild` through Radix `Slot`, so buttons can wrap Wouter `Link` or `<a>` elements while keeping button styling.
- **`card.tsx`** — Composable `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, and `CardFooter` divs sharing the glass radius, border, and fluid padding tokens.
- **`badge.tsx`** — Small pill label with `default`, `secondary`, `accent`, `destructive`, and `outline` variants; used for news authors and status labels.
- **`input.tsx`** — Styled text input with fluid height, glass background, focus ring, and disabled state; used by the chat composer.
- **`skeleton.tsx`** — Base shimmer block (`animate-pulse` plus the `.skeleton-shimmer` overlay) that every skeleton composes.

#### Data layer (`src/lib/`)

- **`supabase.ts`** — The lightweight half of the Supabase integration, statically imported by pages. It reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, exports `isSupabaseConfigured`, `getSupabaseEnv()`, and the `ClubInfo`, `NewsItem`, and `CalendarEvent` interfaces that mirror the database schema. It deliberately never imports `@supabase/supabase-js`, which is why it is safe in the initial bundle.
- **`supabaseLazy.ts`** — The single dynamic-import target for the heavy Supabase runtime. Creates the client once from the env values (or `null` when unconfigured) and re-exports the configuration flag. Every network caller goes through `await import("./supabaseLazy")`.
- **`data.ts`** — The async data-access layer. Each `prefetch*` function checks the cache, deduplicates concurrent calls through an `inFlight` map, lazily obtains the client, runs a narrow column projection (`club_info` by `id`, the 20 newest `news` rows, the 100 soonest `events`), caches the result, and throws on failure rather than fabricating rows. `prefetchRoute()` maps a path to the right loader. The module is only reached through dynamic imports, so the client and queries stay out of the first paint.
- **`cache.ts`** — Synchronous in-memory cache with a 10-minute TTL (`Map` of `{ data, ts }`). Provides generic `getCached`/`setCached`/`invalidateCache` plus typed home/news/calendar accessors, and lazy prefetch wrappers that `import("./data")` so components can call prefetch helpers without pulling the Supabase client in statically. Pages invalidate entries before force-refreshes and Realtime refetches so stale rows are never served.
- **`utils.ts`** — `cn()`, the `clsx` + `tailwind-merge` helper used by every UI primitive to merge conditional classes without Tailwind conflicts.
- **`vite-env.d.ts`** — Vite client type reference, enabling `import.meta.env` typing.

#### Styling

- **`src/index.css`** — The whole design system in one Tailwind 4 stylesheet. Registers the self-hosted Sora and Space Mono fonts; defines Tailwind theme tokens (canvas/surface colors, accent ramp, text colors, borders, font families); provides `:root`/`.light` custom-property overrides for both themes; implements the glass surfaces (`.glass-panel`, `.glass-button`, `.glass-cell`, `.glass-chip`) with dark/light variants and disables backdrop blur on touch devices for performance; defines the fluid spacing/typography scale (`--fluid-*`, `clamp()` based, tightened on short viewports); and styles the navbar, chat bubbles, calendar cells and list cards, search highlight, page-enter and skeleton-shimmer animations, reduced-motion fallbacks, and the desktop layout that locks the document and scrolls `<main>` instead.

#### Python backend (`backend/`)

- **`backend/__init__.py`** — Empty package marker so `uvicorn backend.main:app` and the `backend.*` imports resolve.
- **`backend/main.py`** — FastAPI application bootstrap. Sets API metadata, adds a request middleware that logs any 404 path (useful for debugging proxy or path mismatches), configures CORS from the comma-separated `FRONTEND_ORIGINS` value (default `http://localhost:3000`, credentials disabled), includes the router from `api.py`, and exposes `/` (service index) and `/health`. Running the module directly starts Uvicorn on `PORT` (default 8000) with reload.
- **`backend/api.py`** — HTTP boundary. `GET /api/club-info`, `/api/news`, and `/api/calendar` proxy the database readers (news and calendar limited to 10 rows). `POST /api/chat` (with and without a trailing slash) accepts either a typed `ChatQuery` or a raw dict; when a `messages` array is present it takes the last message as the query and the rest as history, otherwise it uses `query`/`history`; empty queries return 400; the answer is returned as `{"answer": ...}`. `POST /api/discord-webhook` is the trusted write path: it requires a secret (`WEBHOOK_SECRET` or `DISCORD_BOT_TOKEN`), accepts the token with or without a `Bearer ` prefix, rejects unconfigured (503) or mismatched (401) requests, trims and validates the payload, and inserts through `add_news`. Pydantic models enforce length limits at the edge.
- **`backend/gemini_rag.py`** — The retrieval-augmented generation core. Builds a cache key from the normalized query plus the last history turn and returns a process-lifetime cached answer when present. Resolves the Gemini key from the environment or the server-only `app_secrets` table; assembles context from one `club_info` row, the next 5 events, and the 5 newest news items; and builds a system instruction containing the current date/time, the last 4 conversation turns, the JSON context, and rules for grounding, prompt-injection resistance, no em dashes, a 150-word limit, and a fixed assistant identity. Only the untrusted user query is sent as `contents`, keeping rules and data in the system instruction. It tries `gemini-3.1-flash-lite` and falls back to `gemini-3.5-flash-lite`, then sanitizes output with `clean_thought_tokens` (strips ` thinking`/`<thought>` blocks, `Response:`/`Answer:` markers, and leaked reasoning lines) and caches non-error answers. Because the cache has no TTL, edited club content is not reflected until the process restarts.
- **`backend/sql_db.py`** — Storage adapter with a Supabase-first, SQLite-fallback contract. Loads `.env` from the repo root and `backend/`; creates the Supabase client lazily from `SUPABASE_URL` plus the service-role (or anon) key; and on import creates and seeds `backend/club_data.db` with `club_info`, `news`, and `events` tables when empty. `get_club_info`, `get_news`, `get_calendar`, and `add_news` each try Supabase and silently fall back to SQLite on failure or missing credentials; `get_secret` reads the server-only `app_secrets` table, then the environment. The SQLite schema has no `category` column, so locally served events lack that optional field.
- **`backend/requirements.txt`** — Python dependency list: FastAPI, Uvicorn (standard extras), Pydantic, python-dotenv, `google-genai`, the Supabase client, and Requests.

#### Vercel edge API (`api/`)

- **`api/chat.ts`** — Self-contained edge-runtime chat handler, independent of the Python service. Declares `runtime: "edge"`, normalizes either payload shape into at most 8 messages of at most 1,000 characters, and requires the final message to be from the user. Loads context in parallel from Supabase PostgREST (`club_info` singleton, 5 newest news, 5 soonest events, 25 `info` facts) and falls back to a hard-coded club profile when credentials are missing or a request fails. Resolves the Gemini key from the environment or the `app_secrets` table, then streams a Gemini response with `streamText` (temperature 0.1, 1,024 max tokens) using a grounding-focused system prompt and returns an AI SDK data stream. Returns JSON errors for the wrong method (405), invalid JSON or missing query (400), missing key (503), and model failures (502). Note that this handler includes the `info` table while the Python prompt does not.

#### Supabase (`supabase/`)

- **`supabase/schema.sql`** — Canonical database definition, meant to be pasted into the Supabase SQL Editor. Creates `club_info` (singleton row `club_main` with name, mission, vision, meeting times, rules, contact, Classroom, Instagram, and Discord fields), `news` (id, content, author, timestamp), `events` (id, title, date, time, location, description, plus a `category` column added by an idempotent `alter`), `info` (one AI-quotable fact per row, unique `title`), and `app_secrets` (server-only key/value, intentionally excluded from public grants and policies). Adds timestamp/date indexes, enables RLS on every public table, grants `SELECT` to `anon`/`authenticated`, creates matching read policies, and adds `news` and `events` to the `supabase_realtime` publication. Every statement is idempotent.
- **`supabase/functions/discord-sync/index.ts`** — Deno Edge Function. Handles CORS preflight, accepts only `POST`, compares the raw `Authorization` header to the `DISCORD_BOT_TOKEN` secret (500 when unset, 401 when wrong), validates that `content` and `author` are non-empty strings within 4,000/100 characters, and inserts a generated-id row into `public.news` using the automatically injected service-role credentials. Returns the new id or a JSON error.

#### Scripts (`scripts/`)

These are standalone development/QA utilities, not part of the build or the deployed app.

- **`fit-bezier.mjs`** — Pure-math helper that fits sampled fold-animation frames to the `cubic-bezier(0.4, 0, 0.2, 1)` easing curve to infer the real animation start time and duration. Used when tuning calendar fold timing; prints a best fit and residual RMS.
- **`probe-anchor.mjs`** — Debugging harness that boots a Vite server programmatically on port 5201, stubs Supabase credentials, routes `rest/v1/events` to mock data, drives the calendar through week/list/month, and dumps per-frame `[data-calendar-grid]` row transforms and opacities. Used to diagnose which grid element the validator samples and when the DOM swaps views.
- **`validate-calendar.mjs`** — Browser-based layout and animation validator at 1366×768 and 1440×900. It mocks the events API, drives all three views, measures document/container overflow, row fit, cell pitch, list scroller behavior, and fold/unfold travel and timing, and writes screenshots to `shots/`. Requires Playwright, which is not in `package.json`, so install it locally before running.

#### Public assets (`public/`)

- **`public/fonts/Sora-Regular.woff2`** — Self-hosted body/UI font referenced by `@font-face` and preloaded in `index.html`.
- **`public/fonts/SpaceMono-Regular.woff2`** — Self-hosted monospace font used for labels, dates, and technical accents.
- **`public/peths-ai-club-logo.png`** — Club logo used by the navbar, favicon, Apple touch icon, and Open Graph/Twitter image.
- **`public/favicon.ico`, `public/favicon.png`** — Conventional icon fallbacks for browsers and tools that request the standard paths.
- **`public/llms.txt`** — Plain-text club summary aimed at LLM crawlers and answer engines.
- **`public/robots.txt`** — Allows crawling, disallows `/api/`, and points to the sitemap.
- **`public/sitemap.xml`** — Lists the three public routes (`/`, `/news`, `/calendar`) with change frequency and priority.

#### Documentation and repo hygiene

- **`README.md`** — This document: overview, architecture, stack, setup, scripts, API contract, deployment, and troubleshooting.
- **`DEPLOYMENT_GUIDE.md`** — Step-by-step operations guide for GitHub, Supabase (schema, keys, Edge Function deployment), and Vercel (project import, environment variables, post-deploy checks).
- **`MISC_INFO_SQL.md`** — Reference-only SQL recipes for feeding extra club facts to the AI through the `info` table (or by extending `club_info`). Nothing imports or bundles it; the SQL is pasted into the Supabase editor manually.
- **`SKILL.md`** — Agent skill stub with front-matter and placeholder instructions; not used by the application.
- **Generated or local-only paths:** `node_modules/`, `dist/` (Vite output), `backend/club_data.db` (SQLite fallback), and `*.tsbuildinfo` are build/development artifacts and are gitignored. `.agents/` and `.freebuff/` hold local tooling configuration and are not part of the runtime.

## 4. Tech stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Wouter (routing)
- Framer Motion
- Radix UI primitives
- Lucide React icons
- Supabase JS client
- AI SDK packages

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn
- Google GenAI
- Supabase Python client
- Requests

### Data & AI

- Supabase PostgreSQL
- Realtime subscriptions
- Google Gemini
- RAG-style context grounding around club docs and structured data

## 5. Repository structure

```text
.
├── api/
│   └── chat.ts                  # Vercel edge chat handler (streaming Gemini + Supabase context)
├── backend/
│   ├── __init__.py              # Python package marker
│   ├── api.py                   # FastAPI routes: club-info, news, calendar, chat, Discord webhook
│   ├── gemini_rag.py            # Prompt construction, Gemini call, response cleanup and cache
│   ├── main.py                  # FastAPI app, CORS, request logging, /health
│   ├── requirements.txt         # Python dependencies
│   └── sql_db.py                # Supabase-first / SQLite-fallback data access
├── public/
│   ├── fonts/
│   │   ├── Sora-Regular.woff2
│   │   └── SpaceMono-Regular.woff2
│   ├── favicon.ico
│   ├── favicon.png
│   ├── llms.txt                 # Plain-text club summary for LLM crawlers
│   ├── peths-ai-club-logo.png   # Navbar logo, favicon, Open Graph image
│   ├── robots.txt
│   └── sitemap.xml
├── scripts/
│   ├── fit-bezier.mjs           # Fits fold-animation frames to the easing curve
│   ├── probe-anchor.mjs         # Playwright debugging probe for calendar transitions
│   └── validate-calendar.mjs    # Playwright layout + animation validator
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── skeleton.tsx
│   │   ├── CalendarSkeleton.tsx
│   │   ├── ChatPanel.tsx        # Chat surface, streaming + typewriter
│   │   ├── ChatWidget.tsx       # Floating "Ask AI" launcher and lazy loader
│   │   ├── HomeSkeleton.tsx
│   │   ├── Navbar.tsx           # Navigation, route prefetch, calendar chunk preload
│   │   ├── NewsSkeleton.tsx
│   │   ├── OrganicBackground.tsx
│   │   ├── SineWaveBackground.tsx
│   │   ├── ThemeBar.tsx
│   │   └── ThemeToggle.tsx      # Theme context, persistence, toggle button
│   ├── lib/
│   │   ├── cache.ts             # 10-minute in-memory cache + lazy prefetch facade
│   │   ├── data.ts              # Supabase queries, in-flight dedupe, route prefetch
│   │   ├── supabase.ts          # Env flag + shared types (no client import)
│   │   ├── supabaseLazy.ts      # On-demand Supabase client singleton
│   │   └── utils.ts             # cn() class merge helper
│   ├── pages/
│   │   ├── CalendarPage.tsx     # Month/week/list calendar, search, modal, transitions
│   │   ├── HomePage.tsx         # Hero, schedule, Discord, contact, vision
│   │   └── NewsPage.tsx         # Realtime announcements feed with Markdown
│   ├── App.tsx                  # Shell, routing, lazy routes, global chat widget
│   ├── index.css                # Tailwind theme, glass system, fluid scale, animations
│   ├── main.tsx                 # React root
│   └── vite-env.d.ts
├── supabase/
│   ├── functions/
│   │   └── discord-sync/
│   │       └── index.ts         # Deno Edge Function: Discord message → news table
│   └── schema.sql               # Tables, RLS, grants, indexes, realtime publication
├── .env.example
├── .eslintrc.cjs
├── .gitignore
├── DEPLOYMENT_GUIDE.md
├── MISC_INFO_SQL.md
├── README.md
├── SKILL.md
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

Generated/local-only paths, all gitignored: `node_modules/`, `dist/` (Vite output), `tsconfig.tsbuildinfo` (incremental build cache), and `backend/club_data.db` (local SQLite fallback). `.agents/` and `.freebuff/` hold local tooling configuration and are not part of the runtime.

## 6. Prerequisites

Before starting local development, make sure you have the following installed:

- Node.js 18+ or newer
- npm
- Python 3.10+
- Git
- Access to a Supabase project if you want live content and AI context
- A valid Google Gemini API key if using the AI features locally

## 7. Environment setup

Create a local `.env` file from `.env.example` and fill in your project-specific values.

Example:

```env
# Frontend variables (safe for browser exposure)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_BACKEND_URL=

# Python backend variables (never expose these in browser code)
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_ORIGINS=http://localhost:3000
DISCORD_BOT_TOKEN=your-discord-bot-token
```

Notes:

- `VITE_*` variables are public and should only include safe values for the browser
- `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` must stay private
- The Vercel edge route can also read these values from its deployment environment
- `DISCORD_BOT_TOKEN` should be stored in Supabase Edge Functions settings if using the Discord sync path

## 8. Local development

### Install frontend dependencies

```bash
npm install
```

### Install backend dependencies

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
```

### Start the backend

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The FastAPI app will be available at:

- http://localhost:8000
- health check: http://localhost:8000/health

### Start the frontend

```bash
npm run dev
```

The frontend runs at:

- http://localhost:3000

The Vite config proxies `/api` traffic to the local backend during development so the browser can reach the Python service without manual CORS changes.

## 9. Production build

```bash
npm run build
```

This runs TypeScript checks and produces the static production bundle for deployment.

## 10. Useful scripts

```bash
npm run dev       # start the Vite frontend
npm run build     # type-check and generate a production build
npm run preview   # preview the production build locally
npm run lint      # run ESLint against TypeScript files
npm run format    # format code with Prettier
```

## 11. API interfaces

### Frontend to backend

The application expects the backend to expose club content and chat routes. In development, Vite forwards those requests through `/api`.

### Routes in the FastAPI backend

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/club-info` | GET | Returns club metadata and general site information |
| `/api/news` | GET | Returns recent club announcements/news items |
| `/api/calendar` | GET | Returns event or schedule data |
| `/api/chat` | POST | Accepts a query and optional history, then returns an AI answer |
| `/api/discord-webhook` | POST | Accepts authenticated Discord messages and adds them as news entries |

### Chat payload shape

The chat endpoint accepts either of these payload styles:

```json
{
  "query": "When is the next club meeting?",
  "history": []
}
```

or:

```json
{
  "messages": [
    { "role": "user", "content": "When is the next club meeting?" }
  ]
}
```

The backend normalizes and validates these inputs before passing them to the AI system.

## 12. Data model and content flow

The app relies on structured content stored in Supabase, especially for:

- club metadata
- news/announcements
- calendar events
- general information cards and static content

The schema in `supabase/schema.sql` is the canonical source for the relational data used by the frontend and AI layer.

The general data flow is:

1. Supabase provides structured club content
2. FastAPI or the edge route loads relevant context
3. the AI model receives that context plus the user query
4. the assistant returns a concise, club-specific answer

## 13. Deployment

The project is designed to be deployed in a small but modular stack.

### Recommended deployment pattern

- Vercel: frontend hosting for the React app
- Supabase: database, realtime content, and content management
- FastAPI backend: chat and data endpoints
- Edge function: optional Discord sync and lightweight AI route support

This project also includes a `vercel.json` config and the Vite proxy setup to support front-end delivery and local development smoothly.

## 14. Security and configuration notes

- Keep `.env` files local and do not commit them
- Use server-side environment values only for secrets and private keys
- Do not put long-lived API keys inside the browser bundle
- Treat Discord webhook authorization as sensitive
- Use Supabase access rules and secret scoping to avoid leaking service-role credentials

## 15. Troubleshooting

### Chat returns empty or poor answers

- confirm `GOOGLE_GENERATIVE_AI_API_KEY` is set
- verify Supabase data is populated
- confirm the frontend is pointing at the correct backend route or local proxy

### Frontend cannot reach the backend

- check that the backend is running on port 8000
- verify `VITE_BACKEND_URL` in `.env`
- confirm the Vite dev server is proxying `/api` correctly

### Supabase data is missing

- check your schema in `supabase/schema.sql`
- verify DB table names and your environment values
- ensure you have the correct project URL and anon/service credentials

## 16. Contributing

Contributions are welcome. A typical contributor workflow is:

1. create a feature branch
2. make focused changes in the relevant frontend/backend files
3. validate with the project’s lint/build tools
4. keep documentation updated when behavior or deployment setup changes

## 17. License

This project is intended as a reusable club website and AI assistant codebase for the AI Club. Update the content, branding, and environment configuration to match your deployment context before production use.

## 18. Summary

This repository is more than a static club landing page. It is a small production-ready web application that demonstrates how a modern front-end, a content database, and an AI assistant can work together to support a student organization. The structure is intentionally simple, modular, and easy to extend for more club services, additional pages, and richer AI workflows.

