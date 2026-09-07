import os
import json
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from backend.sql_db import get_club_info, get_calendar, get_news, get_secret

load_dotenv()


def generate_rag_answer(query: str, history: Optional[List[dict]] = None) -> str:
    api_key = (
        os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
        or os.getenv("GEMINI_API_KEY")
        or get_secret("GOOGLE_GENERATIVE_AI_API_KEY")
    )
    if not api_key:
        return "Error: Gemini API key is not configured. Please set GOOGLE_GENERATIVE_AI_API_KEY in your environment."

    context = {
        "club_info": get_club_info() or {},
        "calendar": get_calendar(limit=5) or [],
        "news": get_news(limit=5) or [],
    }

    now_str = datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")

    formatted_history = ""
    if history:
        for msg in history[-4:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            formatted_history += f"{role}: {msg.get('content', '')}\n"

    prompt = f"""You are a helpful, concise assistant for the AI Club.
Current Date and Time: {now_str}

Answer the user query strictly using the Context Data below.
If asked follow-up questions, reference the Recent Conversation History.

Rules:
1. Do not use em dashes (—); use commas, colons, or periods instead.
2. If you don't know the answer or it's not in the context, say you don't have that information.
3. Be friendly, clear, and direct. Keep answers under 150 words.

{formatted_history}
Context Data (from SQL Database):
{json.dumps(context, indent=2, default=str)}

User Query: {query}
"""

    model_name = "gemini-3.1-flash-lite"
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            max_output_tokens=1024,
            temperature=0.7,
            top_p=1.0,
        ),
    )

    return response.text.strip() if response.text else "I don't have information about that."