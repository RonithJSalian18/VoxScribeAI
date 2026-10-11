from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END
from app.agents.state import GraphState
from app.agents.nodes.researcher import researcher_node
from app.agents.nodes.writer import writer_node
from app.agents.nodes.reviewer import reviewer_node, route_after_review, route_after_writer
from app.agents.nodes.editor import editor_node

# Node at which a run pauses when the user wants to review the outline
OUTLINE_REVIEW_INTERRUPT = "writer"

def route_after_researcher(state: GraphState) -> str:
    return END if state.get("error") else "writer"

def build_graph(checkpointer=None):
    """
    Assembles and compiles the multi-agent LangGraph workflow:

        researcher → writer → reviewer ─┬→ editor → END
                       ↑                │
                       └── revision ────┘ (at most once)
    """
    workflow = StateGraph(GraphState)

    workflow.add_node("researcher", researcher_node)
    workflow.add_node("writer", writer_node)
    workflow.add_node("reviewer", reviewer_node)
    workflow.add_node("editor", editor_node)

    workflow.set_entry_point("researcher")
    workflow.add_conditional_edges("researcher", route_after_researcher, ["writer", END])
    workflow.add_conditional_edges("writer", route_after_writer, ["reviewer", "editor"])
    workflow.add_conditional_edges("reviewer", route_after_review, ["writer", "editor"])
    workflow.add_edge("editor", END)

    return workflow.compile(checkpointer=checkpointer)

# In-memory checkpoints let a run pause for outline review and resume later.
# They live only for the life of the process; use a persistent saver for multi-instance deployments.
checkpointer = MemorySaver()

# Global compiled graph app instance
agent_graph = build_graph(checkpointer)
