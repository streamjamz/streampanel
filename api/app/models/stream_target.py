import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

PLATFORM_RTMP = {
    "youtube":  "rtmp://x.rtmp.youtube.com/live2",
    "twitch":   "rtmp://live.twitch.tv/app",
    "facebook": "rtmps://live-api-s.facebook.com:443/rtmp",
    "tiktok":   "rtmp://push.tiktokv.com/live",
    "kick":     "rtmps://fa723fc1b171.global-contribute.live-video.net/app",
    "custom":   "",
}

class StreamTarget(Base):
    __tablename__ = "stream_targets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"))
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
    platform: Mapped[str] = mapped_column(String(20), nullable=False)  # youtube|twitch|facebook|tiktok|kick|custom
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    stream_key: Mapped[str] = mapped_column(Text, nullable=False)
    rtmp_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # override for custom
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    channel = relationship("Channel", back_populates="stream_targets")

    @property
    def full_rtmp_url(self) -> str:
        base = self.rtmp_url if self.platform == "custom" else PLATFORM_RTMP.get(self.platform, "")
        return f"{base}/{self.stream_key}"
