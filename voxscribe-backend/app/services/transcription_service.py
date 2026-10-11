import logging
import tempfile
from pathlib import Path
from groq import Groq
from app.config import settings
from app.services.youtube_service import Segment, build_timestamped_transcript

logger = logging.getLogger(__name__)

WHISPER_MODEL = "whisper-large-v3-turbo"
MAX_AUDIO_BYTES = 25 * 1024 * 1024  # Groq free-tier upload limit
SUPPORTED_AUDIO_EXTENSIONS = {"mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac"}

class TranscriptionError(RuntimeError):
    """Raised when audio cannot be transcribed."""

def transcribe_audio(filename: str, data: bytes) -> tuple[str, str]:
    """
    Transcribes audio with Groq Whisper.
    Returns (plain_transcript, timestamped_transcript).
    """
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in SUPPORTED_AUDIO_EXTENSIONS:
        raise TranscriptionError(
            "Unsupported audio format. Upload MP3, M4A, WAV, WEBM, OGG, FLAC or MP4."
        )
    if len(data) > MAX_AUDIO_BYTES:
        raise TranscriptionError("Audio file is too large. The maximum size is 25MB.")
    if not settings.GROQ_API_KEY:
        raise TranscriptionError("GROQ_API_KEY is not configured on the server.")

    client = Groq(api_key=settings.GROQ_API_KEY)
    result = client.audio.transcriptions.create(
        model=WHISPER_MODEL,
        file=(filename, data),
        response_format="verbose_json",
    )

    text = (getattr(result, "text", "") or "").strip()
    raw_segments = getattr(result, "segments", None) or []
    segments = [
        Segment(start=float(s["start"] if isinstance(s, dict) else s.start),
                text=s["text"] if isinstance(s, dict) else s.text)
        for s in raw_segments
    ]

    if not text:
        raise TranscriptionError("No speech was detected in the audio.")
    return text, build_timestamped_transcript(segments) if segments else ""

def transcribe_youtube_audio(video_id: str) -> tuple[str, str]:
    """
    Fallback for videos without captions: downloads the smallest audio-only stream
    with yt-dlp and transcribes it with Whisper. Returns (plain, timestamped).
    """
    try:
        import yt_dlp
    except ImportError:
        raise TranscriptionError("yt-dlp is not installed; cannot transcribe videos without captions.")

    with tempfile.TemporaryDirectory() as tmp:
        options = {
            # Smallest audio-only stream under the upload limit; no ffmpeg post-processing needed
            "format": f"worstaudio[filesize<{MAX_AUDIO_BYTES}]/worstaudio[filesize_approx<{MAX_AUDIO_BYTES}]/worstaudio",
            "outtmpl": str(Path(tmp) / "%(id)s.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }
        try:
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
                path = Path(ydl.prepare_filename(info))
        except Exception as e:
            raise TranscriptionError(f"Could not download the video's audio: {e}")

        if not path.exists():
            raise TranscriptionError("Audio download failed.")
        return transcribe_audio(path.name, path.read_bytes())
