from fastapi import APIRouter
from app.config import settings

router = APIRouter()

@router.get("/")
def read_root():
    return {
        "status": "online",
        "project": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION
    }
