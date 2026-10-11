from typing import Optional
from pydantic import BaseModel, Field

class VaultUploadResponse(BaseModel):
    status: str
    message: str
    saved_chunks: Optional[int] = None
    source_id: Optional[str] = None
    voice_id: Optional[str] = None

class VaultTextRequest(BaseModel):
    title: str = Field(default="Pasted text", max_length=200)
    text: str = Field(min_length=50, max_length=200_000)
    voice_id: Optional[str] = None

class VaultUrlRequest(BaseModel):
    url: str = Field(max_length=2048)
    voice_id: Optional[str] = None

class VaultSource(BaseModel):
    id: str
    voice_id: Optional[str] = None
    name: str
    source_type: str
    chunk_count: int
    created_at: str

class Voice(BaseModel):
    id: str
    name: str
    style_profile: Optional[str] = None
    created_at: str
    source_count: int = 0
    chunk_count: int = 0

class VoiceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)

class VoiceProfileResponse(BaseModel):
    style_profile: Optional[str] = None
