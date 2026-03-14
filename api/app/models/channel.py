import uuid
from app.models.contributor import Contributor  # noqa: F401
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Boolean, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), nullable=False)
    channel_type: Mapped[str] = mapped_column(String(10), nullable=False)
    # channel_type: live | tv
    stream_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    state: Mapped[str] = mapped_column(String(30), default="OFFLINE")
    # states: OFFLINE | READY | LIVE_ONLY | TV_VOD_RUNNING | TV_LIVE_RUNNING
    #         TV_LIVE_REQUESTED | TV_VOD_RETURNING
    auto_return_to_vod: Mapped[bool] = mapped_column(Boolean, default=True)
    max_contributors: Mapped[int] = mapped_column(Integer, default=3)
    live_timeout_seconds: Mapped[int] = mapped_column(Integer, default=10)
    return_strategy: Mapped[str] = mapped_column(String(20), default="as_clock")
    # return_strategy: as_clock | resume_paused | filler_then_resume
    logo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_position: Mapped[str | None] = mapped_column(String(20), default="top-right")
    filler_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    timezone: Mapped[str] = mapped_column(String(60), default="UTC")
    playout_pid: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_live_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    offline_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    offline_logo_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    offline_bg_color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    tenant = relationship("Tenant", back_populates="channels")
    schedule_blocks = relationship("ScheduleBlock", back_populates="channel", cascade="all, delete-orphan")
    playout_cursor = relationship("PlayoutCursor", back_populates="channel", uselist=False, cascade="all, delete-orphan")
    stream_targets = relationship("StreamTarget", back_populates="channel", cascade="all, delete-orphan")
    contributors = relationship("Contributor", back_populates="channel", cascade="all, delete-orphan")
