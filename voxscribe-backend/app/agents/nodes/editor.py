import logging
from langchain_core.messages import HumanMessage
from app.agents.prompts import editor_instructions, format_label, normalize_options
from app.agents.state import GraphState
from app.core.llm import get_llm

logger = logging.getLogger(__name__)

def editor_node(state: GraphState) -> dict:
    """Agent 4: Senior Editor polishing title, layout, and Markdown output for the chosen format."""
    logger.info("--- [Agent 4] EDITOR WORKING ---")

    if state.get("error"):
        logger.warning("Skipping editor node due to earlier error.")
        return {"final_post": f"Error during generation: {state['error']}"}

    draft = state.get("draft", "")
    if not draft:
        return {"final_post": "Error: Empty draft received."}

    options = normalize_options(state.get("options"))
    prompt = f"""You are a senior editor. Review and polish this {format_label(options)} draft.
{editor_instructions(options)}

Draft:
{draft}"""

    try:
        final_response = get_llm(temperature=0.4, model=options.get("model")).invoke([HumanMessage(content=prompt)])
        return {"final_post": final_response.content}
    except Exception as e:
        logger.error(f"Editor LLM error: {e}")
        return {"final_post": draft}  # Fallback to draft if editor fails
