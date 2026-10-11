import json
import logging
import re
from langchain_core.messages import HumanMessage
from app.agents.prompts import format_label, normalize_options, writer_instructions
from app.agents.state import GraphState
from app.core.llm import get_llm

logger = logging.getLogger(__name__)

PASSING_SCORE = 7
MAX_REVISIONS = 1

def parse_review(text: str) -> tuple[int, str]:
    """Extracts (score, feedback) from the reviewer's JSON reply; treats unparseable replies as a pass."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            score = max(1, min(10, int(data.get("score", 10))))
            return score, str(data.get("feedback", "")).strip()
        except (ValueError, TypeError):
            pass
    logger.warning("Could not parse reviewer response; accepting draft.")
    return 10, ""

def reviewer_node(state: GraphState) -> dict:
    """Agent 3: Scores the draft and requests one revision if it falls short."""
    logger.info("--- [Agent 3] REVIEWER WORKING ---")

    if state.get("error") or not state.get("draft"):
        return {}

    options = normalize_options(state.get("options"))
    voice_samples = state.get("brand_voice", "")

    prompt = f"""You are a demanding content reviewer. Score this {format_label(options)} draft from 1 to 10 on:
- Voice match with the author's samples{" (none provided, judge clarity instead)" if not voice_samples else ""}
- Coverage of the outline's key points
- Structure, readability and adherence to the requirements

Requirements the draft must meet:
{writer_instructions(options)}

Outline:
{state.get("outline", "")[:3000]}

{f"Author's writing samples:{chr(10)}{voice_samples[:3000]}{chr(10)}" if voice_samples else ""}
Draft:
{state["draft"]}

Respond with ONLY a JSON object: {{"score": <integer 1-10>, "feedback": "<specific, actionable changes; empty if score >= {PASSING_SCORE}>"}}"""

    try:
        response = get_llm(temperature=0.1, model=options.get("model")).invoke([HumanMessage(content=prompt)])
        score, feedback = parse_review(response.content)
    except Exception as e:
        logger.warning(f"Reviewer LLM error, accepting draft: {e}")
        score, feedback = 10, ""

    logger.info(f"Reviewer score: {score}/10")
    return {
        "review_score": score,
        "review_feedback": feedback if score < PASSING_SCORE else "",
    }

def route_after_writer(state: GraphState) -> str:
    """Skip the reviewer on errors or once the revision budget is spent."""
    if state.get("error") or state.get("revision_count", 0) >= MAX_REVISIONS:
        return "editor"
    return "reviewer"

def route_after_review(state: GraphState) -> str:
    """Send the draft back to the writer when the reviewer asked for changes."""
    if state.get("review_feedback") and state.get("revision_count", 0) < MAX_REVISIONS:
        return "writer"
    return "editor"
