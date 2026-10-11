import os
import sys
from pathlib import Path

# Isolate tests from the real .env before any app module is imported
# (load_dotenv never overrides variables that are already set).
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_KEY"] = ""
os.environ["GROQ_API_KEY"] = "test-key"
os.environ["HUGGINGFACE_API_KEY"] = "test-key"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthUser, get_current_user
from app.core.rate_limit import limiter
from app.main import app
from app.services import supabase_service, vault_service
from tests.fakes import FakeEmbeddings, FakeLLM, FakeSupabase

USER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_USER_ID = "22222222-2222-2222-2222-222222222222"

@pytest.fixture
def fake_db(monkeypatch) -> FakeSupabase:
    db = FakeSupabase()
    monkeypatch.setattr(supabase_service, "supabase", db)
    monkeypatch.setattr(supabase_service, "embeddings", FakeEmbeddings())
    return db

@pytest.fixture
def fake_llm(monkeypatch) -> FakeLLM:
    llm = FakeLLM("- Short punchy sentences\n- Uses 'you' a lot")
    monkeypatch.setattr(vault_service, "get_llm", lambda **_: llm)
    return llm

@pytest.fixture
def client(fake_db, fake_llm):
    limiter.reset()
    app.dependency_overrides[get_current_user] = lambda: AuthUser(id=USER_ID, email="me@example.com")
    yield TestClient(app)
    app.dependency_overrides.clear()
