import logging
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, HttpUrl
from app.agents.graph import agent_graph

logger = logging.getLogger(__name__)
router = APIRouter()

class GenerateRequest(BaseModel):
    youtube_url: str
    user_id: Optional[str] = None

@router.post("")
async def generate_blog(request: GenerateRequest):
    """
    Executes the multi-agent LangGraph workflow to generate a personalized blog post
    from a YouTube URL using the user's Brand Voice Vault.
    """
    logger.info(f"Received blog generation request for URL: {request.youtube_url}")
    
    try:
        initial_state = {
            "youtube_url": request.youtube_url,
            "user_id": request.user_id
        }
        
        result = agent_graph.invoke(initial_state)
        
        if result.get("error"):
            return {
                "status": "error",
                "message": result["error"]
            }
            
        return {
            "status": "success",
            "blog_post": result.get("final_post", "")
        }

    except Exception as e:
        logger.error(f"Generation endpoint exception: {e}")
        return {
            "status": "error",
            "message": str(e)
        }
