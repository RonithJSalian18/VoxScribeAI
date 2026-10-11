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

def require_supabase() -> Client:
    """Returns the Supabase client or raises if it is not configured."""
    if not supabase:
        raise RuntimeError("Supabase client is not configured.")
    return supabase

def save_document_chunks(
    user_id: str,
    chunks: list[str],
    voice_id: str | None = None,
    source_id: str | None = None,
) -> int:
    """
    Embeds the chunks in one batch and stores them in the 'documents' table.
    Returns count of successfully saved chunks.
    """
    client = require_supabase()
    if not chunks:
        return 0

    vectors = embeddings.embed_documents(chunks)
    rows = [
        {
            "user_id": user_id,
            "voice_id": voice_id,
            "source_id": source_id,
            "content": chunk,
            "embedding": vector,
        }
        for chunk, vector in zip(chunks, vectors)
    ]
    client.table("documents").insert(rows).execute()
    return len(rows)

def save_blog_post(
    user_id: str,
    youtube_url: str,
    content: str,
    voice_id: str | None = None,
    source_type: str = "youtube",
    output_format: str = "blog",
) -> str | None:
    """
    Persists a generated blog post to the 'blog_posts' history table.
    Returns the new post ID, or None if saving failed.
    """
    if not supabase:
        return None

    try:
        response = supabase.table("blog_posts").insert({
            "user_id": user_id,
            "youtube_url": youtube_url,
            "content": content,
            "voice_id": voice_id,
            "source_type": source_type,
            "output_format": output_format,
        }).execute()
        if response.data:
            return response.data[0]["id"]
    except Exception as e:
        logger.warning(f"Failed to save blog post for user {user_id}: {e}")

    return None

def search_brand_voice(
    user_id: str,
    query_text: str,
    match_count: int = 3,
    voice_id: str | None = None,
) -> list[str]:
    """
    Performs vector similarity search via Supabase match_documents RPC function.
    Returns matching text content chunks for the given user (and voice, if provided).
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
                "match_voice_id": voice_id,
            }
        ).execute()

        if response.data:
            return [doc['content'] for doc in response.data]
    except Exception as e:
        logger.warning(f"Error executing vector search for user {user_id}: {e}")

    return []
