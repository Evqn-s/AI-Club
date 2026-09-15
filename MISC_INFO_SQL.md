# Misc Info → AI Knowledge: SQL Guide

**Status:** Reference document only. Nothing here is imported, bundled, or routed —
it does not affect the build. The SQL is meant to be pasted into the Supabase SQL
Editor (Dashboard → SQL Editor → New query).

---

## TL;DR

**Yes for `info` and `club_info`.** It depends on *where* you insert:

| What you insert | Will the AI read it? | Code change needed? |
| --- | --- | --- |
| New rows in **`info`** | **Yes**, automatically (up to 25) | **None** |
| A **new column** on `club_info` | **Yes**, automatically | **None** |
| An **updated row** on `club_info` | **Yes**, automatically | **None** |
| New rows in `news` | Yes, but only the **5 most recent** | None |
| New rows in `events` | Yes, but only the **5 soonest** | None |
| Any **other new table** (e.g. `misc_info`) | **No** — invisible to the AI | **Yes** (see Option B) |
| Arbitrary SQL (`CREATE FUNCTION`, etc.) | **No** | **Yes** |

So: for "who built this website" style information, **use the `info` table** (section
below). It is pure SQL with zero code changes and it works immediately.

---

## How the AI actually reads your database

The chat endpoint is `api/chat.ts` (a Vercel Edge Function). It does not do RAG,
embeddings, or semantic search. It runs **four fixed queries**, stringifies the
results, and pastes them into the Gemini system prompt.

`api/chat.ts`, lines 269-280:

```ts
const [clubInfoRes, infoRes, newsRes, eventsRes, secretRes] = await Promise.all([
  supabase.from("club_info").select("*").single(),
  supabase.from("info").select("title, description").order("title", { ascending: true }).limit(25),
  supabase.from("news").select("*").order("timestamp", { ascending: false }).limit(5),
  supabase.from("events").select("*").order("date", { ascending: true }).limit(5),
  supabase.from("app_secrets").select("value").eq("key", "GOOGLE_GENERATIVE_AI_API_KEY").single(),
]);

if (clubInfoRes.data) clubContext.club_info = clubInfoRes.data;
if (infoRes.data && infoRes.data.length > 0) clubContext.info = infoRes.data;
if (newsRes.data && newsRes.data.length > 0) clubContext.news = newsRes.data;
if (eventsRes.data && eventsRes.data.length > 0) clubContext.calendar = eventsRes.data;
```

That object is then injected into the prompt at line 326:

```ts
Club Context Data:
${JSON.stringify(clubContext, null, 2)}
```

### The facts that matter

1. **`club_info` is queried with `select("*")`.** PostgREST expands `*` to every
   column in the table. So **any column you add to `club_info` is picked up
   automatically** — no code change, no deploy. This is the whole reason
   Option A works.
2. **`club_info` uses `.single()`,** which demands **exactly one row**. More on
   this in the Gotchas section — it is the one way to accidentally break the
   whole thing.
3. **The `info` table is queried with `select("title, description")`.** Each row
   is one miscellaneous fact, and they are all sent to the model (up to 25,
   ordered by title). Insert a row and the AI can read it on the next message
   with **no code change, no deploy**.
4. **The other tables are also sent** — `news` (5 most recent) and `events` (5
   soonest) — but only those fixed counts.

---
## Option (legacy) — Extend `club_info` with columns

Because the AI queries `club_info` with `select("*")`, every column you add here
lands in the AI's context on the very next chat message. No deploy, no rebuild.

### Step 1 — Paste this into the Supabase SQL Editor

Replace the `<< ... >>` placeholders with your real answers before running.
Every statement is idempotent (`if not exists` / `where id = 'club_main'`), so
re-running it is harmless.

```sql
-- ============================================================
-- OPTION A: misc club info for the AI assistant
-- Adds columns to the existing club_info row. Safe to re-run.
-- ============================================================

alter table public.club_info
  add column if not exists built_by            text,
  add column if not exists website_credits     text,
  add column if not exists founded_year        text,
  add column if not exists member_count        text,
  add column if not exists meeting_location    text,
  add column if not exists dues                text,
  add column if not exists discord_url         text,
  add column if not exists faq                 jsonb default '[]'::jsonb,
  add column if not exists misc_notes          text;

-- Fill in the values. UPDATE (never INSERT) keeps the row count at exactly 1,
-- which .single() requires.
update public.club_info
set
  built_by         = '<< Full name / handle of the site author >>',
  website_credits  = '<< e.g. Built by the AI Club Web Team. Source at github.com/Evqn-s/AI-Club >>',
  founded_year     = '<< e.g. Founded in 2024 >>',
  member_count     = '<< e.g. About 40 active members >>',
  meeting_location = '<< e.g. Room 101 >>',
  dues             = '<< e.g. No dues; free to join >>',
  discord_url      = '<< e.g. https://discord.gg/xxxxxx >>',
  misc_notes       = '<< Anything else the AI should know >>',
  faq              = '[
    {"q": "Who built this website?",  "a": "<< answer >>"},
    {"q": "How do I join the club?",  "a": "<< answer >>"},
    {"q": "Do I need experience?",    "a": "<< answer >>"}
  ]'::jsonb
where id = 'club_main';

-- PostgREST caches the table schema. Tell it to re-read so the new columns
-- become queryable immediately instead of after the next cache expiry.
notify pgrst, 'reload schema';
```

### Step 2 — Verify

```sql
-- Should return exactly 1 row with your new columns populated
select id, built_by, website_credits, faq, misc_notes
from public.club_info;
```

answer from `built_by` / `website_credits`.

### Why this works (and why nothing else is needed)

| Link in the chain | Detail |
| --- | --- |
| Query | `api/chat.ts:267` → `from("club_info").select("*").single()` |
| `select("*")` | PostgREST expands to **all** columns, including ones added later |
| Prompt injection | `api/chat.ts:314` → `JSON.stringify(clubContext, null, 2)` |
| Grants | New columns inherit the table-level `grant select on public.club_info` — **no extra grant needed** |
| RLS | The existing `"Public read club_info"` policy is row-level and applies to the whole row, so new columns are readable |

### Do NOT put secrets in `club_info`

`club_info` is publicly readable: RLS is `using (true)` for `anon`, and the anon
key ships in the client bundle. Keep API keys, passwords, and anything private in
`app_secrets` (which has no public read policy). Misc club trivia is fine here.

---

## Option B — Dedicated `misc_info` table (requires a code change)

**You do not need this — the `info` table above is recommended and already wired.
Choose Option B only if you want a differently-named or differently-shaped fact
store (e.g. with `topic` + `question` + `answer` columns). It requires editing
`api/chat.ts` and redeploying.

Want a differently-named table? The `info` table above is already wired, so this
is only useful if you insist on a different schema. A new table is **invisible to the
AI until you also edit `api/chat.ts`** to query it. The SQL is only half the work.

### Step 1 — Create the table

```sql
-- ============================================================
-- OPTION B: standalone misc fact store for the AI
-- Safe to re-run.
-- ============================================================

create table if not exists public.misc_info (
  id         text        primary key default gen_random_uuid()::text,
  topic      text        not null,   -- short label, e.g. 'Website Authorship'
  question   text,                   -- optional: phrasing users may ask
  answer     text        not null,
  updated_at timestamptz not null default now()
);

create index if not exists misc_info_topic_idx on public.misc_info (topic);

alter table public.misc_info enable row level security;

-- Table-level grant covers every column, present and future
grant select on public.misc_info to anon, authenticated;

drop policy if exists "Public read misc_info" on public.misc_info;
create policy "Public read misc_info"
  on public.misc_info for select
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
```

### Step 2 — Insert the facts

```sql
insert into public.misc_info (topic, question, answer) values
  ('Website Authorship', 'Who built this website?',
   '<< answer >>'),
  ('Getting Started',    'How do I join the club?',
   '<< answer >>');
```

### Step 3 — Wire it into `api/chat.ts` (REQUIRED)

This is what actually makes the table readable by the AI. Without it, the table is
never queried and nothing changes.

1. Widen the context type near line 236 so TypeScript accepts the new key:

```diff
  let clubContext = {
+   misc: [] as { topic: string; question: string | null; answer: string }[],
    club_info: {
```

2. Add the query to the `Promise.all` array near line 269:

```diff
- const [clubInfoRes, infoRes, newsRes, eventsRes, secretRes] = await Promise.all([
+ const [clubInfoRes, infoRes, newsRes, eventsRes, miscRes, secretRes] = await Promise.all([
    supabase.from("club_info").select("*").single(),
+   supabase.from("misc_info").select("topic,question,answer").limit(20),
    ...
  ]);
```

3. Surface it in the context object near line 280:

```diff
  if (clubInfoRes.data) clubContext.club_info = clubInfoRes.data;
+ if (miscRes.data && miscRes.data.length > 0) clubContext.misc = miscRes.data;
  ...
```

4. Commit and let Vercel redeploy. `api/chat.ts` is a serverless function, so
**a new table always needs a deploy — the already-wired `info` table does not.**
```

---

## Gotchas

1. **Never `INSERT` a second `club_info` row.** `api/chat.ts:269` calls `.single()`,
   which errors when the query matches zero or more than one row. If that call
         fails, `clubInfoRes.data` is `null` and **the whole `club_info` context silently
   falls back to the hardcoded defaults** at lines 237-243, so real club data
   disappears from the AI with no visible error. Always
   `UPDATE ... WHERE id = 'club_main'`. Confirm with
   `select count(*) from public.club_info;` which must return exactly 1.
2. **`notify pgrst, 'reload schema'` matters.** Supabase's API layer (PostgREST)
   caches table schemas. Without the notify, `select("*")` may keep returning the
   old column set until the cache expires. If a new field never shows up, re-run
   that single line.
3. **Keep the values short.** `info` is re-sent to Gemini on every chat message
   (line 326). A few hundred characters per fact is free; long essays cost tokens
   on every request.
4. **`club_info` is world-readable.** RLS is `using (true)` for `anon`, and the
   anon key ships in the client bundle, so anything stored here is effectively
   public. Secrets belong in `app_secrets`, which has no public read policy.
5. **`updated_at` does not refresh on `UPDATE`.** In the current schema the
   default applies only on `INSERT` and there is no trigger. Harmless, but do not
   treat it as an audit trail.
6. **If the AI answers "I don't have that information"**, the value did not reach
   the prompt. Check in order: the row actually updated, the column exists, the
   grant and policy allow anon read, the schema reload fired. The model can only
   answer from what appears in `Club Context Data`.
7. **Schema drift is possible.** `src/lib/data.ts:115` selects a `category` column
   on `events` that `supabase/schema.sql` does not define. If that query errors in
   production, the live database was altered outside this file. Run
   `select * from public.events limit 1;` to confirm before treating the repo SQL
   as the whole truth.
8. **Only 5 news items and 5 events are sent.** Older entries fall outside the
   AI's context by design (`limit(5)`).

---

## Verification checklist

Run these in the Supabase SQL Editor after inserting your facts:

```sql
-- 1. Your rows came back (one per fact)
select count(*) from public.info;

-- 2. A sample fact is readable
select title, description from public.info where title = 'who built the website';

-- 3. The anon role (what chat.ts uses) can actually read them
set role anon;
select title, description from public.info;
reset role;
```

Then open the site's chat and ask something matching a title, e.g.
**"Who built this website?"**.


---
## Options at a glance

| | The `info` table (RECOMMENDED) | A bespoke `misc_info` table |
| --- | --- | --- |
| SQL to run | Yes | Yes |
| Code change | **None** | `api/chat.ts` (extra query + context key) |
| Redeploy needed | **No** | Yes |
| Live for the AI | **Immediately** | After the deploy |
| Risk to the app | Very low | Touches the chat handler |

**Recommendation: the `info` table.** It answers "who built this website" (and
any other misc fact) with pure SQL and zero changes to application code.

---

*This file is untracked (`git status` shows `?? MISC_INFO_SQL.md`), lives outside
`src/`, and is never imported by any module, so it has no effect on the build or the
deployed site. Delete it whenever you like. To keep it out of version control
permanently, add `MISC_INFO_SQL.md` to `.gitignore`.*
