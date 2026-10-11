import json
import logging
import re
from langchain_core.messages import HumanMessage
from app.core.llm import get_llm
from app.services import markdown_utils
from app.services.supabase_service import require_supabase

logger = logging.getLogger(__name__)

MAX_LINK_CANDIDATES = 40

def rewrite_text(text: str, instruction: str, context: str = "", style_profile: str | None = None) -> str:
    """Rewrites a passage per the instruction, preserving the author's voice and Markdown."""
    prompt = f"""Rewrite the PASSAGE below according to this instruction: "{instruction}".
- Keep the author's voice{" described in the style guide" if style_profile else ""}.
- Preserve Markdown formatting (headings, lists, links) where present.
- Keep it consistent with the surrounding content.
- Output ONLY the rewritten passage, no quotes or commentary.
{f"{chr(10)}STYLE GUIDE:{chr(10)}{style_profile}{chr(10)}" if style_profile else ""}
{f"SURROUNDING CONTENT (for context only, do not rewrite):{chr(10)}{context}{chr(10)}" if context else ""}
PASSAGE:
{text}"""
    return get_llm(temperature=0.6).invoke([HumanMessage(content=prompt)]).content.strip()

def _previous_posts(user_id: str, exclude_post_id: str | None) -> list[dict]:
    rows = (
        require_supabase()
        .table("blog_posts")
        .select("id, content, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(MAX_LINK_CANDIDATES + 1)
        .execute()
        .data
        or []
    )
    return [
        {"id": r["id"], "title": markdown_utils.extract_title(r["content"])}
        for r in rows
        if r["id"] != exclude_post_id
    ][:MAX_LINK_CANDIDATES]

def _parse_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except ValueError:
        return {}

def seo_suggestions(user_id: str, content: str, keyword: str = "", post_id: str | None = None) -> dict:
    """
    Builds SEO metadata for a post: meta description and tags (LLM), slug and readability
    (deterministic), and internal links to the user's earlier posts.
    """
    title = markdown_utils.extract_title(content)
    candidates = _previous_posts(user_id, post_id)
    candidate_lines = "\n".join(f"{i}. {c['title']}" for i, c in enumerate(candidates))

    prompt = f"""You are an SEO specialist. Analyze this post and respond with ONLY a JSON object:
{{
  "meta_description": "<compelling meta description, 140-160 characters{f', including the keyword {keyword!r}' if keyword else ''}>",
  "tags": ["<3 to 6 short lowercase topic tags>"],
  "internal_links": [{{"index": <number from the list of earlier posts>, "anchor_text": "<short phrase from this post to link from>"}}]
}}
Only suggest internal links to earlier posts that are genuinely related (at most 3; use [] if none).

Earlier posts by the same author:
{candidate_lines or "(none)"}

Post:
{content[:8000]}"""

    data: dict = {}
    try:
        data = _parse_json(get_llm(temperature=0.2).invoke([HumanMessage(content=prompt)]).content)
    except Exception as e:
        logger.warning(f"SEO LLM call failed: {e}")

    links = []
    for item in data.get("internal_links") or []:
        try:
            candidate = candidates[int(item["index"])]
        except (KeyError, ValueError, TypeError, IndexError):
            continue
        if candidate["id"] not in {l["post_id"] for l in links}:
            links.append({
                "post_id": candidate["id"],
                "title": candidate["title"],
                "anchor_text": str(item.get("anchor_text") or candidate["title"])[:120],
            })

    meta = str(data.get("meta_description") or "").strip()
    if not meta:
        meta = markdown_utils.to_plain_text(markdown_utils.remove_title(content))[:157].rstrip() + "..."

    tags = [str(t).strip().lower().lstrip("#") for t in data.get("tags") or [] if str(t).strip()][:6]

    return {
        "title": title,
        "meta_description": meta[:200],
        "slug": markdown_utils.slugify(title),
        "tags": tags,
        "readability": markdown_utils.readability(content),
        "internal_links": links[:3],
    }
