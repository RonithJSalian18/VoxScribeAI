from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator

OutputFormat = Literal["blog", "twitter_thread", "linkedin", "newsletter", "show_notes"]
SourceType = Literal["youtube", "article", "text"]

class GenerationOptions(BaseModel):
    output_format: OutputFormat = "blog"
    length: Literal["short", "medium", "long"] = "medium"
    tone: str = Field(default="", max_length=80)
    audience: str = Field(default="", max_length=200)
    language: str = Field(default="English", max_length=40)
    keyword: str = Field(default="", max_length=100)
    model: str = Field(default="", max_length=100, description="Groq model ID; must be one of GET /models")

class GenerateRequest(BaseModel):
    source_type: SourceType = "youtube"
    source_url: Optional[str] = Field(default=None, max_length=2048)
    youtube_url: Optional[str] = Field(default=None, max_length=2048, description="Deprecated alias for source_url")
    transcript: Optional[str] = Field(default=None, max_length=200_000, description="Raw text for source_type='text'")
    timestamped_transcript: Optional[str] = Field(default=None, max_length=300_000)
    source_label: Optional[str] = Field(default=None, max_length=200, description="Display name for text sources, e.g. an audio filename")
    voice_id: Optional[str] = None
    options: GenerationOptions = Field(default_factory=GenerationOptions)
    review_outline: bool = False

    @model_validator(mode="after")
    def check_source(self):
        self.source_url = self.source_url or self.youtube_url
        if self.source_type == "text":
            if not self.transcript or len(self.transcript.strip()) < 100:
                raise ValueError("A transcript of at least 100 characters is required for text sources.")
        elif not self.source_url:
            raise ValueError("source_url is required for YouTube and article sources.")
        return self

    @property
    def display_source(self) -> str:
        """Value stored in blog_posts.youtube_url (the post's source)."""
        if self.source_type == "text":
            return f"text:{self.source_label or 'Uploaded transcript'}"
        return self.source_url or ""

class ResumeRequest(BaseModel):
    thread_id: str
    outline: str = Field(min_length=1, max_length=50_000)

class GenerateResponse(BaseModel):
    status: str
    blog_post: Optional[str] = None
    post_id: Optional[str] = None
    message: Optional[str] = None

class TranscriptionResponse(BaseModel):
    transcript: str
    timestamped_transcript: str
    filename: str
