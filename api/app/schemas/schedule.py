from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class BlockCreate(BaseModel):
    channel_id: UUID
    asset_id: Optional[UUID] = None
    block_type: str = "asset"
    start_time: str  # "HH:MM:SS"
    duration_secs: Optional[float] = None
    day_mask: int = 127
    priority: int = 0
    notes: Optional[str] = None


class BlockOut(BaseModel):
    id: UUID
    channel_id: UUID
    asset_id: Optional[UUID]
    block_type: str
    start_time: str
    duration_secs: Optional[float]
    day_mask: int
    priority: int
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class NowPlayingResponse(BaseModel):
    block_id: Optional[UUID]
    asset_id: Optional[UUID]
    block_type: Optional[str]
    offset_secs: float
    message: Optional[str]


class ScheduleValidateResponse(BaseModel):
    valid: bool
    issues: list[str]
