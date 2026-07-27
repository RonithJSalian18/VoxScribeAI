import logging
from langchain_huggingface import HuggingFaceEmbeddings, HuggingFaceEndpointEmbeddings
from app.config import settings

logger = logging.get_logger(__name__) if hasattr(logging, "get_logger") else logging.getLogger(__name__)

def get_embeddings_model():
    """
    Returns configured HuggingFace embedding model.
    Prefers HuggingFace Inference API if key is set, falls back to local sentence-transformers.
    """
    if settings.HUGGINGFACE_API_KEY:
        try:
            return HuggingFaceEndpointEmbeddings(
                model="sentence-transformers/all-MiniLM-L6-v2",
                task="feature-extraction",
                huggingfacehub_api_token=settings.HUGGINGFACE_API_KEY,
            )
        except Exception as e:
            logger.warning(f"Failed to initialize HF Endpoint Embeddings: {e}. Falling back to local model.")
            
    return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Singleton instance for reuse
embeddings = get_embeddings_model()
