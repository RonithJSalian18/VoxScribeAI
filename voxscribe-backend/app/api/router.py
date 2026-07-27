from fastapi import APIRouter
from app.api.endpoints import health, vault, generate

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(vault.router, prefix="/vault", tags=["Brand Voice Vault"])
api_router.include_router(generate.router, prefix="/generate", tags=["Generation"])
