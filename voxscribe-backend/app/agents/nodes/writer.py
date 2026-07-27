import logging
from langchain_core.messages import HumanMessage
from app.agents.state import GraphState
from app.agents.nodes.researcher import get_llm
from app.services.supabase_service import search_brand_voice

logger = logging.getLogger(__name__)

def writer_node(state: GraphState) -> dict:
    """Agent 2: Queries Brand Voice Vault (RAG) and drafts the post in user's tone."""
    logger.info("--- [Agent 2] WRITER WORKING ---")
    
    if state.get("error"):
        logger.warning("Skipping writer node due to earlier error.")
        return {"draft": "", "brand_voice": ""}

    user_id = state.get("user_id")
    outline = state.get("outline", "")
    
    brand_voice_context = ""
    if user_id and outline:
        retrieved_chunks = search_brand_voice(user_id=user_id, query_text=outline[:1000])
        if retrieved_chunks:
            brand_voice_context = "\n\n---\n\n".join(retrieved_chunks)
            logger.info(f"Retrieved {len(retrieved_chunks)} Brand Voice style samples.")

    prompt = f"""Write a comprehensive, engaging blog post based on this outline.
Use markdown formatting (clear headers, bullet points, concise paragraphs).

Outline:
{outline}"""

    if brand_voice_context:
        prompt += f"""\n\nCRITICAL INSTRUCTION:
You MUST mimic the exact tone, vocabulary, sentence structure, and writing style of the following sample writing from the user:

{brand_voice_context}"""

    llm = get_llm()
    try:
        draft_response = llm.invoke([HumanMessage(content=prompt)])
        return {
            "draft": draft_response.content,
            "brand_voice": brand_voice_context
        }
    except Exception as e:
        logger.error(f"Writer LLM error: {e}")
        return {
            "draft": "",
            "brand_voice": brand_voice_context,
            "error": f"Failed to draft blog post: {str(e)}"
        }
