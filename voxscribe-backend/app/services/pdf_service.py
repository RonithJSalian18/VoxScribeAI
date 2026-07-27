import fitz  # PyMuPDF

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts raw text content from PDF bytes using PyMuPDF."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text_chunks = []
    for page in doc:
        page_text = page.get_text()
        if page_text:
            text_chunks.append(page_text)
    return "\n\n".join(text_chunks)

def chunk_text(text: str, max_chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Splits text into meaningful semantic chunks with overlap.
    Ensures chunks aren't cut mid-sentence where possible.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current_chunk = ""

    for paragraph in paragraphs:
        if len(current_chunk) + len(paragraph) <= max_chunk_size:
            current_chunk += ("\n\n" if current_chunk else "") + paragraph
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # Start new chunk with trailing overlap if possible
            overlap_prefix = current_chunk[-overlap:] if len(current_chunk) >= overlap else ""
            current_chunk = (overlap_prefix + "\n\n" if overlap_prefix else "") + paragraph

    if current_chunk:
        chunks.append(current_chunk)

    # Filter out tiny chunks
    return [c.strip() for c in chunks if len(c.strip()) >= 50]
