import logging
import threading
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"  # 384 dimensions, matches documents.embedding

class LocalEmbeddings:
    """
    Runs all-MiniLM-L6-v2 on CPU via fastembed (ONNX, no PyTorch). Free, works offline after
    the first run (~90MB model download), and produces vectors compatible with the
    HuggingFace Inference API version of the same model.
    """

    def __init__(self, model_name: str = MODEL_NAME, cache_dir: str | None = None):
        self.model_name = model_name
        self.cache_dir = cache_dir or str(Path.home() / ".cache" / "fastembed")
        self._model = None
        self._lock = threading.Lock()

    def _get_model(self):
        # Loaded lazily so the API starts instantly and tests never download the model
        if self._model is None:
            with self._lock:
                if self._model is None:
                    from fastembed import TextEmbedding

                    logger.info(f"Loading local embedding model {self.model_name}...")
                    self._model = TextEmbedding(model_name=self.model_name, cache_dir=self.cache_dir)
        return self._model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self._get_model().embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]

def get_embeddings_model():
    """
    Returns the embedding model selected by EMBEDDINGS_PROVIDER:
    - "local" (default): free on-device inference with fastembed
    - "huggingface": HuggingFace Inference API (requires HUGGINGFACE_API_KEY and credits)
    """
    if settings.EMBEDDINGS_PROVIDER == "huggingface":
        if not settings.HUGGINGFACE_API_KEY:
            logger.warning("EMBEDDINGS_PROVIDER=huggingface but HUGGINGFACE_API_KEY is empty; using local embeddings.")
        else:
            from langchain_huggingface import HuggingFaceEndpointEmbeddings

            return HuggingFaceEndpointEmbeddings(
                model=MODEL_NAME,
                task="feature-extraction",
                huggingfacehub_api_token=settings.HUGGINGFACE_API_KEY,
            )

    return LocalEmbeddings()

# Singleton instance for reuse
embeddings = get_embeddings_model()
