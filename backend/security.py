import uuid
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from config import JWT_ALGORITHM, JWT_EXPIRES_MINUTES, JWT_SECRET
from database import get_session
from models import User

# auto_error=False returns None instead of raising, so a missing header ends up in the same 401 as a bad token and does not hint at which part failed
bearer_scheme = HTTPBearer(auto_error=False)

# bcrypt is one-way and salts every hash: the same password never produces the same string twice, and the plain value can never be recovered from storage
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

# sub carries client_id only, never the serial id nor the email
def create_token(client_id: uuid.UUID) -> str:
    payload = {"sub": str(client_id), "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRES_MINUTES),}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Any route declaring this dependency becomes authenticated automatically.
async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme), session: AsyncSession = Depends(get_session),) -> User:
    # One single error whatever failed (no header, bad signature, expired token, deleted user): distinguishing them would help map valid tokens
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    if credentials is None:
        raise invalid
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        client_id = uuid.UUID(payload["sub"])
    # PyJWTError covers bad signature and expiry, KeyError a token with no sub, ValueError a sub that is not a valid UUID
    except (jwt.PyJWTError, KeyError, ValueError):
        raise invalid
    user = await session.scalar(select(User).where(User.client_id == client_id))
    if user is None:
        raise invalid
    return user

OAUTH_STATE_AUDIENCE = "oauth-state"

# the oauth callback is a redirect from google -> no bearer header
# so the user id travels in this signed state instead
def create_oauth_state(client_id, provider, widget_id):
    payload = {
        "sub": str(client_id),
        "provider": provider,
        "wid": widget_id,
        # the state ends up in urls/history. aud = it can never be used as a session token (and vice versa)
        "aud": OAUTH_STATE_AUDIENCE,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def read_oauth_state(state, provider):
    try:
        payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM], audience=OAUTH_STATE_AUDIENCE)
        if payload.get("provider") != provider:
            return None
        # (who, which widget). an old state without wid -> KeyError -> None
        return uuid.UUID(payload["sub"]), int(payload["wid"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
