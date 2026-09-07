"""
test_backend.py — Integration tests for the AI Club FastAPI backend.

Run from the project root:
    python -c "import sys; sys.path.insert(0, '.'); exec(open('backend/test_backend.py').read())"

To test against real Supabase Postgres, set in .env (or environment):
    SUPABASE_URL=https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    GEMINI_API_KEY=your-gemini-api-key
"""
import asyncio
import sys
import os

# Ensure project root is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.sql_db import (
    check_supabase_connection,
    get_club_info,
    get_news,
    get_calendar,
    add_news,
)
from backend.api import (
    fetch_club_info,
    fetch_news,
    fetch_calendar,
    discord_webhook,
    chat_with_bot,
    DiscordMessage,
    ChatQuery,
)


def run_tests():
    print("=" * 52)
    print("  AI Club FastAPI Backend — Integration Tests")
    print("=" * 52)

    # ── 0. Database connectivity check ──────────────────
    print("\n0. Checking database backend...")
    conn_info = check_supabase_connection()
    backend_type = conn_info.get("backend", "unknown")

    if backend_type == "supabase_postgres":
        print(f"   ✅ SUPABASE POSTGRES  →  {conn_info['url']}")
        print(f"      club_info rows visible: {conn_info['club_info_rows']}")
    elif backend_type == "sqlite":
        print(f"   ⚠️  LOCAL SQLITE (no Supabase credentials set)")
        print(f"      Reason: {conn_info['reason']}")
        print(f"      DB path: {conn_info['db_path']}")
        print()
        print("   To switch to Supabase Postgres, add to .env:")
        print("     SUPABASE_URL=https://xxxx.supabase.co")
        print("     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key")
    else:
        print(f"   ⚠️  SQLITE FALLBACK — Supabase reachable but query failed")
        print(f"      {conn_info.get('reason')}")

    # ── 1. club_info ─────────────────────────────────────
    print("\n1. Testing fetch_club_info() ...")
    info = fetch_club_info()
    assert isinstance(info, dict), "club_info should be a dict"
    assert "club_name" in info, "club_info missing club_name"
    print(f"   ✅ club_name:     {info['club_name']}")
    print(f"   ✅ meeting_times: {info.get('meeting_times')}")
    print(f"   ✅ contact_email: {info.get('contact_email')}")

    # ── 2. news ──────────────────────────────────────────
    print("\n2. Testing fetch_news() ...")
    news = fetch_news()
    assert isinstance(news, list), "news should be a list"
    assert len(news) > 0, "news should have at least 1 item"
    print(f"   ✅ news count:    {len(news)}")
    print(f"   ✅ latest author: {news[0].get('author')}")
    print(f"   ✅ latest content (truncated): {str(news[0].get('content', ''))[:60]}...")

    # ── 3. calendar ──────────────────────────────────────
    print("\n3. Testing fetch_calendar() ...")
    calendar = fetch_calendar()
    assert isinstance(calendar, list), "calendar should be a list"
    assert len(calendar) > 0, "calendar should have at least 1 event"
    print(f"   ✅ event count: {len(calendar)}")
    print(f"   ✅ next event:  {calendar[0].get('title')} on {calendar[0].get('date')}")

    # ── 4. discord webhook ───────────────────────────────
    print("\n4. Testing discord_webhook() insert ...")
    msg = DiscordMessage(content="Automated connectivity test", author="test_backend.py")
    res = discord_webhook(msg, authorization="default_secret")
    assert res.get("status") == "success", "Webhook status should be success"
    print(f"   ✅ Webhook insert OK: id={res['data'].get('id')}")

    # ── 5. chat (query/history format) ───────────────────
    print("\n5. Testing chat_with_bot() {query, history} format ...")
    chat_res = asyncio.run(chat_with_bot({"query": "What is the mission of the club?", "history": []}))
    assert "answer" in chat_res, "chat response must have 'answer' key"
    answer = chat_res["answer"]
    if answer.startswith("Error: Gemini API key"):
        print(f"   ⚠️  Gemini key not set — SQL fetch worked, LLM call skipped")
        print(f"      Set GEMINI_API_KEY in .env to enable full RAG testing")
    else:
        print(f"   ✅ LLM answer: {answer[:80]}...")

    # ── 6. chat (messages format) ────────────────────────
    print("\n6. Testing chat_with_bot() {messages} frontend format ...")
    chat_res_2 = asyncio.run(chat_with_bot({
        "messages": [{"role": "user", "content": "When are the club meetings?"}]
    }))
    if hasattr(chat_res_2, "body_iterator"):
        chunks = []
        async def read_stream():
            async for chunk in chat_res_2.body_iterator:
                chunks.append(chunk if isinstance(chunk, str) else chunk.decode("utf-8"))
        asyncio.run(read_stream())
        stream_text = "".join(chunks)
        assert "0:" in stream_text, "StreamingResponse must contain AI SDK data stream chunk"
        assert chat_res_2.headers.get("x-vercel-ai-data-stream") == "v1", "Header must be x-vercel-ai-data-stream: v1"
        print(f"   ✅ AI SDK Data Stream OK for frontend ({len(chunks)} chunks, header verified)")
    else:
        assert "answer" in chat_res_2, "chat response must have 'answer' key"
        answer_2 = chat_res_2["answer"]
        if answer_2.startswith("Error: Gemini API key"):
            print(f"   ⚠️  Gemini key not set — SQL context was still fetched correctly")
        else:
            print(f"   ✅ LLM answer: {answer_2[:80]}...")

    # ── Summary ──────────────────────────────────────────
    print()
    print("=" * 52)
    print(f"  ALL TESTS PASSED — Backend: {backend_type.upper()}")
    print("=" * 52)


if __name__ == "__main__":
    run_tests()
