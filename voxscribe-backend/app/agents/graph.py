from langgraph.graph import StateGraph, END
from app.agents.state import GraphState
from app.agents.nodes.researcher import researcher_node
from app.agents.nodes.writer import writer_node
from app.agents.nodes.editor import editor_node

def build_graph():
    """Assembles and compiles the multi-agent LangGraph workflow."""
    workflow = StateGraph(GraphState)

    workflow.add_node("researcher", researcher_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("editor", editor_node)

    workflow.set_entry_point("researcher")
    workflow.add_edge("researcher", "writer")
    workflow.add_edge("writer", "editor")
    workflow.add_edge("editor", END)

    return workflow.compile()

# Global compiled graph app instance
agent_graph = build_graph()
