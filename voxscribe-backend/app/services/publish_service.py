"""
Publishes posts to external blogging platforms. Credentials are supplied per request
by the user and are never persisted. Posts are created as drafts unless asked otherwise.
"""
import base64
import logging
import time
import httpx
import jwt
from app.services import markdown_utils
from app.services.text_extraction import ExtractionError, ensure_public_host

logger = logging.getLogger(__name__)

PLATFORMS = ("devto", "wordpress", "ghost", "hashnode")
TIMEOUT = 20.0

class PublishError(RuntimeError):
    """Raised when a platform rejects the request or is misconfigured."""

def _site_base(site_url: str | None) -> str:
    if not site_url:
        raise PublishError("A site URL is required for this platform.")
    base = site_url.strip().rstrip("/")
    if not base.startswith(("http://", "https://")):
        base = f"https://{base}"
    try:
        ensure_public_host(base)
    except ExtractionError as e:
        raise PublishError(str(e))
    return base

def _raise_for_status(response: httpx.Response, platform: str) -> None:
    if response.status_code < 400:
        return
    detail = response.text[:300]
    try:
        body = response.json()
        detail = body.get("error") or body.get("message") or body.get("errors") or detail
    except ValueError:
        pass
    if response.status_code in (401, 403):
        raise PublishError(f"{platform} rejected the credentials ({response.status_code}).")
    raise PublishError(f"{platform} returned {response.status_code}: {detail}")

def publish_devto(title: str, body: str, tags: list[str], status: str, api_key: str, canonical_url: str | None) -> dict:
    article = {
        "title": title,
        "body_markdown": body,
        "published": status == "published",
        # Dev.to tags: max 4, alphanumeric only
        "tags": ["".join(ch for ch in t if ch.isalnum())[:30] for t in tags][:4],
    }
    if canonical_url:
        article["canonical_url"] = canonical_url
    response = httpx.post(
        "https://dev.to/api/articles",
        json={"article": article},
        headers={"api-key": api_key, "Accept": "application/vnd.forem.api-v1+json"},
        timeout=TIMEOUT,
    )
    _raise_for_status(response, "Dev.to")
    data = response.json()
    return {"id": str(data.get("id")), "url": data.get("url")}

def publish_wordpress(title: str, body: str, status: str, api_key: str, site_url: str | None, username: str | None) -> dict:
    if not username:
        raise PublishError("A WordPress username is required.")
    token = base64.b64encode(f"{username}:{api_key}".encode()).decode()
    response = httpx.post(
        f"{_site_base(site_url)}/wp-json/wp/v2/posts",
        json={"title": title, "content": markdown_utils.to_html(body), "status": "publish" if status == "published" else "draft"},
        headers={"Authorization": f"Basic {token}"},
        timeout=TIMEOUT,
    )
    _raise_for_status(response, "WordPress")
    data = response.json()
    return {"id": str(data.get("id")), "url": data.get("link")}

def _ghost_token(admin_key: str) -> str:
    """Creates a short-lived Ghost Admin API JWT from an `id:secret` admin key."""
    try:
        key_id, secret = admin_key.split(":", 1)
        secret_bytes = bytes.fromhex(secret)
    except ValueError:
        raise PublishError("Ghost Admin API key must look like '<id>:<hex secret>'.")
    now = int(time.time())
    return jwt.encode(
        {"iat": now, "exp": now + 300, "aud": "/admin/"},
        secret_bytes,
        algorithm="HS256",
        headers={"kid": key_id},
    )

def publish_ghost(title: str, body: str, tags: list[str], status: str, api_key: str, site_url: str | None) -> dict:
    post = {
        "title": title,
        "html": markdown_utils.to_html(body),
        "status": status,
        "tags": [{"name": t} for t in tags],
    }
    response = httpx.post(
        f"{_site_base(site_url)}/ghost/api/admin/posts/?source=html",
        json={"posts": [post]},
        headers={"Authorization": f"Ghost {_ghost_token(api_key)}", "Accept-Version": "v5.0"},
        timeout=TIMEOUT,
    )
    _raise_for_status(response, "Ghost")
    data = response.json()["posts"][0]
    return {"id": data.get("id"), "url": data.get("url")}

HASHNODE_DRAFT = """
mutation CreateDraft($input: CreateDraftInput!) {
  createDraft(input: $input) { draft { id slug } }
}"""

HASHNODE_PUBLISH = """
mutation PublishPost($input: PublishPostInput!) {
  publishPost(input: $input) { post { id url } }
}"""

def publish_hashnode(title: str, body: str, tags: list[str], status: str, api_key: str, publication_id: str | None) -> dict:
    if not publication_id:
        raise PublishError("A Hashnode publication ID is required.")
    hashnode_tags = [{"slug": markdown_utils.slugify(t), "name": t} for t in tags][:5]
    payload = {"title": title, "contentMarkdown": body, "publicationId": publication_id, "tags": hashnode_tags}
    query = HASHNODE_PUBLISH if status == "published" else HASHNODE_DRAFT

    response = httpx.post(
        "https://gql.hashnode.com",
        json={"query": query, "variables": {"input": payload}},
        headers={"Authorization": api_key},
        timeout=TIMEOUT,
    )
    _raise_for_status(response, "Hashnode")
    data = response.json()
    if data.get("errors"):
        raise PublishError(f"Hashnode error: {data['errors'][0].get('message', 'unknown error')}")

    if status == "published":
        post = data["data"]["publishPost"]["post"]
        return {"id": post["id"], "url": post["url"]}
    draft = data["data"]["createDraft"]["draft"]
    return {"id": draft["id"], "url": f"https://hashnode.com/draft/{draft['id']}"}

def publish(platform: str, request) -> dict:
    """Dispatches a PublishRequest to the given platform. Returns {id, url}."""
    title = request.title or markdown_utils.extract_title(request.content)
    body = markdown_utils.remove_title(request.content)

    if platform == "devto":
        return publish_devto(title, body, request.tags, request.status, request.api_key, request.canonical_url)
    if platform == "wordpress":
        return publish_wordpress(title, body, request.status, request.api_key, request.site_url, request.username)
    if platform == "ghost":
        return publish_ghost(title, body, request.tags, request.status, request.api_key, request.site_url)
    if platform == "hashnode":
        return publish_hashnode(title, body, request.tags, request.status, request.api_key, request.publication_id)
    raise PublishError(f"Unsupported platform: {platform}")
