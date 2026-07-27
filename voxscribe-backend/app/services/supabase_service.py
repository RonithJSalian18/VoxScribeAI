import logging
from supabase import create_client, Client
from app.config import settings
from app.core.embeddings import embeddings

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client | None:
    """Initializes and returns Supabase Client instance."""
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        try:
            return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
    return None

supabase: Client | None = get_supabase_client()

def save_document_chunks(user_id: str, chunks: list[str]) -> int:
    """
    Embeds each chunk and stores it into the 'documents' table in Supabase.
    Returns count of successfully saved chunks.
    """
    if not supabase:
        raise RuntimeError("Supabase client is not configured.")

    saved_count = 0
    for chunk in chunks:
        vector = embeddings.embed_query(chunk)
        supabase.table("documents").insert({
            "user_id": user_id,
            "content": chunk,
            "embedding": vector
        }).execute()
        saved_count += 1

    return saved_count

def search_brand_voice(user_id: str, query_text: str, match_count: int = 3) -> list[str]:
    """
    Performs vector similarity search via Supabase match_documents RPC function.
    Returns matching text content chunks for the given user.
    """
    if not supabase or not user_id:
        return []

    try:
        query_vector = embeddings.embed_query(query_text)
        response = supabase.rpc(
            "match_documents",
            {
                "query_embedding": query_vector,
                "match_user_id": user_id,
                "match_threshold": 0.0,
                "match_count": match_count,
            }
        ).execute()

        if response.data:
            return [doc['content'] for doc in response.data]
    except Exception as e:
        logger.warning(f"Error executing vector search for user {user_id}: {e}")

    return []
