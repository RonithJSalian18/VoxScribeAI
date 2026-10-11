import json
import logging
import queue
import threading
import time
import uuid
from typing import Iterator
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from app.agents.graph import OUTLINE_REVIEW_INTERRUPT, agent_graph, checkpointer
from app.core.auth import AuthUser, get_current_user
from app.core.rate_limit import enforce_generation_quota, rate_limit
from app.schemas.generate import (
    GenerateRequest,
    GenerateResponse,
    ResumeRequest,
    TranscriptionResponse,
)
from app.services import vault_service
from app.services.supabase_service import save_blog_post
from app.services.transcription_service import TranscriptionError, transcribe_audio

logger = logging.getLogger(__name__)
router = APIRouter()

PAUSED_RUN_TTL_SECONDS = 60 * 60
HEARTBEAT_SECONDS = 15
_STREAM_DONE = object()

# thread_id -> (user_id, paused_at). Paused runs awaiting outline review.
_paused_runs: dict[str, tuple[str, float]] = {}
_paused_lock = threading.Lock()

def _delete_thread(thread_id: str) -> None:
    try:
        checkpointer.delete_thread(thread_id)
    except Exception as e:
        logger.debug(f"Could not delete checkpoint thread {thread_id}: {e}")

def _purge_stale_runs() -> None:
    """Drops paused runs (and their checkpoints) that were never resumed."""
    cutoff = time.time() - PAUSED_RUN_TTL_SECONDS
    with _paused_lock:
        stale = [tid for tid, (_, paused_at) in _paused_runs.items() if paused_at < cutoff]
        for tid in stale:
            _paused_runs.pop(tid, None)
    for tid in stale:
        _delete_thread(tid)

def _initial_state(request: GenerateRequest, user: AuthUser) -> dict:
    """Builds the graph's starting state, resolving the Brand Voice to write in."""
    try:
        voice = vault_service.resolve_voice(user.id, request.voice_id)
    except vault_service.VaultNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    state = {
        "source_type": request.source_type,
        "source_url": request.display_source,
        "options": request.options.model_dump(),
        "user_id": user.id,
        "voice_id": voice["id"],
        "style_profile": voice.get("style_profile"),
    }
    if request.source_type == "text":
        state["transcript"] = request.transcript
        state["timestamped_transcript"] = request.timestamped_transcript or ""
        state["source_title"] = request.source_label or ""
    return state

def _config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}

def _save_final(values: dict, final_post: str) -> str | None:
    options = values.get("options") or {}
    return save_blog_post(
        values["user_id"],
        values.get("source_url", ""),
        final_post,
        voice_id=values.get("voice_id"),
        source_type=values.get("source_type", "youtube"),
        output_format=options.get("output_format", "blog"),
    )

@router.post("", response_model=GenerateResponse)
def generate_blog(
    request: GenerateRequest,
    user: AuthUser = Depends(enforce_generation_quota),
):
    """
    Executes the multi-agent LangGraph workflow to generate personalized content
    from a source using the user's Brand Voice Vault. (Outline review is only
    supported on the streaming endpoint.)
    """
    logger.info(f"Received generation request: {request.source_type} {request.display_source}")
    state = _initial_state(request, user)
    thread_id = str(uuid.uuid4())

    try:
        result = agent_graph.invoke(state, _config(thread_id))

        if result.get("error"):
            return GenerateResponse(
                status="error",
                message=result["error"]
            )

        final_post = result.get("final_post", "")
        return GenerateResponse(
            status="success",
            blog_post=final_post,
            post_id=_save_final(result, final_post)
        )

    except Exception as e:
        logger.error(f"Generation endpoint exception: {e}")
        return GenerateResponse(
            status="error",
            message=str(e)
        )
    finally:
        _delete_thread(thread_id)

def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"

def _progress_event(node: str, output: dict) -> dict:
    event = {"type": "progress", "node": node}
    if node == "writer":
        voice = output.get("brand_voice", "")
        event["voice_samples"] = len(voice.split("\n\n---\n\n")) if voice else 0
        event["revision"] = output.get("revision_count", 0) > 0
    elif node == "reviewer":
        event["score"] = output.get("review_score")
        event["revision_requested"] = bool(output.get("review_feedback"))
    return event

def _run_graph(graph_input: dict | None, thread_id: str, user_id: str, review_outline: bool) -> Iterator[str]:
    """
    Streams the graph from `graph_input` (or resumes it when None), yielding a
    server-sent event after each agent. Pauses before the writer when review_outline is set.
    """
    config = _config(thread_id)
    interrupt = [OUTLINE_REVIEW_INTERRUPT] if review_outline else None
    paused = False

    try:
        for update in agent_graph.stream(graph_input, config, stream_mode="updates", interrupt_before=interrupt):
            for node, output in update.items():
                if node.startswith("__"):
                    continue
                output = output or {}
                if output.get("error"):
                    yield _sse({"type": "error", "message": output["error"]})
                    return
                yield _sse(_progress_event(node, output))

        snapshot = agent_graph.get_state(config)
        values = snapshot.values

        if snapshot.next:
            paused = True
            with _paused_lock:
                _paused_runs[thread_id] = (user_id, time.time())
            yield _sse({"type": "outline", "thread_id": thread_id, "outline": values.get("outline", "")})
            return

        if values.get("error"):
            yield _sse({"type": "error", "message": values["error"]})
            return

        final_post = values.get("final_post", "")
        yield _sse({"type": "result", "blog_post": final_post, "post_id": _save_final(values, final_post)})

    except Exception as e:
        logger.error(f"Streaming generation exception: {e}")
        yield _sse({"type": "error", "message": str(e)})
    finally:
        if not paused:
            _delete_thread(thread_id)

def _with_heartbeat(events: Iterator[str]) -> Iterator[str]:
    """
    Runs the event generator in a worker thread and emits an SSE comment every
    HEARTBEAT_SECONDS while waiting, so proxies don't close idle connections during
    long LLM calls. The run continues (and saves the post) even if the client disconnects.
    """
    events_queue: queue.Queue = queue.Queue()

    def produce() -> None:
        try:
            for event in events:
                events_queue.put(event)
        except Exception as e:
            logger.error(f"Stream producer failed: {e}")
            events_queue.put(_sse({"type": "error", "message": str(e)}))
        finally:
            events_queue.put(_STREAM_DONE)

    threading.Thread(target=produce, daemon=True).start()
    while True:
        try:
            item = events_queue.get(timeout=HEARTBEAT_SECONDS)
        except queue.Empty:
            yield ": keep-alive\n\n"
            continue
        if item is _STREAM_DONE:
            return
        yield item

def _stream_response(events: Iterator[str]) -> StreamingResponse:
    return StreamingResponse(
        _with_heartbeat(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.post("/stream")
def generate_blog_stream(
    request: GenerateRequest,
    user: AuthUser = Depends(enforce_generation_quota),
):
    """
    Same workflow as POST /generate, streamed as Server-Sent Events so the client can
    show real progress for each agent. With review_outline=true the stream ends with an
    `outline` event; send the (edited) outline to POST /generate/resume to continue.
    """
    logger.info(f"Received streaming generation request: {request.source_type} {request.display_source}")
    _purge_stale_runs()
    state = _initial_state(request, user)
    thread_id = str(uuid.uuid4())

    def events() -> Iterator[str]:
        yield _sse({"type": "started", "thread_id": thread_id})
        yield from _run_graph(state, thread_id, user.id, request.review_outline)

    return _stream_response(events())

@router.post("/resume")
def resume_generation(
    request: ResumeRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Continues a run paused for outline review, using the user's edited outline."""
    with _paused_lock:
        owner = _paused_runs.get(request.thread_id)
        if not owner or owner[0] != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="This draft session has expired. Please start the generation again.",
            )
        _paused_runs.pop(request.thread_id)

    agent_graph.update_state(_config(request.thread_id), {"outline": request.outline})

    def events() -> Iterator[str]:
        yield _sse({"type": "started", "thread_id": request.thread_id})
        yield from _run_graph(None, request.thread_id, user.id, review_outline=False)

    return _stream_response(events())

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_source_audio(
    file: UploadFile = File(...),
    user: AuthUser = Depends(rate_limit("transcribe", 5)),
):
    """Transcribes an uploaded podcast/audio/video file with Whisper for use as a generation source."""
    data = await file.read()
    try:
        transcript, timestamped = await run_in_threadpool(transcribe_audio, file.filename or "audio", data)
    except TranscriptionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Transcription service failed.")

    return TranscriptionResponse(
        transcript=transcript,
        timestamped_transcript=timestamped,
        filename=file.filename or "audio",
    )
