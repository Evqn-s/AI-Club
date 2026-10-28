# AI Club Website

A responsive club website for the AI Club, built with React, TypeScript, and Vite on the frontend, and a Python FastAPI backend for serving AI-powered answers over club data.

## Overview

This project combines a modern marketing site with a live data-backed assistant:

- Club home page with mission, contact links, and schedule details
- News and calendar pages powered by Supabase data
- AI chat assistant that answers questions using a Gemini-based RAG pipeline
- Animated, glassmorphism-inspired background and mobile-friendly responsive layout
- Local development support with a Vite proxy to the Python backend

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Routing: Wouter
- UI: Radix primitives, Lucide icons, Framer Motion
- Data: Supabase + Realtime
- Backend: FastAPI, Python
- AI: Google Gemini (RAG over club content)

## Repository Structure

```text
.
├── backend/                 # FastAPI app and AI/data endpoints
│   ├── api.py               # Route definitions for club, news, calendar, chat, webhook
│   ├── gemini_rag.py       # Gemini RAG prompt + answer generation
│   ├── main.py             # FastAPI startup and CORS config
│   ├── requirements.txt    # Python dependencies
│   ├── sql_db.py           # Supabase/SQLite data helpers
│   └── ...
├── public/                 # Static assets and SEO files
├── src/                    # Frontend React source
│   ├── components/         # Reusable UI and animated backgrounds
│   ├── lib/               # Data loading, cache helpers, typed Supabase access
│   ├── pages/             # Home, news, and calendar pages
│   ├── App.tsx            # App shell and route layout
│   ├── index.css          # Tailwind and design tokens
│   └── main.tsx           # Browser bootstrap
├── supabase/               # Database schema and Edge Functions
├── .env.example            # Example environment variable file
├── .gitignore              # Ignore local secrets and build artifacts
├── package.json            # Frontend scripts and dependencies
├── README.md               # Project documentation
├── index.html              # Vite entry page
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite + proxy config
├── vercel.json             # Vercel hosting configuration
└── ...
```

## Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill in the required values for the frontend and backend.

Example values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_BACKEND_URL=

GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_ORIGINS=http://localhost:3000
DISCORD_BOT_TOKEN=your-discord-bot-token
```

Notes:
- `VITE_*` variables are public and must be safe for browser exposure.
- Server-side Python variables must stay private and should not be committed.

## Local Development

### Install frontend dependencies

```bash
npm install
```

### Install backend dependencies

```bash
python -m venv .venv
# macOS / Linux
. .venv/bin/activate
# Windows PowerShell
# .\.venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt
```

### Start the backend

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Start the frontend

```bash
npm run dev
```

Then open:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

The Vite config proxies `/api` requests to the Python backend during local development.

## Production Build

```bash
npm run build
```

This runs TypeScript checks and produces the production bundle.

## Scripts

```bash
npm run dev      # start Vite dev server
npm run build    # type-check + production build
npm run preview  # run the production build locally
npm run lint     # lint TypeScript files
```

## AI Chat Notes

The assistant is a Gemini-backed RAG chatbot. It takes the current user query and recent chat history and uses structured club data to answer questions about meetings, news, events, contact information, and general club activity.

## Database and Content Notes

The app expects club data to be available in Supabase. The schema in `supabase/schema.sql` defines the core content tables used by the frontend and backend.

## Deployment

This project is designed to be deployed with:

- Vercel for the frontend
- Supabase for data storage and realtime updates
- A FastAPI backend hosted separately or behind the configured deployment target

## License

This project is intended for the AI Club website and may be adapted for your own deployment needs.
