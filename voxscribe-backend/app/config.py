import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

class Settings:
    PROJECT_NAME: str = "VoxScribe API"
    PROJECT_VERSION: str = "1.0.0"
    
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "")
    
    ALLOWED_ORIGINS: list[str] = ["*"]

settings = Settings()
