from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models import Subscription, User
from schemas import DeleteAccountRequest, UserResponse
from security import current_user
from subscriptions import revoke_credentials

DELETE_CONFIRMATION = "DELETEMYACCOUNT-FORCE"

router = APIRouter(prefix="/api", tags=["users"])

@router.get("/me", response_model=UserResponse)
async def read_me(user: User = Depends(current_user)) -> User:
    return user

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(payload: DeleteAccountRequest, user: User = Depends(current_user), session: AsyncSession = Depends(get_session),) -> Response:
    # Re-checked here, not only in the React modal: a destructive action must never rely on the client for its confirmation.
    if payload.confirmation != DELETE_CONFIRMATION:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Type {DELETE_CONFIRMATION} to confirm")
    # give the access back to google for every connected address, the rows themselves go with the cascade
    # a query and not user.subscriptions: that lazy load raises MissingGreenlet under async
    subscriptions = await session.scalars(select(Subscription).where(Subscription.user_id == user.id))
    for subscription in subscriptions:
        await revoke_credentials(subscription)
    await session.delete(user)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
