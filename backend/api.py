import os
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Header

from backend.sql_db import get_club_info, get_news, get_calendar, add_news
from backend.gemini_rag import generate_rag_answer

router = APIRouter()
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET") or os.getenv("DISCORD_BOT_TOKEN")


class ChatQuery(BaseModel):
    query: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    messages: Optional[List[Dict[str, Any]]] = None


class DiscordMessage(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    author: str = Field(min_length=1, max_length=100)


@router.get("/api/club-info")
def fetch_club_info():
    return get_club_info()


@router.get("/api/news")
def fetch_news():
    return get_news(limit=10)


@router.get("/api/calendar")
def fetch_calendar():
    return get_calendar(limit=10)


@router.post("/api/chat", response_model=None)
@router.post("/api/chat/", response_model=None)
async def chat_with_bot(payload: Union[ChatQuery, Dict[str, Any]]):
    if isinstance(payload, dict):
        messages = payload.get("messages")
        query = payload.get("query")
        history = payload.get("history", [])
    else:
        messages = payload.messages
        query = payload.query
        history = payload.history or []

    if messages and len(messages) > 0:
        query = messages[-1].get("content", "")
        history = messages[:-1]

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    answer = generate_rag_answer(query=query, history=history)

    return {"answer": answer}


@router.post("/api/discord-webhook")
def discord_webhook(msg: DiscordMessage, authorization: Optional[str] = Header(None)):
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook authentication is not configured")
    token = authorization.split("Bearer ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else authorization
    if token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    content = msg.content.strip()
    author = msg.author.strip()
    if not content or not author:
        raise HTTPException(status_code=400, detail="Content and author cannot be blank")
    return {"status": "success", "data": add_news(content=content, author=author)}