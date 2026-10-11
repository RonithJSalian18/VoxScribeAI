"""
VoxScribe API - FastAPI Application Entrypoint
Run locally via: `python main.py` or `uvicorn app.main:app --reload`
"""
import uvicorn
from app.main import app

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)