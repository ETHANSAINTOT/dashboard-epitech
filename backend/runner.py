import httpx
from sqlalchemy.ext.asyncio import AsyncSession
import catalog
from catalog.errors import NotSubscribed, WidgetError, WidgetUnavailable
from models import Subscription, User, WidgetInstance

async def run_widget(instance, user, session):
    entry = catalog.find_widget(instance.service_name, instance.widget_name)
    if entry is None:
        raise WidgetUnavailable("This widget is no longer available")
    service, widget = entry
    subscription = None
    credentials = None
    if service.requires_subscription:
        # each widget has its own connection, a new one starts unconnected
        if instance.subscription_id is None:
            raise NotSubscribed("Connect this widget first")
        subscription = await session.get(Subscription, instance.subscription_id)
        # user check costs nothing, in case a link ever points to someone else's row
        if subscription is None or subscription.user_id != user.id:
            raise NotSubscribed("Connect this widget first")
        # copy, the fetch may refresh the token inside it
        credentials = dict(subscription.credentials)
    try:
        data = await widget.fetch(instance.config, credentials)
    # any http failure upstream -> one WidgetError -> the route answers 502, not a 500
    except httpx.HTTPError as error:
        raise WidgetError(f"{service.name} is unavailable") from error
    # token got refreshed -> save it. reassign bc in place jsonb changes aren't detected
    if subscription is not None and credentials != subscription.credentials:
        subscription.credentials = credentials
        await session.commit()
    return data