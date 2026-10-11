import logging
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.services.supabase_service import supabase

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)

@dataclass
class AuthUser:
    id: str
    email: str | None = None

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthUser:
    """
    Validates the Supabase access token sent as `Authorization: Bearer <token>`
    and returns the authenticated user. The user ID is never trusted from the client body.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured on the server.",
        )

    try:
        response = supabase.auth.get_user(credentials.credentials)
        user = response.user if response else None
    except Exception as e:
        logger.warning(f"Token validation failed: {e}")
        user = None

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthUser(id=user.id, email=user.email)
