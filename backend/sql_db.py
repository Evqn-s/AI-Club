import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

try:
    from dotenv import load_dotenv
    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    load_dotenv(os.path.join(_root, ".env"))
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("VITE_SUPABASE_ANON_KEY")
)
DB_PATH = os.path.join(os.path.dirname(__file__), "club_data.db")

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if not (SUPABASE_URL and SUPABASE_KEY):
        return None
    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception:
        return None

def init_local_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS club_info (
            id TEXT PRIMARY KEY,
            club_name TEXT NOT NULL DEFAULT 'AI Club',
            mission TEXT,
            vision TEXT,
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
    try:
        cursor.execute("ALTER TABLE club_info ADD COLUMN vision TEXT")
    except Exception:
        pass
    cursor.execute("""
        UPDATE club_info
        SET vision = COALESCE(vision, mission, 'Empowering students to explore, build, and innovate with artificial intelligence.')
        WHERE id = 'club_main' AND (vision IS NULL OR vision = '')
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
    cursor.execute("SELECT COUNT(*) FROM club_info")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO club_info (id, club_name, mission, meeting_times, contact_email, google_classroom_code, instagram_handle)
            VALUES ('club_main', 'AI Club', 'Empowering students to explore, build, and innovate with artificial intelligence.', 'Every Tuesday at 6 PM', 'contact.aiclub@gmail.com', 'aiclub2026', '@aiclub.official')
        """)
    cursor.execute("SELECT COUNT(*) FROM news")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO news (id, content, author, timestamp) VALUES (?, ?, ?, ?)",
                       (str(uuid.uuid4()), "Welcome to the AI Club! Join our Discord and check out our upcoming workshop series.", "Admin", datetime.now(timezone.utc).isoformat()))
    cursor.execute("SELECT COUNT(*) FROM events")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO events (id, title, date, time, location, description) VALUES (?, ?, ?, ?, ?, ?)",
                       (str(uuid.uuid4()), "AI Club General Meeting", "2026-09-15", "18:00", "Room 101", "Monthly assembly to discuss projects, hackathons, and guest speakers."))
    conn.commit()
    conn.close()

init_local_db()

def get_club_info() -> Dict[str, Any]:
    sb = get_supabase_client()
    if sb:
        try:
            res = sb.table("club_info").select("*").eq("id", "club_main").limit(1).execute()
            if res.data:
                return res.data[0]
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM club_info WHERE id = 'club_main' LIMIT 1")
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else {
        "club_name": "AI Club",
        "meeting_times": "Every Tuesday at 6 PM",
        "contact_email": "contact.aiclub@gmail.com",
    }

def get_news(limit: int = 10) -> List[Dict[str, Any]]:
    sb = get_supabase_client()
    if sb:
        try:
            res = sb.table("news").select("*").order("timestamp", desc=True).limit(limit).execute()
            if res.data is not None:
                return res.data
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM news ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_calendar(limit: int = 10) -> List[Dict[str, Any]]:
    sb = get_supabase_client()
    if sb:
        try:
            res = sb.table("events").select("*").order("date", desc=False).limit(limit).execute()
            if res.data is not None:
                return res.data
        except Exception:
            pass

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date ASC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_news(content: str, author: str) -> Dict[str, Any]:
    new_item = {
        "id": f"msg_{int(datetime.now(timezone.utc).timestamp())}_{str(uuid.uuid4())[:8]}",
        "content": content,
        "author": author,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    sb = get_supabase_client()
    if sb:
        try:
            res = sb.table("news").insert(new_item).execute()
            if res.data:
                return res.data[0]
        except Exception:
            pass

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
    sb = get_supabase_client()
    if sb:
        try:
            res = sb.table("app_secrets").select("value").eq("key", key).limit(1).execute()
            if res.data:
                return res.data[0].get("value")
        except Exception:
            pass
    return os.getenv(key)
