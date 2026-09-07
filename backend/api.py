import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Header, Request

from backend.sql_db import get_club_info, get_news, get_calendar, add_news
from backend.gemini_rag import generate_rag_answer

router = APIRouter()
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET") or os.getenv("DISCORD_BOT_TOKEN") or "default_secret"

class ChatMessage(BaseModel):
    role: Optional[str] = "user"
    content: str

class ChatQuery(BaseModel):
    query: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = []
    messages: Optional[List[Dict[str, Any]]] = None

class DiscordMessage(BaseModel):
    content: str
    author: str

@router.get("/api/club-info")
def fetch_club_info():
    """Fetches club metadata directly from SQL database."""
    return get_club_info()

@router.get("/api/news")
def fetch_news():
    """Fetches recent news items ordered by timestamp descending from SQL database."""
    return get_news(limit=10)

@router.get("/api/calendar")
def fetch_calendar():
    """Fetches upcoming events ordered by date ascending from SQL database."""
    return get_calendar(limit=10)

@router.post("/api/chat")
async def chat_with_bot(payload: Union[ChatQuery, Dict[str, Any]]):
    """
    Handles user chat query using Gemini RAG with SQL club context.
    Accepts both:
      1) { "query": "when is the meeting?", "history": [...] }
      2) { "messages": [{ "role": "user", "content": "..." }] }
    """
    if isinstance(payload, dict):
        messages = payload.get("messages")
        query = payload.get("query")
        history = payload.get("history", [])
    else:
        messages = payload.messages
        query = payload.query
        history = payload.history or []

    if messages and len(messages) > 0:
        # Extract last user message as query and preceding as history
        last_msg = messages[-1]
        query = last_msg.get("content", "")
        history = messages[:-1]

    if not query:
        raise HTTPException(status_code=400, detail="Query or messages cannot be empty")

    answer = generate_rag_answer(query=query, history=history)
    return {"answer": answer}

@router.post("/api/discord-webhook")
def discord_webhook(msg: DiscordMessage, authorization: Optional[str] = Header(None)):
    """Receives Discord bot webhook and writes directly to SQL news table."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    else:
        token = authorization

    if token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not msg.content or not msg.author:
        raise HTTPException(status_code=400, detail="Content and author are required")

    result = add_news(content=msg.content, author=msg.author)
    return {"status": "success", "data": result}