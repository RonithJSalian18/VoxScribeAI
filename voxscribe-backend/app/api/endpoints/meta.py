from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import settings
from app.core.auth import AuthUser, get_current_user
from app.services import usage_service

router = APIRouter()

class ModelInfo(BaseModel):
    id: str
    default: bool

class UsageResponse(BaseModel):
    generations_last_24h: int
    daily_limit: int
    total_posts: int
    posts_by_format: dict[str, int]
    voices: int
    samples: int
    chunks: int

@router.get("/models", response_model=list[ModelInfo])
def list_models():
    """Groq chat models available for generation (configured via AVAILABLE_MODELS)."""
    return [ModelInfo(id=m, default=m == settings.DEFAULT_MODEL) for m in settings.AVAILABLE_MODELS]

@router.get("/usage", response_model=UsageResponse)
def get_usage(user: AuthUser = Depends(get_current_user)):
    """The user's generation quota and content statistics."""
    return usage_service.usage_summary(user.id)
