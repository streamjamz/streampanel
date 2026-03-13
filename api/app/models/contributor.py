import uuid
import secrets
from datetime import datetime, timezone, time
from sqlalchemy import DateTime, String, Boolean, Integer, Time, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Contributor(Base):
    __tablename__ = "contributors"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=False)
    
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    stream_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    role: Mapped[str] = mapped_column(String(30), default="DJ")  # DJ, Guest, Co-host
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Recurring schedule slot (optional)
    recurring_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_day: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Monday, 6=Sunday
    recurring_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    recurring_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    channel = relationship("Channel", back_populates="contributors")
