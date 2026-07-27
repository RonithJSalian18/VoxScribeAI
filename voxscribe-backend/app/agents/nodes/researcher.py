import logging
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from app.agents.state import GraphState
from app.services.youtube_service import fetch_transcript
from app.config import settings

logger = logging.getLogger(__name__)

def get_llm():
    """Returns Groq Chat LLM client."""
    return ChatGroq(
        model="llama-3.1-8b-instant",
        temperature=0.7,
        groq_api_key=settings.GROQ_API_KEY
    )

def researcher_node(state: GraphState) -> dict:
    """Agent 1: Extracts the transcript and creates a structured blog outline."""
    logger.info("--- [Agent 1] RESEARCHER WORKING ---")
    url = state.get("youtube_url", "")
    
    transcript, err = fetch_transcript(url)
    if err:
        logger.error(f"Researcher failed: {err}")
        return {
            "transcript": "",
            "outline": "",
            "error": err
        }
    
    llm = get_llm()
    prompt = f"Create a detailed, high-level blog post outline based on this YouTube transcript:\n\n{transcript[:5000]}"
    try:
        outline_response = llm.invoke([HumanMessage(content=prompt)])
        return {
            "transcript": transcript,
            "outline": outline_response.content,
            "error": None
        }
    except Exception as e:
        logger.error(f"Researcher LLM error: {e}")
        return {
            "transcript": transcript,
            "outline": "",
            "error": f"Failed to generate outline: {str(e)}"
        }
