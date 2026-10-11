import logging
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from app.core.auth import AuthUser, get_current_user
from app.core.rate_limit import rate_limit
from app.schemas.vault import (
    VaultSource,
    VaultTextRequest,
    VaultUploadResponse,
    VaultUrlRequest,
)
from app.services import vault_service
from app.services.text_extraction import ExtractionError, extract_text_from_file, fetch_url_text

logger = logging.getLogger(__name__)
router = APIRouter()

async def _ingest(
    user: AuthUser,
    voice_id: str | None,
    name: str,
    source_type: str,
    text: str,
    background_tasks: BackgroundTasks,
) -> VaultUploadResponse:
    """Stores text in the user's vault and schedules a style-profile refresh for the voice."""
    try:
        voice = vault_service.resolve_voice(user.id, voice_id)
    except vault_service.VaultNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    try:
        source = await run_in_threadpool(
            vault_service.ingest_text, user.id, voice["id"], name, source_type, text
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Vault ingest error: {e}")
        return VaultUploadResponse(status="Error", message=f"Failed to save writing sample: {e}")

    background_tasks.add_task(vault_service.refresh_style_profile_safely, user.id, voice["id"])

    return VaultUploadResponse(
        status="Success",
        message=f"Processed and saved {source['chunk_count']} writing style chunks to \"{voice['name']}\".",
        saved_chunks=source["chunk_count"],
        source_id=source["id"],
        voice_id=voice["id"],
    )

@router.post("/upload", response_model=VaultUploadResponse)
async def upload_to_vault(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    voice_id: str | None = Form(None),
    user: AuthUser = Depends(rate_limit("vault", 20)),
):
    """
    Parses an uploaded writing sample (PDF, DOCX, TXT or MD), converts chunks into
    vector embeddings, and stores them in Supabase under the user's voice for RAG matching.
    """
    try:
        text, source_type = extract_text_from_file(file.filename or "", await file.read())
    except ExtractionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return await _ingest(user, voice_id, file.filename or "Upload", source_type, text, background_tasks)

@router.post("/text", response_model=VaultUploadResponse)
async def add_text_to_vault(
    request: VaultTextRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(rate_limit("vault", 20)),
):
    """Adds pasted text as a writing sample."""
    return await _ingest(user, request.voice_id, request.title or "Pasted text", "text", request.text, background_tasks)

@router.post("/url", response_model=VaultUploadResponse)
async def add_url_to_vault(
    request: VaultUrlRequest,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(rate_limit("vault", 20)),
):
    """Imports one of the user's published articles from a public URL as a writing sample."""
    try:
        title, text = await run_in_threadpool(fetch_url_text, request.url)
    except ExtractionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.warning(f"URL import failed for {request.url}: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not fetch that URL.")

    return await _ingest(user, request.voice_id, title, "url", text, background_tasks)

@router.get("/sources", response_model=list[VaultSource])
def list_vault_sources(
    voice_id: str | None = None,
    user: AuthUser = Depends(get_current_user),
):
    """Lists the writing samples in the user's vault, optionally filtered by voice."""
    try:
        return vault_service.list_sources(user.id, voice_id)
    except vault_service.VaultNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.delete("/sources/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vault_source(
    source_id: str,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(get_current_user),
):
    """Removes a writing sample and all of its embedded chunks."""
    try:
        voice_id = vault_service.delete_source(user.id, source_id)
    except vault_service.VaultNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    if voice_id:
        background_tasks.add_task(vault_service.refresh_style_profile_safely, user.id, voice_id)
