"""Compatibility entrypoint for running FastAPI via 'uvicorn main:app'."""
from app.main import app
from app.services.supabase_service import supabase
from app.core.embeddings import embeddings
from app.agents.graph import agent_graph as langgraph_app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)