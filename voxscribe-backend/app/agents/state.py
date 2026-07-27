from typing import TypedDict, Optional

class GraphState(TypedDict):
    youtube_url: str
    user_id: Optional[str]
    transcript: str
    outline: str
    brand_voice: str
    draft: str
    final_post: str
    error: Optional[str]
