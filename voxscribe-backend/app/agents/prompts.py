"""Prompt fragments that turn generation options into agent instructions."""

OUTPUT_FORMATS = ("blog", "twitter_thread", "linkedin", "newsletter", "show_notes")
LENGTHS = ("short", "medium", "long")

FORMAT_LABELS = {
    "blog": "blog post",
    "twitter_thread": "X (Twitter) thread",
    "linkedin": "LinkedIn post",
    "newsletter": "email newsletter",
    "show_notes": "podcast/video show notes",
}

LENGTH_TARGETS = {
    "blog": {"short": "about 600 words", "medium": "about 1,200 words", "long": "about 2,000 words"},
    "newsletter": {"short": "about 400 words", "medium": "about 700 words", "long": "about 1,100 words"},
    "linkedin": {"short": "about 120 words", "medium": "about 220 words", "long": "about 350 words"},
    "twitter_thread": {"short": "5 tweets", "medium": "8 tweets", "long": "12 tweets"},
    "show_notes": {"short": "a brief summary", "medium": "a standard summary", "long": "a detailed summary"},
}

FORMAT_WRITER_RULES = {
    "blog": """Write a comprehensive, engaging blog post.
Use markdown formatting (clear H2/H3 headers, bullet points, concise paragraphs).""",
    "twitter_thread": """Write an X (Twitter) thread.
- Number each tweet like "1/", "2/" and separate tweets with a blank line.
- Every tweet MUST be 280 characters or fewer.
- Tweet 1 is a scroll-stopping hook; the last tweet is a takeaway or call to action.
- No markdown headers.""",
    "linkedin": """Write a LinkedIn post.
- Open with a one-line hook, then short 1-2 sentence paragraphs with line breaks.
- Share concrete insights or a story, end with a question to drive comments.
- Finish with 3-5 relevant hashtags. No markdown headers.""",
    "newsletter": """Write an email newsletter issue in markdown.
- Start with "**Subject:** ..." and "**Preview:** ..." lines.
- Then a warm greeting, the main content with H2 sections, and a sign-off.""",
    "show_notes": """Write show notes in markdown with these sections:
## Summary
## Key Takeaways (bullet list)
## Chapters (a list of "MM:SS - Chapter title" lines using the transcript timestamps)
## Notable Quotes
## Resources Mentioned (only if any are mentioned)""",
}

FORMAT_EDITOR_RULES = {
    "blog": """1. Add a compelling, high-converting H1 title at the very top.
2. Ensure markdown formatting is clean and professional, with descriptive H2/H3 subheadings.""",
    "twitter_thread": """1. Make sure every tweet is 280 characters or fewer and numbered "1/", "2/", ...
2. Sharpen the hook in tweet 1. Do NOT add an H1 title.""",
    "linkedin": """1. Make the first line an irresistible hook (it is all readers see before "see more").
2. Keep paragraphs to 1-2 sentences. Do NOT add an H1 title.""",
    "newsletter": """1. Make the Subject line compelling and under 60 characters; keep the Preview line under 100 characters.
2. Ensure markdown formatting is clean.""",
    "show_notes": """1. Add an H1 title at the top.
2. Make sure chapter timestamps are in ascending order and match the transcript.""",
}

def normalize_options(options: dict | None) -> dict:
    """Fills in defaults so agents can rely on every key being present."""
    options = dict(options or {})
    if options.get("output_format") not in OUTPUT_FORMATS:
        options["output_format"] = "blog"
    if options.get("length") not in LENGTHS:
        options["length"] = "medium"
    options.setdefault("tone", "")
    options.setdefault("audience", "")
    options.setdefault("language", "English")
    options.setdefault("keyword", "")
    options.setdefault("model", "")
    return options

def format_label(options: dict) -> str:
    return FORMAT_LABELS[options["output_format"]]

def audience_and_language(options: dict) -> str:
    """Instructions shared by every agent: target audience and output language."""
    lines = []
    if options.get("audience"):
        lines.append(f"- Target audience: {options['audience']}.")
    if options.get("language") and options["language"].lower() != "english":
        lines.append(f"- Write entirely in {options['language']}.")
    return "\n".join(lines)

def writer_instructions(options: dict) -> str:
    fmt = options["output_format"]
    lines = [
        FORMAT_WRITER_RULES[fmt],
        f"- Target length: {LENGTH_TARGETS[fmt][options['length']]}.",
    ]
    if options.get("tone"):
        lines.append(f"- Tone: {options['tone']} (while still sounding like the author).")
    if options.get("keyword") and fmt in ("blog", "newsletter"):
        lines.append(
            f'- SEO: naturally include the keyword "{options["keyword"]}" in the first paragraph '
            "and at least one subheading. Do not keyword-stuff."
        )
    shared = audience_and_language(options)
    if shared:
        lines.append(shared)
    return "\n".join(lines)

def editor_instructions(options: dict) -> str:
    fmt = options["output_format"]
    lines = [FORMAT_EDITOR_RULES[fmt]]
    if options.get("keyword") and fmt in ("blog", "newsletter"):
        lines.append(f'3. Include the SEO keyword "{options["keyword"]}" in the title if it reads naturally.')
    lines.append("Output ONLY the final content in Markdown, with no meta commentary.")
    shared = audience_and_language(options)
    if shared:
        lines.append(shared)
    return "\n".join(lines)
