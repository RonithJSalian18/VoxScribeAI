import logging
from langchain_core.messages import HumanMessage
from app.agents.state import GraphState
from app.agents.nodes.researcher import get_llm

logger = logging.getLogger(__name__)

def editor_node(state: GraphState) -> dict:
    """Agent 3: Senior SEO Editor polishing title, layout, and Markdown output."""
    logger.info("--- [Agent 3] EDITOR WORKING ---")
    
    if state.get("error"):
        logger.warning("Skipping editor node due to earlier error.")
        return {"final_post": f"Error during generation: {state['error']}"}

    draft = state.get("draft", "")
    if not draft:
        return {"final_post": "Error: Empty draft received."}

    prompt = f"""You are a senior SEO editor. Review and polish this blog draft.
1. Add a compelling, high-converting H1 title at the very top.
2. Ensure markdown formatting is clean and professional.
3. Output ONLY the final blog post content in Markdown, with no meta commentary.

Draft:
{draft}"""

    llm = get_llm()
    try:
        final_response = llm.invoke([HumanMessage(content=prompt)])
        return {"final_post": final_response.content}
    except Exception as e:
        logger.error(f"Editor LLM error: {e}")
        return {"final_post": draft}  # Fallback to draft if editor fails
