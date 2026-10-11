import logging
from dataclasses import dataclass
from app.config import settings
from app.services import transcript_cache
from app.services.text_extraction import ExtractionError, fetch_url_text
from app.services.transcription_service import TranscriptionError, transcribe_youtube_audio
from app.services.youtube_service import (
    build_timestamped_transcript,
    extract_youtube_id,
    fetch_caption_segments,
)

logger = logging.getLogger(__name__)

SOURCE_TYPES = ("youtube", "article", "text")

@dataclass
class SourceContent:
    transcript: str
    timestamped_transcript: str = ""
    title: str = ""

class SourceError(RuntimeError):
    """Raised when source content cannot be retrieved."""

def load_youtube(url: str) -> SourceContent:
    """Fetches captions; falls back to Whisper transcription when captions are unavailable."""
    video_id = extract_youtube_id(url)
    if not video_id:
        raise SourceError("Invalid YouTube URL format. Could not extract Video ID.")

    cached = transcript_cache.get_cached(video_id)
    if cached:
        logger.info(f"Transcript cache hit for {video_id}.")
        return SourceContent(*cached)

    try:
        segments = fetch_caption_segments(video_id)
        transcript = " ".join(s.text for s in segments)
        if transcript.strip():
            timestamped = build_timestamped_transcript(segments)
            transcript_cache.store(video_id, transcript, timestamped)
            return SourceContent(transcript, timestamped)
        caption_error = "Transcript is empty for this video."
    except Exception as e:
        caption_error = f"Failed to retrieve transcript: {e}"

    if not settings.ENABLE_WHISPER_FALLBACK:
        raise SourceError(caption_error)

    logger.info(f"No captions for {video_id}; falling back to Whisper transcription.")
    try:
        transcript, timestamped = transcribe_youtube_audio(video_id)
    except TranscriptionError as e:
        raise SourceError(f"{caption_error} Whisper fallback also failed: {e}")
    transcript_cache.store(video_id, transcript, timestamped)
    return SourceContent(transcript, timestamped)

def load_article(url: str) -> SourceContent:
    try:
        title, text = fetch_url_text(url)
    except ExtractionError as e:
        raise SourceError(str(e))
    return SourceContent(transcript=text, title=title)

def load_source(source_type: str, source_url: str) -> SourceContent:
    """Retrieves the raw text for a generation source."""
    if source_type == "youtube":
        return load_youtube(source_url)
    if source_type == "article":
        return load_article(source_url)
    raise SourceError(f"Unsupported source type: {source_type}")
