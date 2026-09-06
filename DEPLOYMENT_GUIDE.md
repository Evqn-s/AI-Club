# Deployment Guide: GitHub + Supabase + Vercel

## Overview

Your AI Club Website deploys in three connected parts:
1. **GitHub** — Stores your codebase, tracks versions, and triggers automatic CI/CD deployments.
2. **Supabase** — Provides the Postgres database, real-time subscriptions, and the Discord sync Edge Function.
3. **Vercel** — Hosts the React/Vite frontend static bundle and runs the `/api/chat` serverless Edge function (Google Gemini 1.5 Flash).

---

## Part 1: GitHub Setup

### Step 1 — Verify git ignore rules
Make sure your secret keys and large build files are ignored. The root [`.gitignore`](file:///c:/Users/esun/Documents/antigravity/AI%20Club%20Website/.gitignore) already ignores:
```gitignore
node_modules/
dist/
.env
.env.*
.vercel/
.supabase/
```

### Step 2 — Initialize Git and Commit
Open PowerShell or your command prompt in the project root:

```powershell
# Navigate to the workspace root
cd "C:\Users\esun\Documents\antigravity\AI Club Website"

# Initialize git with main as the default branch
git init -b main

# Stage all files (secret files will be excluded automatically)
git add .

# Create the initial commit
git commit -m "feat: initial commit for AI Club Website"
```

### Step 3 — Link to your GitHub repository & push
Your repository is located at: `https://github.com/Evqn-s/AI-Club`

Run the following commands in your terminal:

```powershell
# Set origin to your GitHub repository
git remote add origin https://github.com/Evqn-s/AI-Club.git

# Ensure branch is main
git branch -M main

# Push code to GitHub
git push -u origin main
```

---

## Part 2: Supabase Setup

### Step 1 — Create a project
1. Go to [supabase.com](https://supabase.com) → **Sign up / Log in**.
2. Click **New Project**.
3. Choose your organization, set the project name (e.g. `ai-club`), and create a secure database password.
4. Select a region close to your users and click **Create new project**. Wait ~1 minute for provisioning.

### Step 2 — Run the database schema
1. In the Supabase left sidebar, click **SQL Editor**.
2. Click **+ New query**.
3. Open [`club-web-app/supabase/schema.sql`](file:///c:/Users/esun/Documents/antigravity/AI%20Club%20Website/club-web-app/supabase/schema.sql) and paste the entire file into the editor:
   - Sets up `club_info` (singleton table for meeting times, rules, socials)
   - Sets up `news` (announcements from Discord and admins)
   - Sets up `events` (calendar schedule)
   - Enables Row Level Security (RLS) public-read policies
   - Enables Supabase Realtime for `news` and `events`
4. Click **Run** (▶) — you should see `Success. No rows returned`.

### Step 3 — Seed initial data (optional)
In the SQL Editor, run this query to populate your club's initial details:

```sql
INSERT INTO public.club_info (
  id,
  club_name,
  mission,
  meeting_times,
  contact_email,
  google_classroom_code,
  instagram_handle
)
VALUES (
  'club_main',
  'AI Club',
  'Empowering students to explore, build, and innovate with artificial intelligence.',
  'Every Tuesday at 6 PM',
  'contact.aiclub@gmail.com',
  'aiclub2026',
  '@aiclub.official'
)
ON CONFLICT (id) DO UPDATE SET
  club_name = EXCLUDED.club_name,
  mission = EXCLUDED.mission,
  meeting_times = EXCLUDED.meeting_times;
```

### Step 4 — Collect your API keys
In the Supabase dashboard, click **Project Settings** (gear icon in the sidebar) → **API**:

| Key | Supabase Dashboard Label | Usage |
|---|---|---|
| Project URL | `Project URL` (e.g., `https://xyzabcdef.supabase.co`) | Frontend + Server |
| Anon Key | `anon public` (starts with `eyJ...`) | Frontend browser client |
| Service Role Key | `service_role secret` (starts with `eyJ...`) | Server-side `/api/chat` only |

> [!CAUTION]
> Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or commit it to GitHub. It bypasses Row Level Security. Only place it in Vercel's private environment variables.

### Step 5 — (Optional) Deploy Discord Sync Edge Function
If you want announcements posted in your Discord server to sync directly into the website's `news` table:

1. Install the Supabase CLI if you haven't already:
   ```powershell
   npm install -g supabase
   ```
2. Log in and link your project:
   ```powershell
   cd "C:\Users\esun\Documents\antigravity\AI Club Website\club-web-app"
   supabase login
   supabase link --project-ref <YOUR_PROJECT_REF>
   ```
3. Set your Discord bot token secret:
   ```powershell
   supabase secrets set DISCORD_BOT_TOKEN="your-discord-bot-token"
   ```
4. Deploy the function:
   ```powershell
   supabase functions deploy discord-sync --no-verify-jwt
   ```
   *Your live endpoint will be:* `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/discord-sync`

---

## Part 3: Vercel Deployment

### Step 1 — Import project to Vercel
1. Go to [vercel.com](https://vercel.com) and log in using your GitHub account.
2. Click **Add New...** → **Project**.
3. Under **Import Git Repository**, find `AI-Club` (or `Evqn-s/AI-Club`) and click **Import**.

### Step 2 — Configure Root Directory
Because the web app lives in the `club-web-app` folder:
1. In the setup screen, find **Root Directory** and click **Edit**.
2. Select or enter: `club-web-app`.
3. Click **Continue**. Vercel will automatically detect the **Vite** preset.

**Settings Summary:**
| Setting | Value |
|---|---|
| Framework Preset | `Vite` |
| Root Directory | `club-web-app` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### Step 3 — Configure Environment Variables
In the **Environment Variables** section on Vercel, add the following 5 variables:

| Variable Name | Value | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<YOUR_PROJECT_REF>.supabase.co` | Supabase URL for the frontend |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon public key) | Public Supabase read access |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `AIzaSy...` | Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `SUPABASE_URL` | `https://<YOUR_PROJECT_REF>.supabase.co` | Server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role secret) | Server-side access for AI chat context |

### Step 4 — Deploy
1. Click **Deploy**.
2. Vercel will clone the repo, install dependencies, build the static site, and deploy the `/api/chat` Edge function.
3. In ~45 seconds, you will receive a production URL (e.g. `https://ai-club-website.vercel.app`).

---

## Part 4: Post-Deployment Checks

### 1. Check Homepage Data
- Open your Vercel URL.
- The hero section and meeting times should match the data in your `club_info` table.

### 2. Test the AI Chatbot
- Click the **Ask AI** floating widget in the lower-right corner.
- Type: *"When are meetings?"* or *"What is the club mission?"*.
- The bot streams answers using Gemini 1.5 Flash and your Supabase club data.

### 3. Test Real-time Updates
- In the Supabase Table Editor, open `news` or `events`.
- Insert a test row.
- Without refreshing the webpage, the new announcement or event should appear immediately via Supabase Realtime.

---

## Part 5: Ongoing Updates & Maintenance

Every time you make changes locally and push to GitHub, Vercel **automatically redeploys** within seconds:

```powershell
# Make your edits locally, then:
git add .
git commit -m "Update club event schedule"
git push origin main
# -> Vercel triggers a new build and updates the live site automatically
```

---

## Quick Reference: All Environment Variables

| Variable | Required | Scope | Description |
|---|:---:|:---:|---|
| `VITE_SUPABASE_URL` | Yes | Client (Browser) | Public Supabase endpoint |
| `VITE_SUPABASE_ANON_KEY` | Yes | Client (Browser) | Public anon key for database queries |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Server (`/api/chat`) | Google Gemini API key for club assistant |
| `SUPABASE_URL` | Yes | Server (`/api/chat`) | Backend Supabase endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server (`/api/chat`) | Private key for server context fetching |
| `DISCORD_BOT_TOKEN` | Optional | Supabase Edge Function | Token for `discord-sync` function authentication |
