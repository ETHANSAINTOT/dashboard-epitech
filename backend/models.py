import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, String, func, ForeignKey, Integer, UniqueConstraint, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from typing import Any


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Public identifier, exposed in the API and carried by the JWT. The serial id stays internal: it would leak how many accounts exist
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    # unique=True is the real defence against duplicate emails. A SELECT before the INSERT would not be enough: two concurrent requests both pass it
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Single-use secret sent by email. Cleared once consumed, so a replayed link fails
    confirmation_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    confirmation_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    widget_instances: Mapped[list["WidgetInstance"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True, order_by="WidgetInstance.position")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)
    # when the Terms of Service were accepted, at signup: the proof of consent (GDPR). null = account made before the box
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class WidgetInstance(Base):
    __tablename__ = "widget_instances"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # The catalogue lives in code, not in the database: these are plain names, resolved at runtime by catalog.find_widget(). A row can outlive its widget
    service_name: Mapped[str] = mapped_column(String(50))
    widget_name: Mapped[str] = mapped_column(String(50))
    # Params differ per widget type, so the shape cannot be fixed in columns, validate_config() is what guarantees the content matches the declaration
    config: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    refresh_seconds: Mapped[float] = mapped_column(Float, default=300.0)
    # Stacking order: the highest is drawn on top, moving a widget brings it to the front
    position: Mapped[int] = mapped_column(Integer, default=0)
    # Free placement, in px from the canvas top-left corner. NULL = created before free placement, the front puts it in a corner
    x: Mapped[int | None] = mapped_column(Integer, nullable=True)
    y: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subscription_id: Mapped[int | None] = mapped_column(ForeignKey("subscriptions.id", ondelete="SET NULL"), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user: Mapped["User"] = relationship(back_populates="widget_instances")
    # zoom of the card on a computer: 1 = its normal size (the minimum), 2 = twice as big (the maximum)
    scale: Mapped[float] = mapped_column(Float, default=1.0)

class Subscription(Base):
    __tablename__ = "subscriptions"
    # one row per google address: a user can have several gmail, never twice the same one
    # trailing comma = a tuple, sqlalchemy refuses a lone constraint
    __table_args__= (UniqueConstraint("user_id", "service_name", "account", name="uq_subscription_user_service_account"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    service_name:  Mapped[str] = mapped_column(String(50))
    # the google address of this connection, NULL = connected before multi-account
    account: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # OAuth tokens land here, plaintext for now — encrypt before the keynote
    credentials: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user: Mapped["User"] = relationship(back_populates="subscriptions")
