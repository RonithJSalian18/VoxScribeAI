from typing import TypedDict, Optional

class GraphState(TypedDict, total=False):
    # Input
    source_type: str              # youtube | article | text
    source_url: str               # YouTube/article URL, or a label such as "audio:episode.mp3"
    options: dict                 # see app.agents.prompts.normalize_options
    user_id: Optional[str]
    voice_id: Optional[str]
    style_profile: Optional[str]

    # Researcher
    transcript: str
    timestamped_transcript: str
    source_title: str
    outline: str

    # Writer / Reviewer loop
    brand_voice: str
    draft: str
    review_score: Optional[int]
    review_feedback: str
    revision_count: int

    # Editor
    final_post: str
    error: Optional[str]
