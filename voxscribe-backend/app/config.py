import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def _env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default

def _env_list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]

class Settings:
    PROJECT_NAME: str = "VoxScribe API"
    PROJECT_VERSION: str = "1.1.0"

    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")

    # "local" (free, on-device via fastembed) or "huggingface" (Inference API, needs credits)
    EMBEDDINGS_PROVIDER: str = os.getenv("EMBEDDINGS_PROVIDER", "local").strip().lower()

    # Transcribe videos without captions via yt-dlp + Groq Whisper
    ENABLE_WHISPER_FALLBACK: bool = _env_bool("ENABLE_WHISPER_FALLBACK", True)

    # Groq chat models users may choose from; the first is the default
    AVAILABLE_MODELS: list[str] = _env_list("AVAILABLE_MODELS", "openai/gpt-oss-20b,openai/gpt-oss-120b,qwen/qwen3.8-27b")

    # Max generations per user per rolling 24 hours (0 = unlimited)
    DAILY_GENERATION_LIMIT: int = _env_int("DAILY_GENERATION_LIMIT", 25)

    # Comma-separated allowed CORS origins; empty allows any origin (development default)
    CORS_ORIGINS: list[str] = _env_list("CORS_ORIGINS", "")

    @property
    def DEFAULT_MODEL(self) -> str:
        return self.AVAILABLE_MODELS[0] if self.AVAILABLE_MODELS else "openai/gpt-oss-20b"

settings = Settings()
