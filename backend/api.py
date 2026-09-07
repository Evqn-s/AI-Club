import os
import json
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import StreamingResponse

from backend.sql_db import get_club_info, get_news, get_calendar
from backend.gemini_rag import generate_rag_answer

router = APIRouter()

class ChatQuery(BaseModel):
    query: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = []
    messages: Optional[List[Dict[str, Any]]] = None

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
async def chat_with_bot(payload: Union[ChatQuery, Dict[str, Any]], request: Request = None):
    if isinstance(payload, dict):
        messages = payload.get("messages")
        query = payload.get("query")
        history = payload.get("history", [])
    else:
        messages = payload.messages
        query = payload.query
        history = payload.history or []

    is_stream_client = bool(messages and len(messages) > 0)

    if messages and len(messages) > 0:
        query = messages[-1].get("content", "")
        history = messages[:-1]

    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    answer = generate_rag_answer(query=query, history=history)

    accept = request.headers.get("accept", "") if request else ""
    if is_stream_client or "text/plain" in accept or "stream" in accept:
        def stream_generator():
            yield f"0:{json.dumps(answer)}\n"
            yield 'e:{"finishReason":"stop"}\n'

        return StreamingResponse(
            stream_generator(),
            media_type="text/plain; charset=utf-8",
            headers={"x-vercel-ai-data-stream": "v1", "Cache-Control": "no-cache"},
        )

    return {"answer": answer}