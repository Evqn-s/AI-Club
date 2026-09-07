"""
sql_db.py — Data access layer for the AI Club backend.

Priority order:
  1. Supabase (Postgres via supabase-py) — when SUPABASE_URL + key are set.
  2. Local SQLite                        — dev/offline fallback.

Set these environment variables (or add them to backend/.env):
  SUPABASE_URL              https://xxxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY  <service-role secret>   (preferred — bypasses RLS)
  SUPABASE_KEY               <anon key>              (fallback if no service role)
  VITE_SUPABASE_URL          same URL, used when the above isn't set
  VITE_SUPABASE_ANON_KEY     same anon key
"""

import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

try:
    from dotenv import load_dotenv
    # Load from project root .env first, then backend/.env
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    load_dotenv(os.path.join(_root, ".env"))
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

# ── Supabase credentials ───────────────────────────────────────────────────
SUPABASE_URL: Optional[str] = (
    os.getenv("SUPABASE_URL")
    or os.getenv("VITE_SUPABASE_URL")
)
SUPABASE_KEY: Optional[str] = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("VITE_SUPABASE_ANON_KEY")
)

# ── Try to build a supabase-py client ─────────────────────────────────────
_supabase_client = None

def _get_supabase_client():
    """Returns a cached supabase-py Client, or None if not configured."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if not (SUPABASE_URL and SUPABASE_KEY):
        return None
    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"[sql_db] Connected to Supabase: {SUPABASE_URL}")
        return _supabase_client
    except Exception as e:
        print(f"[sql_db] Failed to create Supabase client: {e}")
        return None

# ── Local SQLite path (dev fallback) ──────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "club_data.db")

def init_local_db():
    """Initialises a local SQLite database matching supabase/schema.sql."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS club_info (
            id TEXT PRIMARY KEY,
            club_name TEXT NOT NULL DEFAULT 'AI Club',
            mission TEXT,
            meeting_times TEXT NOT NULL DEFAULT 'Every Tuesday at 6 PM',
            rules TEXT,
            contact_email TEXT NOT NULL DEFAULT 'contact.aiclub@gmail.com',
            google_classroom_code TEXT,
            google_classroom_url TEXT,
            instagram_handle TEXT,
            instagram_url TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            author TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT ''
        )
    """)

    # Seed club_info
    cursor.execute("SELECT COUNT(*) FROM club_info")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO club_info (
                id, club_name, mission, meeting_times, contact_email,
                google_classroom_code, instagram_handle
            ) VALUES (
                'club_main',
                'AI Club',
                'Empowering students to explore, build, and innovate with artificial intelligence.',
                'Every Tuesday at 6 PM',
                'contact.aiclub@gmail.com',
                'aiclub2026',
                '@aiclub.official'
            )
        """)

    # Seed news
    cursor.execute("SELECT COUNT(*) FROM news")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO news (id, content, author, timestamp) VALUES (?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                "Welcome to the AI Club! Join our Discord and check out our upcoming workshop series.",
                "Admin",
                datetime.now(timezone.utc).isoformat(),
            ),
        )

    # Seed events
    cursor.execute("SELECT COUNT(*) FROM events")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO events (id, title, date, time, location, description) VALUES (?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                "AI Club General Meeting",
                "2026-09-15",
                "18:00",
                "Room 101",
                "Monthly assembly to discuss projects, hackathons, and guest speakers.",
            ),
        )

    conn.commit()
    conn.close()

# Initialise on import
init_local_db()

# ── Public API ─────────────────────────────────────────────────────────────

def get_club_info() -> Dict[str, Any]:
    """Fetches club_info row. Uses Supabase if configured, SQLite otherwise."""
    sb = _get_supabase_client()
    if sb:
        try:
            res = sb.table("club_info").select("*").eq("id", "club_main").limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"[sql_db] Supabase club_info fetch failed, using SQLite: {e}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM club_info WHERE id = 'club_main' LIMIT 1")
    row = cursor.fetchone()
    conn.close()

    if row:
        return dict(row)
    return {
        "club_name": "AI Club",
        "meeting_times": "Every Tuesday at 6 PM",
        "contact_email": "contact.aiclub@gmail.com",
    }


def get_news(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetches news items ordered by timestamp descending."""
    sb = _get_supabase_client()
    if sb:
        try:
            res = (
                sb.table("news")
                .select("*")
                .order("timestamp", desc=True)
                .limit(limit)
                .execute()
            )
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"[sql_db] Supabase news fetch failed, using SQLite: {e}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM news ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_calendar(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetches upcoming events ordered by date ascending."""
    sb = _get_supabase_client()
    if sb:
        try:
            res = (
                sb.table("events")
                .select("*")
                .order("date", desc=False)
                .limit(limit)
                .execute()
            )
            if res.data is not None:
                return res.data
        except Exception as e:
            print(f"[sql_db] Supabase events fetch failed, using SQLite: {e}")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date ASC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_news(content: str, author: str) -> Dict[str, Any]:
    """Inserts a new announcement into the news table."""
    new_item = {
        "id": f"msg_{int(datetime.now(timezone.utc).timestamp())}_{str(uuid.uuid4())[:8]}",
        "content": content,
        "author": author,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    sb = _get_supabase_client()
    if sb:
        try:
            res = sb.table("news").insert(new_item).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"[sql_db] Supabase news insert failed, using SQLite: {e}")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO news (id, content, author, timestamp) VALUES (?, ?, ?, ?)",
        (new_item["id"], new_item["content"], new_item["author"], new_item["timestamp"]),
    )
    conn.commit()
    conn.close()
    return new_item


def get_secret(key: str) -> Optional[str]:
    """Retrieves a secret from Supabase app_secrets table or environment."""
    sb = _get_supabase_client()
    if sb:
        try:
            res = sb.table("app_secrets").select("value").eq("key", key).limit(1).execute()
            if res.data and len(res.data) > 0:
                return res.data[0].get("value")
        except Exception:
            pass
    return os.getenv(key)


def check_supabase_connection() -> Dict[str, Any]:
    """
    Diagnostic: confirms whether the backend is talking to Supabase Postgres
    or the local SQLite fallback.  Call from test_backend.py or a health endpoint.
    """
    sb = _get_supabase_client()
    if sb is None:
        return {
            "backend": "sqlite",
            "reason": "SUPABASE_URL or SUPABASE_KEY not set",
            "db_path": DB_PATH,
        }
    try:
        res = sb.table("club_info").select("id").limit(1).execute()
        return {
            "backend": "supabase_postgres",
            "url": SUPABASE_URL,
            "club_info_rows": len(res.data) if res.data else 0,
        }
    except Exception as e:
        return {
            "backend": "sqlite_fallback",
            "reason": f"Supabase reachable but query failed: {e}",
            "db_path": DB_PATH,
        }
