"""Compatibility entrypoint for importing agent graph, embeddings, and supabase."""
from app.agents.graph import agent_graph as app
from app.core.embeddings import embeddings
from app.services.supabase_service import supabase

__all__ = ["app", "embeddings", "supabase"]