from typing import Literal, Optional
from pydantic import BaseModel, Field

class RewriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    instruction: str = Field(default="Improve clarity and flow", max_length=300)
    context: str = Field(default="", max_length=6000, description="Surrounding content for coherence")
    voice_id: Optional[str] = None

class RewriteResponse(BaseModel):
    text: str

class SeoRequest(BaseModel):
    content: str = Field(min_length=1, max_length=100_000)
    keyword: str = Field(default="", max_length=100)
    post_id: Optional[str] = Field(default=None, description="Excluded from internal link suggestions")

class Readability(BaseModel):
    flesch_score: float
    level: str
    words: int
    reading_minutes: int

class InternalLink(BaseModel):
    post_id: str
    title: str
    anchor_text: str

class SeoResponse(BaseModel):
    title: str
    meta_description: str
    slug: str
    tags: list[str]
    readability: Readability
    internal_links: list[InternalLink]

class ExportRequest(BaseModel):
    content: str = Field(min_length=1, max_length=200_000)
    filename: str = Field(default="post", max_length=120)

class PublishRequest(BaseModel):
    content: str = Field(min_length=1, max_length=200_000)
    title: Optional[str] = Field(default=None, max_length=300)
    tags: list[str] = Field(default_factory=list, max_length=10)
    status: Literal["draft", "published"] = "draft"
    canonical_url: Optional[str] = Field(default=None, max_length=2048)
    # Platform credentials: sent per request, never stored server-side
    api_key: str = Field(min_length=1, max_length=2000)
    site_url: Optional[str] = Field(default=None, max_length=2048, description="WordPress/Ghost site URL")
    username: Optional[str] = Field(default=None, max_length=200, description="WordPress username")
    publication_id: Optional[str] = Field(default=None, max_length=200, description="Hashnode publication ID")

class PublishResponse(BaseModel):
    platform: str
    status: str
    url: Optional[str] = None
    id: Optional[str] = None
