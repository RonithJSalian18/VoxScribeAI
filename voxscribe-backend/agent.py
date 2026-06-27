import os
import re
from typing import TypedDict
from dotenv import load_dotenv
from supabase import create_client, Client
from langchain_huggingface import HuggingFaceEndpointEmbeddings

# Tooling and AI
from youtube_transcript_api import YouTubeTranscriptApi
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

# LangGraph
from langgraph.graph import StateGraph, END

# Load our API keys from the .env file
load_dotenv()

# Initialize Supabase connection
supabase_url: str = os.environ.get("SUPABASE_URL", "")
supabase_key: str = os.environ.get("SUPABASE_SERVICE_KEY", "")
supabase: Client = create_client(supabase_url, supabase_key)

# Grab the API key from Render's environment variables / local .env
hf_api_key = os.environ.get("HUGGINGFACE_API_KEY", "")

# Initialize Embeddings using Hugging Face API (Saves RAM for Render!)
embeddings = HuggingFaceEndpointEmbeddings(
    model="sentence-transformers/all-MiniLM-L6-v2",
    task="feature-extraction",
    huggingfacehub_api_token=hf_api_key
)

# 1. Define the State
class GraphState(TypedDict):
    youtube_url: str
    user_id: str          # NEW: Track which user is requesting this
    transcript: str
    outline: str
    brand_voice: str      # NEW: Holds the retrieved style samples
    draft: str
    final_post: str

# Initialize our AI Brain (Using Groq's Llama 3.1)
llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.7)


# 2. Define our Agent Nodes (The Workers)
def researcher_node(state: GraphState):
    """Agent 1: Extracts the transcript and creates an outline."""
    print("--- [Agent 1] RESEARCHER WORKING ---")
    url = state["youtube_url"]
    
    # Extract the YouTube Video ID from the URL
    video_id_match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    if not video_id_match:
        return {"transcript": "Error: Invalid URL", "outline": ""}
    
    video_id = video_id_match.group(1)
    
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        transcript = " ".join([t['text'] for t in transcript_list])
    except Exception as e:
        return {"transcript": f"Error: {str(e)}", "outline": ""}
    
    prompt = f"Create a detailed blog post outline based on this YouTube transcript:\n\n{transcript[:5000]}"
    outline_response = llm.invoke([HumanMessage(content=prompt)])
    
    return {"transcript": transcript, "outline": outline_response.content}

def writer_node(state: GraphState):
    """Agent 2: Takes the outline, checks the RAG Vault, and writes the draft."""
    print("--- [Agent 2] WRITER WORKING ---")
    user_id = state.get("user_id")
    
    brand_voice_context = ""
    
    # --- RAG VAULT SEARCH LOGIC ---
    if user_id:
        print("-> Searching Vault for Brand Voice...")
        try:
            # 1. Turn the outline into math so we can search conceptually
            query_vector = embeddings.embed_query(state['outline'][:1000])
            
            # 2. Run the Supabase SQL search function
            response = supabase.rpc(
                "match_documents",
                {
                    "query_embedding": query_vector,
                    "match_user_id": user_id,
                    "match_threshold": 0.0, # FIXED: Lowered to 0.0 to ensure we ALWAYS grab the user's uploaded style
                    "match_count": 3        # Grab top 3 paragraphs
                }
            ).execute()
            
            if response.data:
                retrieved_chunks = [doc['content'] for doc in response.data]
                brand_voice_context = "\n\n---\n\n".join(retrieved_chunks)
                print(f"-> Found {len(retrieved_chunks)} Brand Voice samples in Vault!")
            else:
                print("-> No Brand Voice found in Vault. Using default AI voice.")
        except Exception as e:
            print(f"-> Vault search error (safe to ignore if vault is empty): {e}")

    # --- WRITER PROMPT LOGIC ---
    prompt = f"""Write a full, engaging blog post based on this outline. 
    Use markdown formatting (headers, bullet points).
    
    Outline:
    {state['outline']}"""
    
    # If we found past writing, aggressively instruct the AI to mimic it
    if brand_voice_context:
         prompt += f"""\n\nCRITICAL INSTRUCTION: 
         You must mimic the exact tone, vocabulary, sentence structure, and style of the user's past writing. 
         Here are samples of the user's past writing to mimic:
         
         {brand_voice_context}"""
    
    draft_response = llm.invoke([HumanMessage(content=prompt)])
    
    return {"draft": draft_response.content, "brand_voice": brand_voice_context}

def editor_node(state: GraphState):
    """Agent 3: Reviews the draft, adds a catchy title, and formats it."""
    print("--- [Agent 3] EDITOR WORKING ---")
    
    prompt = f"""You are a senior SEO editor. Review this blog draft.
    1. Add a highly engaging, click-worthy H1 title at the top.
    2. Ensure the markdown formatting is clean.
    3. Output ONLY the final blog post, nothing else.
    
    Draft:
    {state['draft']}"""
    
    final_response = llm.invoke([HumanMessage(content=prompt)])
    
    return {"final_post": final_response.content}

# 3. Build the LangGraph Pipeline
workflow = StateGraph(GraphState)
workflow.add_node("researcher", researcher_node)
workflow.add_node("writer", writer_node)
workflow.add_node("editor", editor_node)

workflow.set_entry_point("researcher")
workflow.add_edge("researcher", "writer")
workflow.add_edge("writer", "editor")
workflow.add_edge("editor", END)

app = workflow.compile()