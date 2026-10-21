import secrets
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models import User
from schemas import SignInRequest, SignUpRequest, TokenResponse, UserResponse, VerifyRequest
from security import create_token, hash_password, verify_password
from datetime import datetime, timedelta, timezone
from config import CONFIRMATION_EXPIRES_HOURS
from mailer import send_verification_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignUpRequest, background: BackgroundTasks, session: AsyncSession = Depends(get_session)) -> User:
    # Emails are stored lowercase so Ethan@x.com and ethan@x.com cannot coexist
    token = secrets.token_urlsafe(32)
    user = User(first_name=payload.first_name.strip(), last_name=payload.last_name.strip(), email=payload.email.lower(), 
                password_hash=hash_password(payload.password), confirmation_token=token, 
                confirmation_expires_at=datetime.now(timezone.utc) + timedelta(hours=CONFIRMATION_EXPIRES_HOURS),
                # SignUpRequest refused it unless the box was ticked: reaching here means accepted, now
                terms_accepted_at=datetime.now(timezone.utc))
    session.add(user)
    try:
        await session.commit()
    # The UNIQUE constraint decides, not a prior SELECT, which would leave a race window between the check and the INSERT
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This email is already registered")
    # Reload the columns the database generated (client_id, created_at)
    await session.refresh(user)
    background.add_task(send_verification_email, user.email, user.first_name, token)
    return user

@router.post("/signin", response_model=TokenResponse)
async def signin(payload: SignInRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    # Same message whether the email is unknown or the password is wrong, otherwise this endpoint becomes an account enumerator
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    # Checked only after the password matched, so this cannot be used to probe which emails are registered
    if not user.is_confirmed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Please confirm your email before signing in")
    return TokenResponse(token=create_token(user.client_id))

@router.post("/verify", response_model=UserResponse)
async def verify(payload: VerifyRequest, session: AsyncSession = Depends(get_session)) -> User:
    user = await session.scalar(select(User).where(User.confirmation_token == payload.token))
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or already used verification link")
    if user.confirmation_expires_at is not None and user.confirmation_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This verification link has expired")
    user.is_confirmed = True
    user.confirmation_token = None
    user.confirmation_expires_at = None
    await session.commit()
    await session.refresh(user)
    return user
