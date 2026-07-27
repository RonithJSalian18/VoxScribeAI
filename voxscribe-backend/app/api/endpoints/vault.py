import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.services.pdf_service import extract_text_from_pdf, chunk_text
from app.services.supabase_service import save_document_chunks

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/upload")
async def upload_to_vault(file: UploadFile = File(...), user_id: str = Form(...)):
    """
    Parses PDF writing sample, converts chunks into vector embeddings,
    and stores them in Supabase under the user's ID for RAG matching.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported."
        )

    try:
        pdf_bytes = await file.read()
        raw_text = extract_text_from_pdf(pdf_bytes)
        
        if not raw_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract text from the provided PDF."
            )

        chunks = chunk_text(raw_text)
        saved_count = save_document_chunks(user_id=user_id, chunks=chunks)

        return {
            "status": "Success",
            "message": f"Processed and saved {saved_count} writing style chunks to your Vault."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vault upload error: {e}")
        return {
            "status": "Error",
            "message": f"Failed to process PDF: {str(e)}"
        }
