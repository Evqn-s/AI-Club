import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api import router

app = FastAPI(
    title="AI Club Backend API",
    description="Python FastAPI backend providing RAG chatbot and SQL database endpoints for AI Club Website",
    version="1.0.0"
)

@app.middleware("http")
async def log_requests(request, call_next):
    response = await call_next(request)
    if response.status_code == 404:
        print(f"[404 DETECTED] Path requested: {request.method} {request.url.path}")
    return response

# Allow all origins for seamless pairing with Vite frontend or external deployments
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AI Club Python FastAPI Backend",
        "endpoints": [
            "/api/chat",
            "/api/news",
            "/api/calendar",
            "/api/club-info",
            "/api/discord-webhook"
        ]
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    print(f"Starting AI Club FastAPI Server on http://127.0.0.1:{port}")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
