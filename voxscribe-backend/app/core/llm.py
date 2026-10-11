import logging
from langchain_groq import ChatGroq
from app.config import settings

logger = logging.getLogger(__name__)

def resolve_model(model: str | None) -> str:
    """Returns the requested model if it is allowed, otherwise the default model."""
    if model and model in settings.AVAILABLE_MODELS:
        return model
    if model:
        logger.warning(f"Model '{model}' is not in AVAILABLE_MODELS; using {settings.DEFAULT_MODEL}.")
    return settings.DEFAULT_MODEL

def get_llm(temperature: float = 0.7, model: str | None = None) -> ChatGroq:
    """
    Factory function returning configured Groq Chat LLM client.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY is not set in settings. LLM calls may fail.")

    return ChatGroq(
        model=resolve_model(model),
        temperature=temperature,
        groq_api_key=settings.GROQ_API_KEY
    )
