from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from agent import app as langgraph_app, embeddings, supabase # Import our RAG tools
import fitz # PyMuPDF for reading PDFs
import os # Import os to read environment variables

app = FastAPI(title="VoxScribe API")

# We need to allow Next.js (running on localhost:3000 or Vercel) to talk to this server.
# Using allow_origin_regex=".*" acts as a safe wildcard that accepts any frontend URL
# without crashing FastAPI's strict credentials rules!
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*", 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# This defines the exact format of the data Next.js will send us
class GenerateRequest(BaseModel):
    youtube_url: str
    user_id: str = None # Expect the user ID from the frontend

@app.get("/")
def read_root():
    return {"status": "VoxScribe Backend is running!"}

@app.post("/vault/upload")
async def upload_to_vault(file: UploadFile = File(...), user_id: str = Form(...)):
    """Handles PDF uploads, turns them into math, and saves to Supabase."""
    print(f"Received file {file.filename} for user {user_id}")
    try:
        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        
        chunks = [chunk.strip() for chunk in text.split('\n\n') if len(chunk.strip()) > 50]
        
        for chunk in chunks:
            vector = embeddings.embed_query(chunk)
            supabase.table("documents").insert({
                "user_id": user_id,
                "content": chunk,
                "embedding": vector
            }).execute()
            
        return {"status": "Success", "message": f"Processed {len(chunks)} chunks."}
    except Exception as e:
        print(f"Upload error: {e}")
        return {"status": "Error", "message": str(e)}

@app.post("/generate")
async def generate_blog(request: GenerateRequest):
    """
    This is the bridge! Next.js hits this endpoint with a URL,
    and FastAPI hands it over to our LangGraph workers.
    """
    print(f"Received request from frontend for URL: {request.youtube_url}")
    
    try:
        # 1. Prepare the starting state
        initial_state = {
            "youtube_url": request.youtube_url,
            "user_id": request.user_id # Pass user_id to the agent state
        }
        
        # 2. Run the LangGraph pipeline
        result = langgraph_app.invoke(initial_state)
        
        # 3. Return the final blog post back to the frontend
        return {"status": "success", "blog_post": result["final_post"]}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}