import asyncio
from backend.api import (
    fetch_club_info,
    fetch_news,
    fetch_calendar,
    discord_webhook,
    chat_with_bot,
    DiscordMessage,
    ChatQuery
)

def run_tests():
    print("=== Testing AI Club FastAPI Backend Handlers ===")

    print("\n1. Testing fetch_club_info() from SQL...")
    info = fetch_club_info()
    assert isinstance(info, dict), "Club info should be a dict"
    assert "club_name" in info, "Club info missing club_name"
    print("   -> Club name:", info["club_name"])
    print("   -> Meeting times:", info.get("meeting_times"))

    print("\n2. Testing fetch_news() from SQL...")
    news = fetch_news()
    assert isinstance(news, list), "News should be a list"
    assert len(news) > 0, "News should have at least 1 seeded item"
    print("   -> News count:", len(news))
    print("   -> Latest news author:", news[0].get("author"))

    print("\n3. Testing fetch_calendar() from SQL...")
    calendar = fetch_calendar()
    assert isinstance(calendar, list), "Calendar should be a list"
    assert len(calendar) > 0, "Calendar should have at least 1 seeded event"
    print("   -> Calendar count:", len(calendar))
    print("   -> Next event:", calendar[0].get("title"), "on", calendar[0].get("date"))

    print("\n4. Testing discord_webhook() SQL insertion...")
    msg = DiscordMessage(content="Automated announcement test", author="CI/CD Bot")
    res = discord_webhook(msg, authorization="default_secret")
    assert res.get("status") == "success", "Webhook status should be success"
    print("   -> Webhook insert OK:", res)

    print("\n5. Testing chat_with_bot() with {query, history}...")
    chat_res = asyncio.run(chat_with_bot({"query": "What is the mission of the club?", "history": []}))
    assert "answer" in chat_res, "Chat response should contain answer"
    print("   -> Response answer:", chat_res["answer"])

    print("\n6. Testing chat_with_bot() with {messages} frontend format...")
    frontend_messages = [
        {"role": "user", "content": "When are the club meetings?"}
    ]
    chat_res_2 = asyncio.run(chat_with_bot({"messages": frontend_messages}))
    assert "answer" in chat_res_2, "Chat response should contain answer"
    print("   -> Frontend format response answer:", chat_res_2["answer"])

    print("\n================================================")
    print("SUCCESS: All FastAPI backend functions tested and verified against SQL database!")
    print("================================================")

if __name__ == "__main__":
    run_tests()
