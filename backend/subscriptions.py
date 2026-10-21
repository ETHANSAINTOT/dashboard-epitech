from sqlalchemy import func, select
import github_oauth
import google_oauth
from models import Subscription, WidgetInstance

# each provider gives its own access back
async def revoke_credentials(subscription):
    if subscription.service_name == "github":
        await github_oauth.revoke(subscription.credentials)
    else:
        await google_oauth.revoke(subscription.credentials)

# shared by the Disconnect button and the × of a widget
# call it after the widget got unlinked or deleted, before the commit
async def release_if_unused(session, subscription_id):
    # the count below has to see the unlink / delete
    await session.flush()
    remaining = await session.scalar(select(func.count()).select_from(WidgetInstance).where(WidgetInstance.subscription_id == subscription_id))
    # another widget still uses it
    if remaining > 0:
        return
    subscription = await session.get(Subscription, subscription_id)
    if subscription is None:
        return
    # nobody uses it anymore -> give the access back to google
    # not before: a revoke kills the access of every widget using that account
    await revoke_credentials(subscription)
    await session.delete(subscription)
