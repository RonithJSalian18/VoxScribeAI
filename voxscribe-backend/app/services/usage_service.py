from datetime import datetime, timedelta, timezone
from app.config import settings
from app.services.supabase_service import require_supabase

def _since_24h() -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

def generations_last_24h(user_id: str, cap: int | None = None) -> int:
    """Counts the user's generated posts in the last 24 hours (stops counting at `cap`)."""
    query = (
        require_supabase()
        .table("blog_posts")
        .select("id")
        .eq("user_id", user_id)
        .gte("created_at", _since_24h())
    )
    if cap:
        query = query.limit(cap)
    return len(query.execute().data or [])

def usage_summary(user_id: str) -> dict:
    client = require_supabase()
    posts = client.table("blog_posts").select("id, output_format").eq("user_id", user_id).execute().data or []
    sources = client.table("vault_sources").select("chunk_count").eq("user_id", user_id).execute().data or []
    voices = client.table("voices").select("id").eq("user_id", user_id).execute().data or []

    by_format: dict[str, int] = {}
    for post in posts:
        fmt = post.get("output_format") or "blog"
        by_format[fmt] = by_format.get(fmt, 0) + 1

    return {
        "generations_last_24h": generations_last_24h(user_id),
        "daily_limit": settings.DAILY_GENERATION_LIMIT,
        "total_posts": len(posts),
        "posts_by_format": by_format,
        "voices": len(voices),
        "samples": len(sources),
        "chunks": sum(s.get("chunk_count") or 0 for s in sources),
    }
