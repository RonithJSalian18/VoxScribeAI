import io
import ipaddress
import socket
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup
from app.services.pdf_service import extract_text_from_pdf

SUPPORTED_EXTENSIONS = {"pdf", "docx", "txt", "md"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
MAX_URL_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 3

class ExtractionError(ValueError):
    """Raised when text cannot be extracted from the provided input."""

def get_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

def extract_text_from_docx(data: bytes) -> str:
    from docx import Document

    document = Document(io.BytesIO(data))
    return "\n\n".join(p.text for p in document.paragraphs if p.text.strip())

def extract_text_from_file(filename: str, data: bytes) -> tuple[str, str]:
    """
    Extracts plain text from an uploaded writing sample.
    Returns (text, source_type).
    """
    extension = get_extension(filename)
    if extension not in SUPPORTED_EXTENSIONS:
        raise ExtractionError("Unsupported file type. Upload a PDF, DOCX, TXT or MD file.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ExtractionError("File is too large. The maximum size is 10MB.")

    if extension == "pdf":
        text = extract_text_from_pdf(data)
    elif extension == "docx":
        text = extract_text_from_docx(data)
    else:
        text = data.decode("utf-8", errors="ignore")

    if not text.strip():
        raise ExtractionError("Could not extract any text from the provided file.")
    return text, extension

def ensure_public_host(url: str) -> None:
    """Rejects URLs that resolve to private, loopback or otherwise internal addresses (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ExtractionError("Only public http(s) URLs are supported.")

    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise ExtractionError("Could not resolve the URL's host.")

    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:
            raise ExtractionError("URLs pointing to private or internal addresses are not allowed.")

def html_to_text(html: str) -> tuple[str, str]:
    """Extracts (title, main text) from an HTML page, preferring the <article>/<main> element."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg"]):
        tag.decompose()

    title = soup.title.get_text(strip=True) if soup.title else ""
    root = soup.find("article") or soup.find("main") or soup.body or soup
    blocks = [
        el.get_text(" ", strip=True)
        for el in root.find_all(["h1", "h2", "h3", "h4", "p", "li", "blockquote"])
    ]
    text = "\n\n".join(b for b in blocks if b)
    return title, text

def fetch_url_text(url: str) -> tuple[str, str]:
    """
    Downloads a public web page and extracts its readable text.
    Returns (title, text).
    """
    current = url
    with httpx.Client(timeout=15.0, follow_redirects=False, headers={"User-Agent": "VoxScribeBot/1.0"}) as client:
        for _ in range(MAX_REDIRECTS + 1):
            ensure_public_host(current)
            response = client.get(current)
            if response.is_redirect and "location" in response.headers:
                current = urljoin(current, response.headers["location"])
                continue
            break
        else:
            raise ExtractionError("Too many redirects.")

    if response.status_code >= 400:
        raise ExtractionError(f"Could not fetch the URL (HTTP {response.status_code}).")
    if "html" not in response.headers.get("content-type", "") and "text" not in response.headers.get("content-type", ""):
        raise ExtractionError("The URL does not point to a web page.")
    if len(response.content) > MAX_URL_BYTES:
        raise ExtractionError("The web page is too large to import.")

    title, text = html_to_text(response.text)
    if not text.strip():
        raise ExtractionError("Could not find any readable text on that page.")
    return title or url, text
