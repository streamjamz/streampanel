import uuid
from datetime import datetime, timezone, time
from decimal import Decimal
from sqlalchemy import DateTime, String, Integer, Text, ForeignKey, Numeric, SmallInteger, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class ScheduleBlock(Base):
    __tablename__ = "schedule_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"))
    asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    playlist_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    block_type: Mapped[str] = mapped_column(String(20), default="asset")
    # block_type: asset | playlist | live_event | filler_loop
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_secs: Mapped[Decimal | None] = mapped_column(Numeric(10, 3), nullable=True)
    day_mask: Mapped[int] = mapped_column(SmallInteger, default=127)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    channel = relationship("Channel", back_populates="schedule_blocks")
    asset = relationship("Asset")
    playlist = relationship("Playlist")
