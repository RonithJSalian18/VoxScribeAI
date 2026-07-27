import re
from youtube_transcript_api import YouTubeTranscriptApi

def extract_youtube_id(url: str) -> str | None:
    """
    Extracts 11-character YouTube video ID from various URL formats:
    - https://www.youtube.com/watch?v=VIDEO_ID
    - https://youtu.be/VIDEO_ID
    - https://www.youtube.com/embed/VIDEO_ID
    - https://www.youtube.com/shorts/VIDEO_ID
    """
    patterns = [
        r"(?:v=|\/embed\/|\/shorts\/|\/v\/|youtu\.be\/|\/e\/)([0-9A-Za-z_-]{11})",
        r"^([0-9A-Za-z_-]{11})$"
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def fetch_transcript(url: str) -> tuple[str | None, str | None]:
    """
    Fetches transcript text for a YouTube URL.
    Returns (transcript_text, error_message).
    """
    video_id = extract_youtube_id(url)
    if not video_id:
        return None, "Invalid YouTube URL format. Could not extract Video ID."
        
    try:
        if hasattr(YouTubeTranscriptApi, 'get_transcript'):
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        else:
            api_instance = YouTubeTranscriptApi()
            transcript_list = api_instance.fetch(video_id)

        text_items = []
        for item in transcript_list:
            if isinstance(item, dict):
                text_items.append(item.get('text', ''))
            elif hasattr(item, 'text'):
                text_items.append(getattr(item, 'text', ''))

        full_transcript = " ".join(text_items)
        if not full_transcript.strip():
            return None, "Transcript is empty for this video."
        return full_transcript, None
    except Exception as e:
        return None, f"Failed to retrieve transcript: {str(e)}"
