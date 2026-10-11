from fastapi import APIRouter
from app.api.endpoints import health, meta, vault, voices, generate, posts

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(meta.router, tags=["Account"])
api_router.include_router(vault.router, prefix="/vault", tags=["Brand Voice Vault"])
api_router.include_router(voices.router, prefix="/voices", tags=["Brand Voices"])
api_router.include_router(generate.router, prefix="/generate", tags=["Generation"])
api_router.include_router(posts.router, prefix="/posts", tags=["Posts"])
api_router.include_router(posts.publish_router, prefix="/publish", tags=["Publishing"])
