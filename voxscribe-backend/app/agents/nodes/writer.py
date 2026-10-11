import logging
from langchain_core.messages import HumanMessage
from app.agents.prompts import format_label, normalize_options, writer_instructions
from app.agents.state import GraphState
from app.core.llm import get_llm
from app.services.supabase_service import search_brand_voice

logger = logging.getLogger(__name__)

def writer_node(state: GraphState) -> dict:
    """Agent 2: Queries Brand Voice Vault (RAG) and drafts (or revises) the content in the user's tone."""
    logger.info("--- [Agent 2] WRITER WORKING ---")

    if state.get("error"):
        logger.warning("Skipping writer node due to earlier error.")
        return {"draft": "", "brand_voice": ""}

    options = normalize_options(state.get("options"))
    user_id = state.get("user_id")
    outline = state.get("outline", "")
    style_profile = state.get("style_profile")
    feedback = state.get("review_feedback", "")
    previous_draft = state.get("draft", "")
    is_revision = bool(feedback and previous_draft)

    # Reuse retrieved samples on revision instead of searching again
    brand_voice_context = state.get("brand_voice", "") if is_revision else ""
    if not is_revision and user_id and outline:
        retrieved_chunks = search_brand_voice(
            user_id=user_id,
            query_text=outline[:1000],
            voice_id=state.get("voice_id"),
        )
        if retrieved_chunks:
            brand_voice_context = "\n\n---\n\n".join(retrieved_chunks)
            logger.info(f"Retrieved {len(retrieved_chunks)} Brand Voice style samples.")

    if is_revision:
        prompt = f"""Revise this {format_label(options)} draft to address the editor's feedback, keeping everything that already works.

Editor feedback:
{feedback}

Current draft:
{previous_draft}

Requirements:
{writer_instructions(options)}

Outline it must cover:
{outline}"""
    else:
        prompt = f"""Write a {format_label(options)} based on this outline.

Requirements:
{writer_instructions(options)}

Outline:
{outline}"""

    if style_profile:
        prompt += f"""\n\nSTYLE GUIDE for this author (follow it closely):
{style_profile}"""

    if brand_voice_context:
        prompt += f"""\n\nCRITICAL INSTRUCTION:
You MUST mimic the exact tone, vocabulary, sentence structure, and writing style of the following sample writing from the user:

{brand_voice_context}"""

    prompt += "\n\nOutput ONLY the content itself, with no preamble."

    try:
        draft_response = get_llm(model=options.get("model")).invoke([HumanMessage(content=prompt)])
        result = {
            "draft": draft_response.content,
            "brand_voice": brand_voice_context,
        }
        if is_revision:
            result["revision_count"] = state.get("revision_count", 0) + 1
            result["review_feedback"] = ""
        return result
    except Exception as e:
        logger.error(f"Writer LLM error: {e}")
        return {
            "draft": "",
            "brand_voice": brand_voice_context,
            "error": f"Failed to draft content: {str(e)}"
        }
