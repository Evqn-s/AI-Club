import os
import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

DB_PATH = os.path.join(os.path.dirname(__file__), "club_data.db")
SCHEMA_SQL_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "supabase", "schema.sql")
)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("VITE_SUPABASE_ANON_KEY")
)

def init_local_db():
    """Initializes a local SQLite database matching supabase/schema.sql."""
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

    # Seed initial club info if empty
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

    # Seed initial news if empty
    cursor.execute("SELECT COUNT(*) FROM news")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO news (id, content, author, timestamp)
            VALUES (?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            "Welcome to the AI Club! Join our Discord and check out our upcoming workshop series.",
            "Admin",
            datetime.now(timezone.utc).isoformat()
        ))

    # Seed initial event if empty
    cursor.execute("SELECT COUNT(*) FROM events")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO events (id, title, date, time, location, description)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()),
            "AI Club General Meeting",
            "2026-09-15",
            "18:00",
            "Room 101",
            "Monthly assembly to discuss projects, hackathons, and guest speakers."
        ))

    conn.commit()
    conn.close()

# Initialize DB on module import
init_local_db()

def _supabase_request(endpoint: str, method: str = "GET", payload: Optional[dict] = None) -> Optional[Any]:
    """Helper to query Supabase REST API if configured."""
    if not (SUPABASE_URL and SUPABASE_KEY):
        return None

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" if method == "POST" else ""
    }

    try:
        data_bytes = json.dumps(payload).encode("utf-8") if payload else None
        req = Request(url, data=data_bytes, headers=headers, method=method)
        with urlopen(req, timeout=5) as resp:
            if resp.status in (200, 201):
                res_body = resp.read().decode("utf-8")
                return json.loads(res_body) if res_body else None
    except Exception as e:
        print(f"[sql_db] Supabase query to {endpoint} failed, falling back to local SQL: {e}")
    return None

def get_club_info() -> Dict[str, Any]:
    """Fetches club_info from Supabase or local SQLite."""
    sb_data = _supabase_request("club_info?id=eq.club_main&select=*")
    if sb_data and isinstance(sb_data, list) and len(sb_data) > 0:
        return sb_data[0]

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
        "contact_email": "contact.aiclub@gmail.com"
    }

def get_news(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetches news items ordered by timestamp descending from SQL."""
    sb_data = _supabase_request(f"news?select=*&order=timestamp.desc&limit={limit}")
    if sb_data and isinstance(sb_data, list):
        return sb_data

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM news ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_calendar(limit: int = 10) -> List[Dict[str, Any]]:
    """Fetches upcoming events ordered by date ascending from SQL."""
    sb_data = _supabase_request(f"events?select=*&order=date.asc&limit={limit}")
    if sb_data and isinstance(sb_data, list):
        return sb_data

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events ORDER BY date ASC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_news(content: str, author: str) -> Dict[str, Any]:
    """Inserts a new announcement into SQL news table."""
    new_item = {
        "id": f"msg_{int(datetime.now(timezone.utc).timestamp())}_{str(uuid.uuid4())[:8]}",
        "content": content,
        "author": author,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    # Try Supabase insert
    sb_data = _supabase_request("news", method="POST", payload=new_item)
    if sb_data and isinstance(sb_data, list) and len(sb_data) > 0:
        return sb_data[0]

    # Local SQLite insert
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO news (id, content, author, timestamp) VALUES (?, ?, ?, ?)",
        (new_item["id"], new_item["content"], new_item["author"], new_item["timestamp"])
    )
    conn.commit()
    conn.close()
    return new_item

def get_secret(key: str) -> Optional[str]:
    """Retrieves secret value from Supabase app_secrets or environment."""
    sb_data = _supabase_request(f"app_secrets?key=eq.{key}&select=value")
    if sb_data and isinstance(sb_data, list) and len(sb_data) > 0:
        return sb_data[0].get("value")
    return os.getenv(key)
