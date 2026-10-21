from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
import catalog
from catalog.errors import ConfigError, NotSubscribed, WidgetError, WidgetUnavailable
from database import get_session
from models import Subscription, User, WidgetInstance
from runner import run_widget
from schemas import WidgetCreate, WidgetReorder, WidgetResponse, WidgetUpdate
from security import current_user
from subscriptions import release_if_unused

router = APIRouter(prefix="/api/widgets", tags=["widgets"])

async def owned_instance(instance_id: int, user: User, session: AsyncSession) -> WidgetInstance:
    instance = await session.scalar(select(WidgetInstance).where(WidgetInstance.id == instance_id, WidgetInstance.user_id == user.id,))
    # 404 and not 403: a 403 would confirm the id exists on another account
    if instance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Widget not found")
    return instance

@router.get("", response_model=list[WidgetResponse])
async def list_widgets(user: User = Depends(current_user), session: AsyncSession = Depends(get_session),) -> list[WidgetInstance]:
    # Query the table directly: traversing user.widget_instances would trigger a lazy load and raise MissingGreenlet under async
    rows = await session.scalars(select(WidgetInstance).where(WidgetInstance.user_id == user.id).order_by(WidgetInstance.position))
    return list(rows)

@router.post("", response_model=WidgetResponse, status_code=status.HTTP_201_CREATED)
async def create_widget(
    payload: WidgetCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),) -> WidgetInstance:
    entry = catalog.find_widget(payload.service_name, payload.widget_name)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown widget")
    _, widget = entry
    try:
        config = catalog.validate_config(widget, payload.config)
    except ConfigError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, error.errors)
    last = await session.scalar(select(func.max(WidgetInstance.position)).where(WidgetInstance.user_id == user.id))
    instance = WidgetInstance(user_id=user.id, service_name=payload.service_name, widget_name=payload.widget_name, config=config, refresh_seconds=payload.refresh_seconds, position=0 if last is None else last + 1, x=payload.x, y=payload.y, scale=payload.scale)
    session.add(instance)
    await session.commit()
    await session.refresh(instance)
    return instance

# Must stay above /{instance_id}: FastAPI matches in declaration order, and positions would otherwise be captured as an instance_id
@router.patch("/positions", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_widgets(
    payload: WidgetReorder,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),) -> Response:
    instances = list(await session.scalars(select(WidgetInstance).where(WidgetInstance.user_id == user.id)))
    # Validate the whole list before writing: a partial list would leave the grid half-reordered
    if set(payload.ids) != {instance.id for instance in instances}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The list must contain exactly your widget ids")
    order = {identifier: position for position, identifier in enumerate(payload.ids)}
    for instance in instances:
        instance.position = order[instance.id]
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.patch("/{instance_id}", response_model=WidgetResponse)
async def update_widget(
    instance_id: int,
    payload: WidgetUpdate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),) -> WidgetInstance:
    instance = await owned_instance(instance_id, user, session)
    if payload.config is not None:
        entry = catalog.find_widget(instance.service_name, instance.widget_name)
        if entry is None:
            raise HTTPException(status.HTTP_410_GONE, "This widget is no longer available")
        _, widget = entry
        try:
            # Reassignment, never in-place mutation: SQLAlchemy tracks changes by reference, so instance.config["city"] = ... would never persist
            instance.config = catalog.validate_config(widget, payload.config)
        except ConfigError as error:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, error.errors)
    if payload.refresh_seconds is not None:
        instance.refresh_seconds = payload.refresh_seconds
    if payload.x is not None:
        instance.x = payload.x
    if payload.y is not None:
        instance.y = payload.y
    if payload.scale is not None:
        instance.scale = payload.scale
    # a widget just moved or resized goes on top of the ones it may now overlap
    if payload.x is not None or payload.y is not None or payload.scale is not None:
        last = await session.scalar(select(func.max(WidgetInstance.position)).where(WidgetInstance.user_id == user.id))
        instance.position = last + 1
    await session.commit()
    await session.refresh(instance)
    return instance

@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_widget(
    instance_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),) -> Response:
    instance = await owned_instance(instance_id, user, session)
    # read before the delete, the row is gone after
    link = instance.subscription_id
    await session.delete(instance)
    if link is not None:
        await release_if_unused(session, link)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/{instance_id}/data")
async def read_widget_data(
    instance_id: int,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),) -> dict[str, Any]:
    instance = await owned_instance(instance_id, user, session)
    try:
        data = await run_widget(instance, user, session)
    except WidgetUnavailable as error:
        raise HTTPException(status.HTTP_410_GONE, str(error))
    except NotSubscribed as error:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(error))
    except WidgetError as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(error))
    # which address this widget shows, so 2 gmail widgets can be told apart
    account = None
    if instance.subscription_id is not None:
        # already loaded by the runner: get() takes it from the session, no 2nd query
        subscription = await session.get(Subscription, instance.subscription_id)
        if subscription is not None:
            account = subscription.account
    return {"data": data, "account": account, "fetchedAt": datetime.now(timezone.utc).isoformat()}
