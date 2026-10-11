import math
import re
import unicodedata
import markdown as md

def extract_title(content: str, fallback: str = "Untitled post") -> str:
    """Returns the first H1 heading's text, or the fallback."""
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    return strip_inline(match.group(1)) if match else fallback

def remove_title(content: str) -> str:
    """Removes the first H1 heading (platforms render the title separately)."""
    return re.sub(r"^#\s+.+\n?", "", content, count=1, flags=re.MULTILINE).lstrip()

def strip_inline(text: str) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    return re.sub(r"[*_`~]", "", text).strip()

def to_plain_text(content: str) -> str:
    """Strips Markdown syntax, leaving readable prose."""
    text = re.sub(r"```.*?```", "", content, flags=re.DOTALL)
    lines = []
    for line in text.splitlines():
        line = re.sub(r"^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+", "", line)
        if re.fullmatch(r"\s*([-*_]\s*){3,}", line):
            continue
        lines.append(strip_inline(line))
    return "\n".join(lines).strip()

def to_html(content: str) -> str:
    return md.markdown(content, extensions=["extra", "sane_lists"])

def slugify(text: str, max_length: int = 80) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
    slug = re.sub(r"[\s-]+", "-", text)
    return slug[:max_length].rstrip("-") or "post"

def _count_syllables(word: str) -> int:
    word = word.lower()
    groups = re.findall(r"[aeiouy]+", word)
    count = len(groups)
    if word.endswith("e") and count > 1 and not word.endswith(("le", "ee")):
        count -= 1
    return max(1, count)

def readability(content: str) -> dict:
    """
    Flesch Reading Ease (0-100, higher is easier) plus word count and reading time.
    Designed for English text; other languages produce rough estimates.
    """
    text = to_plain_text(content)
    words = re.findall(r"[A-Za-zÀ-ɏ']+", text)
    sentences = max(1, len(re.findall(r"[.!?]+(?:\s|$)", text)))
    word_count = len(words)

    if word_count == 0:
        return {"flesch_score": 0.0, "level": "n/a", "words": 0, "reading_minutes": 0}

    syllables = sum(_count_syllables(w) for w in words)
    score = 206.835 - 1.015 * (word_count / sentences) - 84.6 * (syllables / word_count)
    score = round(max(0.0, min(100.0, score)), 1)

    if score >= 80:
        level = "Very easy"
    elif score >= 60:
        level = "Easy to read"
    elif score >= 50:
        level = "Fairly difficult"
    elif score >= 30:
        level = "Difficult"
    else:
        level = "Very difficult"

    return {
        "flesch_score": score,
        "level": level,
        "words": len(re.findall(r"\S+", text)),
        "reading_minutes": max(1, math.ceil(len(re.findall(r"\S+", text)) / 230)),
    }
