import logging
import re
from dataclasses import dataclass
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)

PREFERRED_LANGUAGES = ["en", "en-US", "en-GB"]
TIMESTAMP_INTERVAL_SECONDS = 30

@dataclass
class Segment:
    start: float
    text: str

def extract_youtube_id(url: str) -> str | None:
    """
    Extracts 11-character YouTube video ID from various URL formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID
    """
    patterns = [
        r"(?:v=|\/embed\/|\/shorts\/|\/v\/|youtu\.be\/|\/e\/|\/live\/)([0-9A-Za-z_-]{11})",
        r"^([0-9A-Za-z_-]{11})$"
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def format_timestamp(seconds: float) -> str:
    seconds = int(seconds)
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"

def build_timestamped_transcript(segments: list[Segment], interval: int = TIMESTAMP_INTERVAL_SECONDS) -> str:
    """Groups segments into `[mm:ss] text` lines roughly every `interval` seconds."""
    lines: list[str] = []
    bucket: list[str] = []
    bucket_start: float | None = None

    for segment in segments:
        if bucket_start is None:
            bucket_start = segment.start
        bucket.append(segment.text.strip())
        if segment.start - bucket_start >= interval:
            lines.append(f"[{format_timestamp(bucket_start)}] {' '.join(bucket)}")
            bucket, bucket_start = [], None

    if bucket and bucket_start is not None:
        lines.append(f"[{format_timestamp(bucket_start)}] {' '.join(bucket)}")
    return "\n".join(lines)

def fetch_caption_segments(video_id: str) -> list[Segment]:
    """Fetches caption segments, preferring English but falling back to any available language."""
    api = YouTubeTranscriptApi()
    try:
        fetched = api.fetch(video_id, languages=PREFERRED_LANGUAGES)
    except Exception as first_error:
        try:
            transcripts = list(api.list(video_id))
        except Exception:
            raise first_error
        if not transcripts:
            raise first_error
        fetched = transcripts[0].fetch()

    return [Segment(start=float(s.start), text=s.text) for s in fetched if s.text.strip()]

def fetch_transcript(url: str) -> tuple[str | None, str | None]:
    """
    Fetches transcript text for a YouTube URL.
    Returns (transcript_text, error_message).
    """
    video_id = extract_youtube_id(url)
    if not video_id:
        return None, "Invalid YouTube URL format. Could not extract Video ID."

    try:
        segments = fetch_caption_segments(video_id)
    except Exception as e:
        return None, f"Failed to retrieve transcript: {str(e)}"

    full_transcript = " ".join(s.text for s in segments)
    if not full_transcript.strip():
        return None, "Transcript is empty for this video."
    return full_transcript, None
