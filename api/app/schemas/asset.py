from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class AssetOut(BaseModel):
    id: UUID
    original_name: str
    filename: str
    file_size: Optional[int]
    duration_secs: Optional[float]
    width: Optional[int]
    height: Optional[int]
    video_codec: Optional[str]
    audio_codec: Optional[str]
    audio_channels: Optional[int]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AssetUploadResponse(BaseModel):
    id: UUID
    status: str
