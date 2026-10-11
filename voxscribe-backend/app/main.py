import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.router import api_router

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Multi-Agent AI & RAG Platform for YouTube to Blog Generation"
)

# Middleware Configuration
# Auth uses Bearer tokens (not cookies), so credentials mode is unnecessary.
# Set CORS_ORIGINS in production; when empty, any origin is allowed (development default).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Retry-After"],
)

# Register API Router
app.include_router(api_router)
