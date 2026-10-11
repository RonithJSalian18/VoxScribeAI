"""Quotas, rate limits, model selection, transcript caching, heartbeats and source parsing."""
import json
import time
from types import SimpleNamespace
from app.agents.nodes import researcher
from app.api.endpoints import generate
from app.config import settings
from app.core import llm as llm_module
from app.core.rate_limit import SlidingWindowLimiter
from app.services import source_service
from app.services.youtube_service import Segment, build_timestamped_transcript, extract_youtube_id
from tests.conftest import USER_ID
from tests.test_generate import ScriptedLLM, _events

def test_sliding_window_limiter():
    limiter = SlidingWindowLimiter()
    assert limiter.hit("k", 2, 60) is None
    assert limiter.hit("k", 2, 60) is None
    assert limiter.hit("k", 2, 60) > 0
    assert limiter.hit("other", 2, 60) is None

def test_rate_limit_returns_429(client, monkeypatch):
    from app.services import post_service
    monkeypatch.setattr(post_service, "get_llm", lambda **_: SimpleNamespace(invoke=lambda m: SimpleNamespace(content="x")))
    for _ in range(30):
        assert client.post("/posts/rewrite", json={"text": "a"}).status_code == 200
    response = client.post("/posts/rewrite", json={"text": "a"})
    assert response.status_code == 429 and "Retry-After" in response.headers

def test_daily_generation_quota(client, fake_db, monkeypatch):
    monkeypatch.setattr(settings, "DAILY_GENERATION_LIMIT", 2)
    for i in range(2):
        fake_db.table("blog_posts").insert({"user_id": USER_ID, "youtube_url": "x", "content": f"post {i}"}).execute()
    response = client.post("/generate/stream", json={"source_url": "https://youtu.be/abcdefghijk"})
    assert response.status_code == 429
    assert "limit of 2" in response.json()["detail"]

def test_usage_and_models(client, fake_db):
    fake_db.table("blog_posts").insert({"user_id": USER_ID, "youtube_url": "x", "content": "c", "output_format": "linkedin"}).execute()
    usage = client.get("/usage").json()
    assert usage["generations_last_24h"] == 1
    assert usage["posts_by_format"] == {"linkedin": 1}
    assert usage["daily_limit"] == settings.DAILY_GENERATION_LIMIT

    models = client.get("/models").json()
    assert [m["id"] for m in models] == settings.AVAILABLE_MODELS
    assert models[0]["default"] is True

def test_resolve_model_rejects_unknown():
    assert llm_module.resolve_model(settings.AVAILABLE_MODELS[-1]) == settings.AVAILABLE_MODELS[-1]
    assert llm_module.resolve_model("gpt-something") == settings.DEFAULT_MODEL
    assert llm_module.resolve_model(None) == settings.DEFAULT_MODEL

def test_youtube_transcript_cache(fake_db, monkeypatch):
    calls = []

    def fake_fetch(video_id):
        calls.append(video_id)
        return [Segment(0, "hello"), Segment(31, "world")]

    monkeypatch.setattr(source_service, "fetch_caption_segments", fake_fetch)
    first = source_service.load_youtube("https://youtu.be/abcdefghijk")
    second = source_service.load_youtube("https://www.youtube.com/watch?v=abcdefghijk")
    assert calls == ["abcdefghijk"]
    assert first == second
    assert fake_db.tables["transcripts"][0]["video_id"] == "abcdefghijk"

def test_whisper_fallback_when_no_captions(fake_db, monkeypatch):
    def no_captions(video_id):
        raise RuntimeError("Subtitles are disabled")

    monkeypatch.setattr(source_service, "fetch_caption_segments", no_captions)
    monkeypatch.setattr(source_service, "transcribe_youtube_audio", lambda vid: ("whisper text", "[00:00] whisper text"))
    content = source_service.load_youtube("https://youtu.be/abcdefghijk")
    assert content.transcript == "whisper text"

def test_heartbeat_keeps_stream_alive(client, fake_db, monkeypatch):
    scripted = ScriptedLLM()
    slow = SimpleNamespace(invoke=lambda m: (time.sleep(0.25), scripted.invoke(m))[1])
    for module in (researcher,):
        monkeypatch.setattr(module, "get_llm", lambda **_: slow)
    from app.agents.nodes import editor, reviewer, writer
    for module in (writer, reviewer, editor):
        monkeypatch.setattr(module, "get_llm", lambda **_: scripted)
    monkeypatch.setattr(researcher, "load_source", lambda *_: source_service.SourceContent("t " * 100))
    monkeypatch.setattr(generate, "HEARTBEAT_SECONDS", 0.05)

    response = client.post("/generate/stream", json={"source_url": "https://youtu.be/abcdefghijk"})
    assert ": keep-alive" in response.text
    assert _events(response)[-1]["type"] == "result"

def test_timestamps_and_ids():
    segments = [Segment(0, "a"), Segment(10, "b"), Segment(35, "c"), Segment(3700, "d")]
    assert build_timestamped_transcript(segments) == "[00:00] a b c\n[1:01:40] d"
    assert extract_youtube_id("https://www.youtube.com/live/abcdefghijk?si=x") == "abcdefghijk"
    assert extract_youtube_id("https://example.com") is None
