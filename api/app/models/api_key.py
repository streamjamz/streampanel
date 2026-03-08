import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class ApiKey(Base):
    __tablename__ = "api_keys"

    id:           Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id:    Mapped[uuid.UUID]        = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    created_by:   Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name:         Mapped[str]              = mapped_column(String(120), nullable=False)
    key_hash:     Mapped[str]              = mapped_column(String(128), nullable=False, unique=True)
    key_prefix:   Mapped[str]              = mapped_column(String(12), nullable=False)
    is_active:    Mapped[bool]             = mapped_column(Boolean, default=True)
    created_at:   Mapped[datetime]         = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_used_at: Mapped[datetime | None]  = mapped_column(DateTime(timezone=True), nullable=True)
