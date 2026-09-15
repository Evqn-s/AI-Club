# AI Club Website — Project Documentation (`README.md`)

## 1. Overview

The AI Club Website is the official web portal for a student AI Club: it publishes club facts, announcements (news), and event schedules, and embeds an AI assistant chatbot that answers questions about the club using its live data. The system is a three-tier, JavaScript-first architecture built around graceful degradation.

- **Tier 1 — React SPA.** A **React 19 + TypeScript + Vite** single-page app (`src/`, styled with Tailwind CSS v4). It reads club content directly from a **Supabase PostgreSQL** cloud database using a public anon key, caches it in memory with a 10-minute TTL, deduplicates in-flight fetches, and subscribes to **Supabase Realtime** so news and events update live without a page refresh. If Supabase is unreachable or unconfigured, every page falls back to hardcoded offline data in `src/lib/cache.ts`. The entire UI is driven by a **clamp-based fluid responsive system** (`--fluid-*` / `text-fluid-*` tokens in `src/index.css`) so pages scale smoothly from ~320px phones up to ~1600px desktops, and the Calendar page is lazy-loaded on demand (pre-warmed on navbar hover/focus/touch) behind a `Suspense` skeleton.
- **Tier 2 — Python FastAPI service.** `backend/` is the sole chat runtime. The browser sends `{ query, history }` to `VITE_BACKEND_URL` or Vite's local `/api` proxy, and FastAPI calls `gemini_rag.py` with Supabase/SQLite data. There is no browser-side AI SDK or Vercel chat fallback.
- **Tier 3 — Python FastAPI service (`backend/`).** The recommended self-hosted producer of chat and data APIs: a RAG chat endpoint (Google Gemini + Supabase club context), database endpoints (`/api/club-info`, `/api/news`, `/api/calendar`), and a Discord webhook endpoint (`/api/discord-webhook`), backed by Supabase with a local SQLite fallback (`backend/club_data.db`).
- **Discord bridge.** A Supabase Edge Function (`supabase/functions/discord-sync/index.ts`) lets a Discord bot POST announcements straight into the Supabase `news` table, which the frontend instantly renders via Realtime — a second write path (`POST /api/discord-webhook`) goes through the FastAPI service.

The whole stack deploys as: GitHub repo → Vercel (hosting the built SPA + `/api/chat` Edge Function) + Supabase (database, realtime, discord-sync function), as detailed in `DEPLOYMENT_GUIDE.md`.

---

## 2. Repository Root — Project Configuration & Entry Point

**Section Overview:** This section holds the build, type, lint, deployment, and secret configuration that wires every other section together. Nothing here contains application logic; instead these files define how the frontend is bundled (`vite.config.ts`, `index.html`), how TypeScript/ESLint validate code, how Vercel serves the app in production (`vercel.json`), and which credentials each tier reads (`.env`). The root also hosts the two human-oriented documents (`DEPLOYMENT_GUIDE.md`, `SKILL.md`).

### File Breakdown

- **`package.json`** — Node/npm manifest. Declares the React/Vite toolchain, Supabase client, Framer Motion, Radix UI, class utilities, icons, Tailwind, TypeScript, and the project scripts. Chat inference runs in Python and is intentionally absent from the frontend dependency graph.
- **`package-lock.json`** — Lockfile pinning exact dependency versions for reproducible installs; no logic, consumed only by npm. Keep it in git so `npm ci` works.
- **`index.html`** — The single HTML entry point that Vite injects the bundle into. Loads Google Fonts (Inter, Plus Jakarta Sans), sets the page title (`AI Club Portal`) and meta description, the initial dark-mode body colors, and the `#root` div plus `/src/main.tsx` module script. In production builds it is transformed and emitted into `dist/index.html`.
- **`vite.config.ts`** — Vite build configuration. Registers the React and Tailwind v4 plugins, defines the `@/*` → `./src/*` path alias (matching `tsconfig.json` `paths`), sets dev port 3000, and proxies `/api/*` to `http://127.0.0.1:8000` during development so the chat widget's `/api/chat` calls reach the local FastAPI service (mirroring the production route).
- **`tsconfig.json`** — TypeScript compiler config for `src` and `api` (strict mode, `bundler` module resolution, `@/*` path mapping). Paired with the `build` script's `tsc -b` for type-checking before bundling.
- **`tsconfig.tsbuildinfo`** — Incremental build cache artifact produced by `tsc -b`; safe to delete, not hand-edited.
- **`vercel.json`** — Static Vercel hosting configuration. Rewrites browser routes to `/index.html` and does not host an API function.
- **`.env`** *(local, git-ignored)* and **`.env.example`** — Frontend uses `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_BACKEND_URL`. FastAPI uses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `FRONTEND_ORIGINS`, and the webhook secret. `DISCORD_BOT_TOKEN` remains a Supabase Edge Function secret.
- **`.eslintrc.cjs`** — ESLint config (TypeScript parser, `eslint:recommended` + `@typescript-eslint/recommended` + Prettier). Backs the `npm run lint` script for all `.ts/.tsx` files.
- **`.gitignore`** — Excludes `node_modules/`, `dist/`, `.env`/`.env.*`, `.vercel/`, `.supabase/`, `supabase/.temp/`, `*.tsbuildinfo`, and Python artifacts (including `backend/club_data.db`) so secrets, build outputs, and the dev SQLite database stay out of GitHub.
- **`DEPLOYMENT_GUIDE.md`** — Step-by-step operator manual for the three deployment targets (GitHub, Supabase, Vercel), including SQL setup and environment-variable placement.
- **`SKILL.md`** — A template-style agent/skill instruction file for this project; currently a scaffold ("first step / additional step" placeholders) with no active logic.
- **`.vscode/extensions.json`** — VS Code workspace manifest whose standard role is recommending extensions when the workspace opens; it is present but empty/optional and affects nothing at build time.---

## 3. `src/` — React Frontend Application Core

**Section Overview:** The browser tier. These root files bootstrap the SPA, define routing and layout, and establish the Tailwind theme and fluid responsive system. The chat panel calls FastAPI through `VITE_BACKEND_URL` or the local `/api` proxy.

### File Breakdown

- **`src/main.tsx`** — Bootstrap entry. Mounts `<App />` inside `React.StrictMode` into `index.html`'s `#root` and imports the global stylesheet. Nothing else in `src/` runs until this executes.
- **`src/App.tsx`** — Application shell and router. Wraps the tree in `ThemeProvider`, renders the global `OrganicBackground`, sticky `Navbar`, a `wouter` `<Switch>` mapping `/` → `HomePage`, `/news` → `NewsPage`, `/calendar` → lazy `CalendarPage` (inside `Suspense` with a `CalendarSkeleton` fallback), plus a 404 route, and the always-mounted floating `ChatWidget`. The calendar route widens the content container (`max-w-[min(98vw,1440px)]`) so the grid has room to breathe. `CalendarPage` is imported lazily via `React.lazy()`, consuming a module-level import promise that `Navbar.preloadCalendar()` warms on hover/focus/touch (or falling back to an on-demand `import()`). On mount, a 250 ms idle timer calls `prefetchRoute` for all three routes so first navigation is instant.
- **`src/index.css`** — Global stylesheet and design system. Imports Tailwind and declares the custom `@theme` palette (canvas/surface greys, crimson accent ramp `#2A1215` → `#E0A3AA`, text/border tokens, display/sans fonts), `:root`/`:root.light` variables, and a global 150 ms color-transition default. Its centrepiece is the **fluid responsive scaling system**: an `html { font-size: clamp(...) }` root so every `rem`-based Tailwind class scales, plus `--text-fluid-*` type tokens (hero, h1–h3, body, small, label) and `--fluid-*` layout tokens (container widths, padding, section rhythm, stacks, gaps, radii, icon boxes) — each a `clamp(min, fluid, max)` — with `@utility text-fluid-*` / `container-fluid` helpers consumed throughout. The rest is aggressive light-mode overrides that repaint dark-mode utilities (red borders → blue `#2563EB`, dark surfaces → white, red selection → blue, typing/thinking dots → blue, title glows neutralized) keyed off the `html.light` class that `ThemeToggle` toggles, plus calendar specifics: `[data-page="calendar"]` **kills all color transitions** so dark ⇄ light switching is paint-instant (Framer Motion transform animations stay intact), theme-aware `.cal-nav-arrow` buttons, and light-mode tints for calendar cards/rings/glows/search-match badges. Small screens get `--fluid-icon-box: 2.75rem` (44 px touch targets) below 640 px, and a reduced-motion / ≤320 px media query shrinks the root font.
- **`src/vite-env.d.ts`** — One-line Vite ambient type reference (`vite/client`), enabling `import.meta.env` typing used by `src/lib/supabase.ts`.

---

## 4. `src/pages/` — Route-Level Page Components

**Section Overview:** One component per route, rendered by `App.tsx`'s `<Switch>`. Pages initialize from the in-memory cache, refresh through the data layer, subscribe to Supabase Realtime where relevant, and render skeleton/empty/error/list states with shared UI primitives.

### File Breakdown

- **`src/pages/HomePage.tsx`** — Route `/`. Renders the giant club-name hero (from `club_info.club_name`), a **View Schedule** CTA (a `wouter` link that prefetches the calendar route on hover/focus/touch) and an **Ask AI** button that opens the chat widget by dispatching the `aiclub:open-chat` `CustomEvent`, a two-card grid (Regular Meetings schedule; Get in Touch with email/Google Classroom/Instagram links pulled from `club_info`), and the vision statement read from `club_info.vision` (falling back to `mission`, then the hardcoded line). Reads only `getCachedHome`/`prefetchHome`/`fallbackClubInfo`; shows `Skeleton`s while `prefetchHome` resolves. All spacing uses the fluid `--fluid-*` tokens.
- **`src/pages/NewsPage.tsx`** — Route `/news`. Lists announcement cards (author `Badge`, date, content) from the Supabase `news` table via `prefetchNews`/`getCachedNews`, with `fallbackNews` for offline mode. Subscribes to a `postgres_changes` channel (`realtime-news`, event `INSERT` on `news`), prepending new rows to both state and cache in real time and unsubscribing on unmount. Includes an explicit error banner with a Retry button that calls `invalidateCache("news")` and refetches. Uses the fluid `--fluid-container-narrow` wrapper (with `--fluid-pad-x`) so the feed scales with the viewport instead of sitting in a fixed narrow column.
- **`src/pages/CalendarPage.tsx`** — Route `/calendar`. A full month/week event calendar — the biggest component in the repo — with: a **Month ⇄ Week view switcher** animated with Framer Motion "Depth Zoom / Parallax Dive" transitions; a **cylindrical Coverflow Arc** that slides prev/next periods as 3D tilted sheets with a spring while keeping the center sheet interactive; **live database search** (350 ms debounce) that parses dates flexibly (`"15"`, `"15th"`, `"Sep 15"`, `"9/15"`, `"2026-09-15"`) and otherwise queries Supabase **title-first** (`ilike`) then description/location (`or`), navigating to and highlighting the match (with a "Match" badge) — falling back to in-memory events when offline; **date steppers** (prev/today/next), **swipe navigation** (touch + drag/trackpad pan) and **mouse-wheel paging** on desktop (≥ 1024 px); **one-click "Add to Google Calendar" export links** generated from each event (`generateGoogleCalendarUrl`); and a shared **event-detail modal** (date/time/location/description plus export/close, Esc to dismiss). Data comes from the Supabase `events` table via `prefetchCalendar`/`getCachedCalendar` (fallback: five `fallbackEvents`, each tagged with a `category` such as Meeting/Workshop/Hackathon/Research/Speaker); a `realtime-events-only` channel re-fetches on **any** `events` mutation; failures show an offline banner with Retry; and an empty/loading state renders `CalendarSkeleton`. The root element carries `data-page="calendar"`, which `src/index.css` uses to disable color transitions for paint-instant theme switching, and sheet transitions pause the sine-wave background via `calendar:transition-start`/`end` window events.
---

## 5. `src/components/` — Shared Layout & Feature Components

**Section Overview:** Reusable presentational and behavioral components mounted by `App.tsx` and the route pages. `Navbar` owns route prefetching, while `ChatWidget` opens the FastAPI-backed chat panel.

### File Breakdown

- **`src/components/Navbar.tsx`** — Sticky top bar. Uses `wouter`'s `useLocation` for active-link styling and re-orders its children responsively: on mobile the brand pill and a larger `ThemeBar` button sit in the top row while the nav pills wrap onto their own centered full-width row (with clamp-based 44 px touch targets); on desktop the pills return to the right-aligned inline group at their original sizes. Hover/focus/touch on a link calls `prefetchRoute(link.href)`; because the Calendar page is lazy, the calendar link additionally calls `preloadCalendar()`, which (1) prefetches the Supabase calendar data into `lib/cache` and (2) starts the module `import("../pages/CalendarPage")` immediately, storing the promise in the exported `calendarComponentPromise` that `App.tsx` feeds to `React.lazy()`.
- **`src/components/ThemeToggle.tsx`** — Theme state owner and toggle UI. Exports `ThemeProvider` (a React context persisting `"dark" | "light"` to `localStorage` under `aiclub-theme` and toggling the `dark`/`light` classes on `<html>`), `useTheme`, and the `ThemeToggle` Sun/Moon pill button (fluid icon sizing). It is the *only* source of the `html.light` class that `src/index.css` and `SineWaveBackground.tsx` key off — the coupling point for the entire light-mode design.
- **`src/components/ThemeBar.tsx`** — Thin wrapper that re-exports `ThemeProvider`/`useTheme` from `ThemeToggle.tsx` and renders the theme switcher as an ARIA-labeled group. It no longer owns theme state (that lives in `ThemeToggle.tsx`); kept as a separate file so `Navbar` has a single bar-shaped import.
- **`src/components/ChatWidget.tsx`** — The AI assistant shell. It lazy-loads `ChatPanel`, which sends typed `{ query, history }` requests directly to FastAPI and retains the per-character typewriter reveal, processing state, error state, cooldown, keyboard close, and focus behavior.
- **`src/components/OrganicBackground.tsx`** — Thin composition wrapper for the fixed, non-interactive (`pointer-events-none`) background layer: mounts `SineWaveBackground` plus a top "perimeter accent line" gradient. Exists purely so `App.tsx` can mount one decorative unit.
- **`src/components/SineWaveBackground.tsx`** — Canvas animation drawing 10 layered sine/cosine ribbon strands with depth-based amplitude, color, and glow. It honors reduced motion, handles DPR-aware resizing, switches palettes through the theme observer, and pauses during calendar sheet transitions.
- **`src/components/CalendarSkeleton.tsx`** — Skeleton layout that mirrors the calendar chrome while the lazy import resolves or data loads: header block, search + view-switcher control bars, date-stepper row, a 7-column weekday header, and a 5×7 day grid of pulsing placeholder blocks. Rendered by `App.tsx` as the `Suspense` fallback and by `CalendarPage` while loading with no cached data.

### Subsection: `src/components/ui/` — Primitive UI Building Blocks

**Subsection Overview:** shadcn/ui-style primitives shared by pages and `ChatWidget`. All five files import the `cn` helper from `src/lib/utils.ts` to merge custom classes with variant defaults; `button.tsx` and `badge.tsx` additionally use `class-variance-authority` for variants. They are leaf nodes: nothing in `ui/` imports outside `lib/utils` (plus Radix for `Button`), so the app has no circular dependency through them.

- **`ui/button.tsx`** — `Button` with `cva` variants (default/outline/secondary/ghost/link) and sizes, `asChild` slot support via `@radix-ui/react-slot` (used to wrap `wouter` `Link`s on HomePage). Consumed by all three pages and `ChatWidget`.
- **`ui/card.tsx`** — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` family used by HomePage and NewsPage layouts.
- **`ui/badge.tsx`** — `Badge` label chip (default/secondary/destructive/outline variants); used for the news author tags.
- **`ui/input.tsx`** — Styled text `Input`; used by the ChatWidget message form.
- **`ui/skeleton.tsx`** — Pulsing placeholder `Skeleton` shown by the pages while data loads and reused by `CalendarSkeleton`.

---

## 6. `src/lib/` — Client Data Layer & Utilities

**Section Overview:** The frontend's non-UI engine room. `supabase.ts` owns the typed database client, `cache.ts` owns caching/prefetch/fallback data and is the *only* module the pages use for data access, and `utils.ts` provides the class-merge helper used by every UI primitive. This section is the frontend's gateway to Supabase (the same database defined by `supabase/schema.sql`) and deliberately contains no React so it can be imported from anywhere.

### File Breakdown

- **`src/lib/supabase.ts`** — Database client factory and shared types. Reads `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from Vite env, exports `supabase` (or `null`) and the `isSupabaseConfigured` flag, and defines the `ClubInfo`, `NewsItem`, and `CalendarEvent` interfaces that mirror the Supabase tables — `CalendarEvent` now includes an optional `category?: string` field. Every other consumer (`cache.ts`, `NewsPage.tsx`, `CalendarPage.tsx`) imports these types/client from here.
- **`src/lib/cache.ts`** — Caching + data access layer. Holds hardcoded offline defaults — `fallbackClubInfo`, two `fallbackNews`, and **five `fallbackEvents`** (General Meeting, Hackathon Prep & Team Formation, AI Workshop: Neural Networks 101, AI Research Paper Discussion, Industry Speaker), each carrying a `category` (Meeting/Hackathon/Workshop/Research/Speaker). Provides a module-level `Map` cache with a 10-minute TTL (`getCached`/`setCached`/`invalidateCache`), an in-flight promise dedup (`inFlight`), per-route accessors (`getCachedHome` etc.), and the `prefetchHome/News/Calendar` functions that query Supabase via `supabase.ts` and fall back to the static data on any error. `prefetchRoute(route)` maps a URL to the right prefetcher; it is invoked by `App.tsx` on idle startup and by `Navbar`/`HomePage` on link hover/focus/touch. This file is the single dependency shared by all three pages and both navigation components.
- **`src/lib/utils.ts`** — One-liner `cn()` helper combining `clsx` + `tailwind-merge`. Imported by all five `components/ui/` files; has no other coupling.
---

## 7. `backend/` — Python FastAPI Service

**Section Overview:** FastAPI is the sole chat runtime. The browser posts `{ query, history }` to `VITE_BACKEND_URL` or Vite's local `/api` proxy. FastAPI calls `gemini_rag.py`, which reads Supabase first and SQLite second.

---

## 8. `backend/` — Python FastAPI Service (Self-Hosted Tier)

**Section Overview:** The Python backend owns chat and data APIs. Its layers are `main.py` (app/CORS/lifecycle) → `api.py` (routes/validation/auth) → `sql_db.py` (Supabase-first data access with SQLite fallback) → `gemini_rag.py` (prompt and answer generation). Vite proxies `/api` locally; production uses `VITE_BACKEND_URL`.

### File Breakdown

- **`backend/__init__.py`** — Empty package marker that makes the folder importable as `backend.*` (required because `main.py`, `api.py`, `gemini_rag.py`, and `sql_db.py` import each other via `from backend.xxx import ...`, and uvicorn loads `backend.main:app`).
- **`backend/main.py`** — FastAPI app factory with restricted CORS from `FRONTEND_ORIGINS`, health endpoint, and uvicorn entry point.
- **`backend/api.py`** — HTTP routes and Pydantic validation. `POST /api/chat` returns JSON `{ "answer": ... }`; the webhook fails closed without a configured secret and enforces payload limits.
- **`backend/sql_db.py`** — Data access layer with dual backends. Loads `.env` from the repo root or `backend/`, lazily creates a Supabase client (service-role key preferred) and, for every operation (`get_club_info`, `get_news`, `get_calendar`, `add_news`, `get_secret`), tries Supabase first and silently falls back to local SQLite (`club_data.db`) on failure. `init_local_db()` runs at import time to create/seed the `club_info`, `news`, and `events` SQLite tables (same shape as `supabase/schema.sql`) with default rows. `get_secret` additionally falls back to `os.getenv`, providing the Gemini key lookup used by `gemini_rag.py`.
- **`backend/gemini_rag.py`** — RAG answer generator. Resolves the Gemini API key (env → `sql_db.get_secret`), assembles context from `sql_db` (`club_info`, 5 events, 5 news), formats the last 4 history turns, and builds a club-assistant prompt (strictly use context, ≤ 150 words, no em dashes, admit unknowns), then calls `google-genai` `generate_content` on `gemini-3.1-flash-lite` and returns the text. Called only by `api.py`.
- **`backend/requirements.txt`** — Python dependency pins (`fastapi`, `uvicorn`, `pydantic`, `python-dotenv`, `google-genai`, `supabase`, `requests`) for `pip install -r`.
- **`backend/club_data.db`** — Generated SQLite database file (runtime artifact of `init_local_db`); git-ignored, safe to delete and recreate.
- **`backend/__pycache__/`** — Compiled bytecode artifacts; never edited by hand.
---

## 9. `supabase/` — Cloud Database Schema & Edge Function

**Section Overview:** Everything that runs inside Supabase rather than in the browser or Python process. `schema.sql` defines the PostgreSQL contract used by the frontend and backend, while the Discord Edge Function provides the announcement write path.

### File Breakdown

- **`supabase/schema.sql`** — Database definition and seed. Creates `public.club_info` (single row `club_main`: name, mission, meeting times, rules, contact email, Google Classroom code/URL, Instagram handle/URL), `public.news` (id, content, author, timestamp; descending timestamp index), and `public.events` (id, title, date, time, location, description; ascending date index); inserts the default `club_info` row; enables Row Level Security; and grants public read-only (`select`) policies for `anon`/`authenticated` on all three tables — exactly matching the frontend's anon-key queries and the `ClubInfo`/`NewsItem`/`CalendarEvent` interfaces. Note: the frontend now models an optional `category` string on events (the offline fallback data is tagged Meeting/Workshop/Hackathon/Research/Speaker); the shipped schema leaves that column off `public.events`, so add `category text` via a migration only if you want DB-sourced categories. (`app_secrets` reads and `news` writes use the service-role key, which bypasses RLS.)
- **`supabase/functions/discord-sync/index.ts`** — Deno Edge Function that lets a Discord bot publish announcements. Handles CORS preflight, accepts only POST, validates the `Authorization` header against the `DISCORD_BOT_TOKEN` secret, validates/limits the JSON body (`content` ≤ 4000 chars, `author` ≤ 100 chars), then uses Supabase's auto-injected `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to insert a `msg_<timestamp>` row into `public.news`. That insert instantly reaches browsers via the Realtime subscription in `NewsPage.tsx`. The header comment documents deployment (`supabase functions deploy discord-sync`) and bot setup.
- **`supabase/.temp/`** — Supabase CLI working files (linked project ref, migration/storage versions, pooler URL, etc.) generated by `supabase link`/`init`; git-ignored local metadata only, not application code.

---

## 10. `dist/` — Production Build Output (Generated)

**Section Overview:** The static bundle produced by `npm run build` (tsc type-check + Vite build) and uploaded to Vercel. Entirely derived: `dist/index.html` is the transformed root `index.html` referencing hashed assets, and `dist/assets/` holds the content-hashed CSS and JS chunks containing all of `src/` (the lazy-loaded Calendar page is split into its own chunk). Never hand-edited; delete and rebuild at any time. Vercel serves these files and falls back to `dist/index.html` for unknown paths per `vercel.json`'s SPA rewrite.

- **`dist/index.html`** — Built HTML entry referencing the hashed asset files.
- **`dist/assets/index-*.css` / `dist/assets/index-*.js` / `dist/assets/CalendarPage-*.js`** — Hashed Tailwind stylesheet and bundled application JS (React + pages + components + lib), with the calendar page isolated into its own lazy chunk.

---

## 11. End-to-End Interaction Flows (How Sections Connect)

1. **Page content flow:** `main.tsx` → `App.tsx` routes → a page in `src/pages/` → `src/lib/cache.ts` (cache/prefetch, in-flight dedup, TTL) → `src/lib/supabase.ts` → Supabase tables from `supabase/schema.sql`. Failure or unconfigured Supabase → hardcoded fallbacks in `cache.ts`. `Navbar.tsx`/`App.tsx`/`HomePage.tsx` warm the cache via `prefetchRoute` before navigation.
2. **Calendar page flow (lazy):** hovering/focusing/touching the Calendar nav pill fires `preloadCalendar()` in `Navbar.tsx` — it prefetches `/calendar` data into `cache.ts` **and** starts `import("../pages/CalendarPage")`, storing the promise in `calendarComponentPromise`. `App.tsx`'s `React.lazy(() => calendarComponentPromise || import(...))` consumes that promise (or imports on click), rendering `CalendarSkeleton` inside `Suspense` until the chunk is ready; `CalendarPage` then hydrates from cache and subscribes to `realtime-events-only` for live updates.
3. **Chat flow:** `ChatPanel.tsx` sends `{ query, history }` to FastAPI → `gemini_rag.py` → `sql_db.py` (Supabase/SQLite) → Gemini. The JSON answer drives the existing client-side typewriter and cooldown.
4. **Local chat flow:** `vite.config.ts` proxies `/api/*` to `127.0.0.1:8000`.
5. **Announcement publishing flow:** Discord bot → `supabase/functions/discord-sync/index.ts` (token check) → insert into `public.news` → Supabase Realtime → `NewsPage.tsx` subscription updates the list and `src/lib/cache.ts` instantly. (Alternative: bot → `POST /api/discord-webhook` on the FastAPI service with a Bearer token → `backend/sql_db.py: add_news` → same table.)
6. **Theming flow:** `ThemeToggle.tsx`'s `ThemeProvider` toggles `html.light`/`html.dark` + `localStorage` (`aiclub-theme`) → `src/index.css` overrides repaint the UI (the calendar page has transitions disabled for a paint-instant switch) and `SineWaveBackground.tsx` swaps its palette per-frame. During calendar sheet transitions the sine wave pauses on `calendar:transition-start`/`end` window events, while Framer Motion transforms continue unaffected.

---

## 12. Environment Variable Cheat Sheet

| Variable | Set where | Consumed by |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env` (public — safe in the bundle) | `src/lib/supabase.ts` and `backend/sql_db.py` |
| `VITE_BACKEND_URL` | `.env` (public) | `src/components/ChatPanel.tsx` |
| `GOOGLE_GENERATIVE_AI_API_KEY` (or legacy `GEMINI_API_KEY`) | FastAPI env or Supabase `app_secrets` | `backend/gemini_rag.py` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server `.env` (FastAPI host) | `backend/sql_db.py`; auto-injected into the `discord-sync` Edge Function |
| `FRONTEND_ORIGINS` | FastAPI env | `backend/main.py` CORS policy |
| `DISCORD_BOT_TOKEN` | Supabase Edge Function secrets | `supabase/functions/discord-sync/index.ts` |
| `WEBHOOK_SECRET` (falls back to `DISCORD_BOT_TOKEN`) | Backend `.env` | `backend/api.py` (`POST /api/discord-webhook`) |

*Generated artifacts (safe to ignore/delete): `tsconfig.tsbuildinfo`, `backend/__pycache__/`, `backend/club_data.db`, `supabase/.temp/`, `dist/`. Keep `package-lock.json` for reproducible `npm ci` installs.*
