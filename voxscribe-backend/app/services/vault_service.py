import logging
import random
import uuid
from langchain_core.messages import HumanMessage
from app.core.llm import get_llm
from app.services.pdf_service import chunk_text
from app.services.supabase_service import require_supabase, save_document_chunks

logger = logging.getLogger(__name__)

DEFAULT_VOICE_NAME = "Default"
PROFILE_SAMPLE_CHUNKS = 8

class VaultNotFoundError(LookupError):
    """Raised when a voice or source does not exist or belongs to another user."""

def _validate_id(value: str, kind: str) -> str:
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError):
        raise VaultNotFoundError(f"{kind} not found.")

# ---------------------------------------------------------------------------
# Voices
# ---------------------------------------------------------------------------

def list_voices(user_id: str) -> list[dict]:
    """Returns the user's voices with source and chunk counts, oldest first."""
    client = require_supabase()
    voices = (
        client.table("voices")
        .select("id, name, style_profile, created_at")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
        .data
        or []
    )
    sources = (
        client.table("vault_sources")
        .select("voice_id, chunk_count")
        .eq("user_id", user_id)
        .execute()
        .data
        or []
    )
    for voice in voices:
        voice_sources = [s for s in sources if s["voice_id"] == voice["id"]]
        voice["source_count"] = len(voice_sources)
        voice["chunk_count"] = sum(s["chunk_count"] for s in voice_sources)
    return voices

def get_voice(user_id: str, voice_id: str) -> dict:
    voice_id = _validate_id(voice_id, "Voice")
    client = require_supabase()
    rows = (
        client.table("voices")
        .select("id, name, style_profile, created_at")
        .eq("user_id", user_id)
        .eq("id", voice_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise VaultNotFoundError("Voice not found.")
    return rows[0]

def create_voice(user_id: str, name: str) -> dict:
    client = require_supabase()
    return (
        client.table("voices")
        .insert({"user_id": user_id, "name": name.strip()})
        .execute()
        .data[0]
    )

def rename_voice(user_id: str, voice_id: str, name: str) -> dict:
    get_voice(user_id, voice_id)
    client = require_supabase()
    return (
        client.table("voices")
        .update({"name": name.strip()})
        .eq("user_id", user_id)
        .eq("id", voice_id)
        .execute()
        .data[0]
    )

def delete_voice(user_id: str, voice_id: str) -> None:
    """Deletes a voice; its sources and chunks are removed by ON DELETE CASCADE."""
    get_voice(user_id, voice_id)
    require_supabase().table("voices").delete().eq("user_id", user_id).eq("id", voice_id).execute()

def resolve_voice(user_id: str, voice_id: str | None) -> dict:
    """Returns the requested voice, or the user's first voice (creating a default one if needed)."""
    if voice_id:
        return get_voice(user_id, voice_id)

    voices = list_voices(user_id)
    if voices:
        return voices[0]
    return create_voice(user_id, DEFAULT_VOICE_NAME)

# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------

def list_sources(user_id: str, voice_id: str | None = None) -> list[dict]:
    client = require_supabase()
    query = (
        client.table("vault_sources")
        .select("id, voice_id, name, source_type, chunk_count, created_at")
        .eq("user_id", user_id)
    )
    if voice_id:
        query = query.eq("voice_id", _validate_id(voice_id, "Voice"))
    return query.order("created_at", desc=True).execute().data or []

def delete_source(user_id: str, source_id: str) -> str:
    """Deletes a source and (via cascade) its chunks. Returns the source's voice ID."""
    source_id = _validate_id(source_id, "Source")
    client = require_supabase()
    rows = (
        client.table("vault_sources")
        .select("id, voice_id")
        .eq("user_id", user_id)
        .eq("id", source_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise VaultNotFoundError("Source not found.")
    client.table("vault_sources").delete().eq("user_id", user_id).eq("id", source_id).execute()
    return rows[0]["voice_id"]

def ingest_text(user_id: str, voice_id: str, name: str, source_type: str, text: str) -> dict:
    """
    Creates a vault source, chunks and embeds its text, and records the chunk count.
    The source is removed again if embedding fails, so no empty sources are left behind.
    """
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("The provided content did not contain enough text to learn from.")

    client = require_supabase()
    source = (
        client.table("vault_sources")
        .insert({
            "user_id": user_id,
            "voice_id": voice_id,
            "name": name[:200],
            "source_type": source_type,
        })
        .execute()
        .data[0]
    )

    try:
        saved = save_document_chunks(user_id, chunks, voice_id=voice_id, source_id=source["id"])
    except Exception:
        client.table("vault_sources").delete().eq("id", source["id"]).execute()
        raise

    client.table("vault_sources").update({"chunk_count": saved}).eq("id", source["id"]).execute()
    source["chunk_count"] = saved
    return source

# ---------------------------------------------------------------------------
# Style profile
# ---------------------------------------------------------------------------

def generate_style_profile(user_id: str, voice_id: str) -> str | None:
    """
    Summarizes a voice's writing style from a sample of its chunks and stores it on the voice.
    Returns the profile, or None if the voice has no samples.
    """
    client = require_supabase()
    rows = (
        client.table("documents")
        .select("content")
        .eq("user_id", user_id)
        .eq("voice_id", voice_id)
        .limit(200)
        .execute()
        .data
        or []
    )

    if not rows:
        client.table("voices").update({"style_profile": None}).eq("id", voice_id).execute()
        return None

    samples = random.sample(rows, min(PROFILE_SAMPLE_CHUNKS, len(rows)))
    joined = "\n\n---\n\n".join(r["content"] for r in samples)

    prompt = f"""You are a writing-style analyst. Study these writing samples from one author and produce a concise style guide (max 200 words) that another writer could follow to sound exactly like them.

Cover: tone and personality, sentence length and rhythm, paragraph structure, point of view (I/we/you), vocabulary and signature phrases, use of humor, questions, lists or examples, and anything they avoid.

Write the guide as short bullet points. Output ONLY the guide.

Samples:
{joined}"""

    profile = get_llm(temperature=0.3).invoke([HumanMessage(content=prompt)]).content.strip()
    client.table("voices").update({"style_profile": profile}).eq("id", voice_id).execute()
    return profile

def refresh_style_profile_safely(user_id: str, voice_id: str) -> None:
    """Background-task wrapper that never raises."""
    try:
        generate_style_profile(user_id, voice_id)
    except Exception as e:
        logger.warning(f"Failed to refresh style profile for voice {voice_id}: {e}")
