"""Caches YouTube transcripts in Supabase so repeat generations skip fetching/transcription."""
import logging
from app.services import supabase_service

logger = logging.getLogger(__name__)

def get_cached(video_id: str) -> tuple[str, str] | None:
    """Returns (transcript, timestamped_transcript) for a video, or None on a miss."""
    client = supabase_service.supabase
    if not client:
        return None
    try:
        rows = (
            client.table("transcripts")
            .select("transcript, timestamped_transcript")
            .eq("video_id", video_id)
            .limit(1)
            .execute()
            .data
        )
    except Exception as e:
        logger.warning(f"Transcript cache read failed for {video_id}: {e}")
        return None
    return (rows[0]["transcript"], rows[0]["timestamped_transcript"] or "") if rows else None

def store(video_id: str, transcript: str, timestamped: str) -> None:
    """Saves a transcript; failures are logged and ignored (the cache is best-effort)."""
    client = supabase_service.supabase
    if not client:
        return
    try:
        client.table("transcripts").upsert({
            "video_id": video_id,
            "transcript": transcript,
            "timestamped_transcript": timestamped,
        }).execute()
    except Exception as e:
        logger.warning(f"Transcript cache write failed for {video_id}: {e}")
