from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import AuthUser, get_current_user
from app.core.rate_limit import rate_limit
from app.schemas.vault import Voice, VoiceCreateRequest, VoiceProfileResponse
from app.services import vault_service

router = APIRouter()

def _not_found(e: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("", response_model=list[Voice])
def list_voices(user: AuthUser = Depends(get_current_user)):
    """Lists the user's Brand Voices, creating a default one on first use."""
    voices = vault_service.list_voices(user.id)
    if not voices:
        vault_service.create_voice(user.id, vault_service.DEFAULT_VOICE_NAME)
        voices = vault_service.list_voices(user.id)
    return voices

@router.post("", response_model=Voice, status_code=status.HTTP_201_CREATED)
def create_voice(request: VoiceCreateRequest, user: AuthUser = Depends(get_current_user)):
    return vault_service.create_voice(user.id, request.name)

@router.patch("/{voice_id}", response_model=Voice)
def rename_voice(
    voice_id: str,
    request: VoiceCreateRequest,
    user: AuthUser = Depends(get_current_user),
):
    try:
        return vault_service.rename_voice(user.id, voice_id, request.name)
    except vault_service.VaultNotFoundError as e:
        raise _not_found(e)

@router.delete("/{voice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voice(voice_id: str, user: AuthUser = Depends(get_current_user)):
    """Deletes a voice together with all of its writing samples."""
    try:
        vault_service.delete_voice(user.id, voice_id)
    except vault_service.VaultNotFoundError as e:
        raise _not_found(e)

@router.post("/{voice_id}/profile", response_model=VoiceProfileResponse)
def refresh_voice_profile(voice_id: str, user: AuthUser = Depends(rate_limit("profile", 10))):
    """Re-analyzes the voice's writing samples and regenerates its style profile."""
    try:
        vault_service.get_voice(user.id, voice_id)
    except vault_service.VaultNotFoundError as e:
        raise _not_found(e)

    profile = vault_service.generate_style_profile(user.id, voice_id)
    return VoiceProfileResponse(style_profile=profile)
