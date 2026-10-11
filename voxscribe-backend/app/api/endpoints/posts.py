import logging
from fastapi import APIRouter, Depends, HTTPException, Response, status
from app.core.auth import AuthUser
from app.core.rate_limit import rate_limit
from app.schemas.posts import (
    ExportRequest,
    PublishRequest,
    PublishResponse,
    RewriteRequest,
    RewriteResponse,
    SeoRequest,
    SeoResponse,
)
from app.services import post_service, publish_service, vault_service
from app.services.docx_export import markdown_to_docx
from app.services.markdown_utils import slugify

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/rewrite", response_model=RewriteResponse)
def rewrite_passage(request: RewriteRequest, user: AuthUser = Depends(rate_limit("assist", 30))):
    """Rewrites a selected passage of a post in the user's voice."""
    style_profile = None
    if request.voice_id:
        try:
            style_profile = vault_service.get_voice(user.id, request.voice_id).get("style_profile")
        except vault_service.VaultNotFoundError as e:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    try:
        text = post_service.rewrite_text(request.text, request.instruction, request.context, style_profile)
    except Exception as e:
        logger.error(f"Rewrite failed: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="The AI rewrite failed. Please try again.")
    return RewriteResponse(text=text)

@router.post("/seo", response_model=SeoResponse)
def seo_analysis(request: SeoRequest, user: AuthUser = Depends(rate_limit("assist", 30))):
    """Generates meta description, slug, tags, readability and internal link suggestions."""
    return post_service.seo_suggestions(user.id, request.content, request.keyword, request.post_id)

@router.post("/export/docx")
def export_docx(request: ExportRequest, user: AuthUser = Depends(rate_limit("export", 30))):
    """Converts a post's Markdown into a downloadable Word document."""
    filename = f"{slugify(request.filename)}.docx"
    return Response(
        content=markdown_to_docx(request.content),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

publish_router = APIRouter()

@publish_router.post("/{platform}", response_model=PublishResponse)
def publish_post(platform: str, request: PublishRequest, user: AuthUser = Depends(rate_limit("publish", 10))):
    """
    Publishes a post to Dev.to, WordPress, Ghost or Hashnode (as a draft by default).
    Credentials are used for this request only and are never stored.
    """
    if platform not in publish_service.PLATFORMS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown platform '{platform}'.")

    try:
        result = publish_service.publish(platform, request)
    except publish_service.PublishError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Publishing to {platform} failed: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Could not reach {platform}.")

    return PublishResponse(platform=platform, status=request.status, url=result.get("url"), id=result.get("id"))
