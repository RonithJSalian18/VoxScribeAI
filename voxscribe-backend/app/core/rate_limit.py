"""
Per-user request rate limiting and the daily generation quota.

The rate limiter is in-memory (per process). For multiple backend instances, back it with
Redis or enforce limits at the API gateway instead.
"""
import threading
import time
from collections import defaultdict, deque
from fastapi import Depends, HTTPException, status
from app.config import settings
from app.core.auth import AuthUser, get_current_user
from app.services import usage_service

class SlidingWindowLimiter:
    def __init__(self):
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, max_calls: int, period: float) -> float | None:
        """Records a call. Returns None if allowed, else seconds until the next call is allowed."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - period:
                hits.popleft()
            if len(hits) >= max_calls:
                return max(0.0, hits[0] + period - now)
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

limiter = SlidingWindowLimiter()

def rate_limit(bucket: str, max_calls: int, period: float = 60.0):
    """FastAPI dependency factory limiting each user to `max_calls` per `period` seconds."""

    def dependency(user: AuthUser = Depends(get_current_user)) -> AuthUser:
        retry_after = limiter.hit(f"{bucket}:{user.id}", max_calls, period)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please wait {int(retry_after) + 1} seconds and try again.",
                headers={"Retry-After": str(int(retry_after) + 1)},
            )
        return user

    return dependency

def enforce_generation_quota(user: AuthUser = Depends(rate_limit("generate", 5))) -> AuthUser:
    """Rejects new generations once the user hits DAILY_GENERATION_LIMIT in the last 24 hours."""
    limit = settings.DAILY_GENERATION_LIMIT
    if limit > 0 and usage_service.generations_last_24h(user.id, limit) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You've reached your limit of {limit} generations per 24 hours. Please try again later.",
        )
    return user
