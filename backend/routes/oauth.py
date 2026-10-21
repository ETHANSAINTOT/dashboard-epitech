from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
import google_oauth
from config import APP_BASE_URL
from database import get_session
from models import Subscription, User, WidgetInstance
from routes.widgets import owned_instance
from security import create_oauth_state, current_user, read_oauth_state
from subscriptions import release_if_unused

router = APIRouter(prefix="/api/oauth/google", tags=["oauth"])

SERVICE_NAME = "gmail"

@router.get("/url")
async def google_authorize_url(widget: int, user=Depends(current_user), session=Depends(get_session)):
    instance = await owned_instance(widget, user, session)
    if instance.service_name != "gmail":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This widget does not use Google")
    return {"url": google_oauth.authorize_url(create_oauth_state(user.client_id, "google", instance.id))}

# public on purpose, google redirects the browser here -> no bearer header
# so we only trust the signed state to know who's coming back
# =None needed: otherwise fastapi makes them mandatory and answers 422 before this even runs
@router.get("/callback")
async def google_callback(code=None, state=None, error=None, session=Depends(get_session)):
    # browser navigation -> always redirect back to the app, never raw json
    back = f"{APP_BASE_URL}/dashboard"
    if error or not code or not state:
        return RedirectResponse(f"{back}?gmail=denied")
    read = read_oauth_state(state, "google")
    if read is None:
        return RedirectResponse(f"{back}?gmail=error")
    client_id, widget_id = read
    user = await session.scalar(select(User).where(User.client_id == client_id))
    if user is None:
        return RedirectResponse(f"{back}?gmail=error")
    # deleted while the user was at google
    instance = await session.scalar(select(WidgetInstance).where(WidgetInstance.id == widget_id, WidgetInstance.user_id == user.id))
    if instance is None:
        return RedirectResponse(f"{back}?gmail=error")
    try:
        credentials = await google_oauth.exchange_code(code)
        account = await google_oauth.fetch_account_email(credentials)
    except google_oauth.GoogleAuthError:
        return RedirectResponse(f"{back}?gmail=error")
    # searched BY ADDRESS: a 2nd address gets its own row instead of overwriting the 1st one
    subscription = await session.scalar(select(Subscription).where(Subscription.user_id == user.id, Subscription.service_name == SERVICE_NAME, Subscription.account == account))
    if subscription is None:
        subscription = Subscription(user_id=user.id, service_name=SERVICE_NAME, account=account, credentials=credentials)
        session.add(subscription)
    else:
        # same address again -> fresh tokens for all its widgets. reassign, don't mutate the jsonb in place (not detected)
        subscription.credentials = credentials
    # read before relinking
    previous = instance.subscription_id
    # a brand new subscription has no id before the flush
    await session.flush()
    # THIS widget gets connected, not the other ones
    instance.subscription_id = subscription.id
    # token had expired and it came back with another address -> the old one may be used by nobody now
    if previous is not None and previous != subscription.id:
        await release_if_unused(session, previous)
    await session.commit()
    return RedirectResponse(f"{back}?gmail=connected")

@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def google_disconnect(widget: int, user=Depends(current_user), session=Depends(get_session)):
    instance = await owned_instance(widget, user, session)
    previous = instance.subscription_id
    # already disconnected: the goal is reached
    if previous is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    # only this widget is unlinked, the others keep the connection
    instance.subscription_id = None
    await release_if_unused(session, previous)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
