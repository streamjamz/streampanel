import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Boolean, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

# Plan definitions
PLANS = {
    "live": {
        "label": "Live Streaming",
        "features": ["live_channels"],
        "max_channels": 2,
        "max_storage_gb": 10,
    },
    "tv": {
        "label": "TV Station",
        "features": ["tv_channels", "playlists", "schedule"],
        "max_channels": 2,
        "max_storage_gb": 100,
    },
    "pro": {
        "label": "Pro",
        "features": ["live_channels", "tv_channels", "playlists", "schedule"],
        "max_channels": 10,
        "max_storage_gb": 500,
    },
    "enterprise": {
        "label": "Enterprise",
        "features": ["live_channels", "tv_channels", "playlists", "schedule"],
        "max_channels": 999,
        "max_storage_gb": 99999,
    },
}


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(30), default="live", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    max_channels: Mapped[int] = mapped_column(Integer, default=2)
    max_storage_gb: Mapped[int] = mapped_column(Integer, default=10)
    feature_flags: Mapped[dict] = mapped_column(JSON, default=dict)
    notes: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    channels = relationship("Channel", back_populates="tenant", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="tenant", cascade="all, delete-orphan")

    def has_feature(self, feature: str) -> bool:
        """Check if tenant has access to a feature based on plan + overrides."""
        plan_features = PLANS.get(self.plan, {}).get("features", [])
        overrides = self.feature_flags or {}
        # Explicit override takes priority
        if feature in overrides:
            return bool(overrides[feature])
        return feature in plan_features
