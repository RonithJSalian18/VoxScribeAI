import logging
from langchain_core.messages import HumanMessage
from app.agents.prompts import audience_and_language, format_label, normalize_options
from app.agents.state import GraphState
from app.core.llm import get_llm
from app.services.source_service import SourceError, load_source

logger = logging.getLogger(__name__)

MAX_TRANSCRIPT_CHARS = 12000

def researcher_node(state: GraphState) -> dict:
    """Agent 1: Retrieves the source transcript/text and creates a structured outline."""
    logger.info("--- [Agent 1] RESEARCHER WORKING ---")
    options = normalize_options(state.get("options"))

    transcript = state.get("transcript") or ""
    timestamped = state.get("timestamped_transcript") or ""
    title = state.get("source_title") or ""

    # Audio/pasted sources arrive with a transcript already; URLs are fetched here
    if not transcript:
        try:
            source = load_source(state.get("source_type", "youtube"), state.get("source_url", ""))
        except SourceError as e:
            logger.error(f"Researcher failed: {e}")
            return {"transcript": "", "outline": "", "error": str(e)}
        transcript, timestamped, title = source.transcript, source.timestamped_transcript, source.title

    use_timestamps = options["output_format"] == "show_notes" and timestamped
    material = (timestamped if use_timestamps else transcript)[:MAX_TRANSCRIPT_CHARS]

    prompt = f"""Create a detailed, well-structured outline for a {format_label(options)} based on the source material below.
Capture the key ideas, arguments, examples and memorable quotes in a logical order.
{"Keep the [MM:SS] timestamps next to each section so chapters can be generated." if use_timestamps else ""}
{audience_and_language(options)}

Source material{f' ("{title}")' if title else ''}:
{material}"""

    try:
        outline_response = get_llm(model=options.get("model")).invoke([HumanMessage(content=prompt)])
        return {
            "transcript": transcript,
            "timestamped_transcript": timestamped,
            "source_title": title,
            "outline": outline_response.content,
            "options": options,
            "revision_count": 0,
            "error": None
        }
    except Exception as e:
        logger.error(f"Researcher LLM error: {e}")
        return {
            "transcript": transcript,
            "outline": "",
            "error": f"Failed to generate outline: {str(e)}"
        }
