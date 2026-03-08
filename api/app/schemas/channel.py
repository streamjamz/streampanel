from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ChannelCreate(BaseModel):
    name: str
    slug: str
    channel_type: str  # live | tv
    timezone: str = "UTC"
    return_strategy: str = "as_clock"
    live_timeout_seconds: int = 10
    auto_return_to_vod: bool = True


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    return_strategy: Optional[str] = None
    live_timeout_seconds: Optional[int] = None
    auto_return_to_vod: Optional[bool] = None
    logo_position: Optional[str] = None


class ChannelOut(BaseModel):
    id: UUID
    name: str
    slug: str
    channel_type: str
    state: str
    timezone: str
    return_strategy: str
    live_timeout_seconds: int
    auto_return_to_vod: bool
    logo_position: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class IngestInfo(BaseModel):
    rtmp_url: str
    stream_key: str


class PlaybackInfo(BaseModel):
    webrtc_url: str
    hls_url: str


class ChannelStatus(BaseModel):
    state: str
    live_active: bool
    last_live_seen: Optional[datetime]
