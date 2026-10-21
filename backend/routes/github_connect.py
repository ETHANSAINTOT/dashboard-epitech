import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
import github_oauth
from config import APP_BASE_URL
from database import get_session
from models import Subscription, User, WidgetInstance
from routes.widgets import owned_instance
from security import create_oauth_state, current_user, read_oauth_state
from subscriptions import release_if_unused

router = APIRouter(prefix="/api/oauth/github", tags=["oauth"])

SERVICE_NAME = "github"

@router.get("/url")
async def github_authorize_url(widget: int, user=Depends(current_user), session=Depends(get_session)):
    instance = await owned_instance(widget, user, session)
    if instance.service_name != SERVICE_NAME:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This widget does not use GitHub")
    if not github_oauth.is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub login is not configured on the server")
    return {"url": github_oauth.authorize_url(create_oauth_state(user.client_id, "github", instance.id))}

# public on purpose, github redirects the browser here -> no bearer header: only the signed state tells who is back
@router.get("/callback")
async def github_callback(code=None, state=None, error=None, session=Depends(get_session)):
    back = f"{APP_BASE_URL}/dashboard"
    if error or not code or not state:
        return RedirectResponse(f"{back}?github=denied")
    read = read_oauth_state(state, "github")
    if read is None:
        return RedirectResponse(f"{back}?github=error")
    client_id, widget_id = read
    user = await session.scalar(select(User).where(User.client_id == client_id))
    if user is None:
        return RedirectResponse(f"{back}?github=error")
    instance = await session.scalar(select(WidgetInstance).where(WidgetInstance.id == widget_id, WidgetInstance.user_id == user.id))
    if instance is None:
        return RedirectResponse(f"{back}?github=error")
    try:
        credentials = await github_oauth.exchange_code(code)
        account = await github_oauth.fetch_login(credentials)
    except (github_oauth.GithubAuthError, httpx.HTTPError):
        return RedirectResponse(f"{back}?github=error")
    subscription = await session.scalar(select(Subscription).where(Subscription.user_id == user.id, Subscription.service_name == SERVICE_NAME, Subscription.account == account))
    if subscription is None:
        subscription = Subscription(user_id=user.id, service_name=SERVICE_NAME, account=account, credentials=credentials)
        session.add(subscription)
    else:
        # reassign, don't mutate the jsonb in place (not detected)
        subscription.credentials = credentials
    previous = instance.subscription_id
    await session.flush()
    instance.subscription_id = subscription.id
    if previous is not None and previous != subscription.id:
        await release_if_unused(session, previous)
    await session.commit()
    return RedirectResponse(f"{back}?github=connected")

@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def github_disconnect(widget: int, user=Depends(current_user), session=Depends(get_session)):
    instance = await owned_instance(widget, user, session)
    previous = instance.subscription_id
    if previous is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    instance.subscription_id = None
    await release_if_unused(session, previous)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
