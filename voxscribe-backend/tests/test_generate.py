import json
from types import SimpleNamespace
import pytest
from app.agents.nodes import editor, researcher, reviewer, writer
from app.agents.nodes.reviewer import parse_review
from app.agents.prompts import editor_instructions, normalize_options, writer_instructions
from app.api.endpoints import generate
from app.core.auth import AuthUser, get_current_user
from app.main import app
from app.services.source_service import SourceContent, SourceError
from tests.conftest import OTHER_USER_ID

class ScriptedLLM:
    """Answers each agent based on its prompt; records prompts."""

    def __init__(self, review_scores=(9,)):
        self.review_scores = list(review_scores)
        self.prompts: list[str] = []

    def invoke(self, messages):
        prompt = messages[-1].content
        self.prompts.append(prompt)
        if prompt.startswith("Create a detailed"):
            return SimpleNamespace(content="1. Intro\n2. Main idea")
        if prompt.startswith("You are a demanding content reviewer"):
            score = self.review_scores.pop(0) if self.review_scores else 9
            feedback = "Add a concrete example." if score < 7 else ""
            return SimpleNamespace(content=json.dumps({"score": score, "feedback": feedback}))
        if prompt.startswith("Revise this"):
            return SimpleNamespace(content="Revised draft with example")
        if prompt.startswith("Write a"):
            return SimpleNamespace(content="First draft")
        if prompt.startswith("You are a senior editor"):
            return SimpleNamespace(content="# Final Title\n\nPolished body")
        return SimpleNamespace(content="?")

@pytest.fixture(autouse=True)
def clear_paused_runs():
    generate._paused_runs.clear()
    yield
    generate._paused_runs.clear()

@pytest.fixture
def llm(monkeypatch):
    scripted = ScriptedLLM()
    for module in (researcher, writer, reviewer, editor):
        monkeypatch.setattr(module, "get_llm", lambda **_: scripted)
    return scripted

@pytest.fixture
def source(monkeypatch):
    content = SourceContent("transcript " * 50, "[00:00] hello\n[00:30] world", "Video")
    monkeypatch.setattr(researcher, "load_source", lambda *_: content)
    return content

def _events(response) -> list[dict]:
    return [json.loads(line[5:]) for line in response.text.splitlines() if line.startswith("data:")]

def _generate(client, **overrides):
    body = {"source_url": "https://youtu.be/abcdefghijk", **overrides}
    return _events(client.post("/generate/stream", json=body))

def test_full_stream_and_saved_post(client, fake_db, llm, source):
    events = _generate(client, options={"output_format": "linkedin", "tone": "witty"})
    assert [e["type"] for e in events] == ["started", "progress", "progress", "progress", "progress", "result"]
    assert [e.get("node") for e in events[1:5]] == ["researcher", "writer", "reviewer", "editor"]
    assert events[3]["score"] == 9 and events[3]["revision_requested"] is False
    assert events[-1]["blog_post"].startswith("# Final Title")

    post = fake_db.tables["blog_posts"][0]
    assert post["id"] == events[-1]["post_id"]
    assert post["output_format"] == "linkedin"
    assert post["source_type"] == "youtube"
    assert post["voice_id"] == fake_db.tables["voices"][0]["id"]

    writer_prompt = next(p for p in llm.prompts if p.startswith("Write a"))
    assert "LinkedIn post" in writer_prompt and "Tone: witty" in writer_prompt

def test_low_review_score_triggers_one_revision(client, fake_db, llm, source):
    llm.review_scores = [4]
    events = _generate(client)
    nodes = [e.get("node") for e in events if e["type"] == "progress"]
    assert nodes == ["researcher", "writer", "reviewer", "writer", "editor"]
    assert events[3]["revision_requested"] is True
    assert events[4]["revision"] is True
    assert any("Add a concrete example." in p for p in llm.prompts if p.startswith("Revise this"))

def test_outline_review_pause_and_resume(client, fake_db, llm, source):
    events = _generate(client, review_outline=True)
    assert [e["type"] for e in events] == ["started", "progress", "outline"]
    thread_id = events[-1]["thread_id"]
    assert events[-1]["outline"] == "1. Intro\n2. Main idea"
    assert fake_db.tables.get("blog_posts", []) == []

    resumed = _events(client.post("/generate/resume", json={"thread_id": thread_id, "outline": "MY EDITED OUTLINE"}))
    assert [e.get("node") for e in resumed if e["type"] == "progress"] == ["writer", "reviewer", "editor"]
    assert resumed[-1]["type"] == "result"
    assert "MY EDITED OUTLINE" in next(p for p in llm.prompts if p.startswith("Write a"))

    # A finished run cannot be resumed again
    again = client.post("/generate/resume", json={"thread_id": thread_id, "outline": "x"})
    assert again.status_code == 404

def test_resume_rejects_other_users(client, fake_db, llm, source):
    thread_id = _generate(client, review_outline=True)[-1]["thread_id"]
    app.dependency_overrides[get_current_user] = lambda: AuthUser(id=OTHER_USER_ID)
    assert client.post("/generate/resume", json={"thread_id": thread_id, "outline": "x"}).status_code == 404

def test_text_source_skips_fetching(client, fake_db, llm, monkeypatch):
    def fail(*_):
        raise AssertionError("load_source should not be called for text sources")
    monkeypatch.setattr(researcher, "load_source", fail)

    events = _generate(
        client,
        source_type="text",
        source_url=None,
        transcript="spoken words " * 20,
        source_label="episode.mp3",
        options={"output_format": "show_notes"},
    )
    assert events[-1]["type"] == "result"
    assert fake_db.tables["blog_posts"][0]["youtube_url"] == "text:episode.mp3"

def test_text_source_requires_transcript(client):
    response = client.post("/generate/stream", json={"source_type": "text", "transcript": "short"})
    assert response.status_code == 422

def test_source_error_is_streamed(client, fake_db, llm, monkeypatch):
    def fail(*_):
        raise SourceError("No captions")
    monkeypatch.setattr(researcher, "load_source", fail)
    events = _generate(client)
    assert events[-1] == {"type": "error", "message": "No captions"}
    assert events[0]["thread_id"] not in generate._paused_runs

def test_legacy_youtube_url_field(client, fake_db, llm, source):
    events = _events(client.post("/generate/stream", json={"youtube_url": "https://youtu.be/abcdefghijk"}))
    assert events[-1]["type"] == "result"

def test_parse_review():
    assert parse_review('{"score": 5, "feedback": "More detail"}') == (5, "More detail")
    assert parse_review('Sure! ```json\n{"score": 12}\n```') == (10, "")
    assert parse_review("not json") == (10, "")

def test_prompt_options():
    thread = normalize_options({"output_format": "twitter_thread", "length": "short", "language": "Spanish"})
    text = writer_instructions(thread)
    assert "280 characters" in text and "5 tweets" in text and "Spanish" in text

    blog = normalize_options({"keyword": "remote work"})
    assert 'keyword "remote work"' in writer_instructions(blog)
    assert "H1 title" in editor_instructions(blog)
    assert normalize_options({"output_format": "bogus"})["output_format"] == "blog"
