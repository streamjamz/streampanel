import uuid
import subprocess
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.stream_target import StreamTarget, PLATFORM_RTMP
from app.core.deps import get_current_user, require_role

logger = logging.getLogger(__name__)
router = APIRouter()


class TargetCreate(BaseModel):
    platform: str
    name: str
    stream_key: str
    rtmp_url: Optional[str] = None  # only for custom
    enabled: bool = False


class TargetUpdate(BaseModel):
    name: Optional[str] = None
    stream_key: Optional[str] = None
    rtmp_url: Optional[str] = None
    enabled: Optional[bool] = None


def target_dict(t: StreamTarget) -> dict:
    return {
        "id": str(t.id),
        "channel_id": str(t.channel_id),
        "platform": t.platform,
        "name": t.name,
        "stream_key": t.stream_key[:6] + "••••••",  # masked
        "stream_key_full": t.stream_key,
        "rtmp_url": t.rtmp_url,
        "full_rtmp_url": t.full_rtmp_url,
        "enabled": t.enabled,
        "created_at": t.created_at.isoformat(),
    }


@router.get("/platforms")
async def list_platforms():
    """Return supported platforms and their RTMP base URLs."""
    return [
        {"id": "youtube",  "name": "YouTube Live",   "icon": "▶", "rtmp_base": PLATFORM_RTMP["youtube"],  "key_help": "Found in YouTube Studio → Go Live → Stream key"},
        {"id": "twitch",   "name": "Twitch",          "icon": "🟣", "rtmp_base": PLATFORM_RTMP["twitch"],   "key_help": "Found in Twitch Dashboard → Settings → Stream → Primary Stream key"},
        {"id": "facebook", "name": "Facebook Live",   "icon": "📘", "rtmp_base": PLATFORM_RTMP["facebook"], "key_help": "Found in Facebook → Live Producer → Use Stream Key"},
        {"id": "tiktok",   "name": "TikTok Live",     "icon": "🎵", "rtmp_base": PLATFORM_RTMP["tiktok"],   "key_help": "Available to eligible TikTok accounts — found in LIVE Studio"},
        {"id": "kick",     "name": "Kick",             "icon": "🟢", "rtmp_base": PLATFORM_RTMP["kick"],     "key_help": "Found in Kick Dashboard → Channel → Stream Key"},
        {"id": "custom",   "name": "Custom RTMP",      "icon": "⚙", "rtmp_base": "",                         "key_help": "Enter your own RTMP server URL and stream key"},
    ]


@router.get("/channel/{channel_id}")
async def list_targets(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(StreamTarget).where(StreamTarget.channel_id == channel_id, StreamTarget.tenant_id == user.tenant_id)
    )
    targets = result.scalars().all()
    return [target_dict(t) for t in targets]


@router.post("/channel/{channel_id}")
async def create_target(
    channel_id: uuid.UUID,
    body: TargetCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    if body.platform not in PLATFORM_RTMP:
        raise HTTPException(400, detail=f"Unknown platform. Supported: {list(PLATFORM_RTMP.keys())}")
    if body.platform == "custom" and not body.rtmp_url:
        raise HTTPException(400, detail="Custom platform requires an RTMP URL")

    t = StreamTarget(
        id=uuid.uuid4(),
        channel_id=channel_id,
        tenant_id=user.tenant_id,
        platform=body.platform,
        name=body.name,
        stream_key=body.stream_key,
        rtmp_url=body.rtmp_url,
        enabled=body.enabled,
    )
    db.add(t)
    await db.commit()

    if body.enabled:
        _start_restream(str(channel_id), str(t.id), t.full_rtmp_url)

    return target_dict(t)


@router.patch("/{target_id}")
async def update_target(
    target_id: uuid.UUID,
    body: TargetUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    t = await db.get(StreamTarget, target_id)
    if not t or t.tenant_id != user.tenant_id:
        raise HTTPException(404)

    was_enabled = t.enabled

    if body.name is not None: t.name = body.name
    if body.stream_key is not None: t.stream_key = body.stream_key
    if body.rtmp_url is not None: t.rtmp_url = body.rtmp_url
    if body.enabled is not None: t.enabled = body.enabled

    await db.commit()

    # Start/stop restream based on enabled toggle
    channel_id = str(t.channel_id)
    target_id_str = str(t.id)
    if body.enabled is not None:
        if body.enabled and not was_enabled:
            _start_restream(channel_id, target_id_str, t.full_rtmp_url)
        elif not body.enabled and was_enabled:
            _stop_restream(channel_id, target_id_str)

    return target_dict(t)


@router.delete("/{target_id}")
async def delete_target(
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    t = await db.get(StreamTarget, target_id)
    if not t or t.tenant_id != user.tenant_id:
        raise HTTPException(404)

    _stop_restream(str(t.channel_id), str(t.id))
    await db.delete(t)
    await db.commit()
    return {"status": "deleted"}


def _start_restream(channel_id: str, target_id: str, dest_url: str):
    """Start an FFmpeg restream process pulling from SRS and pushing to destination."""
    service = f"panel-restream@{channel_id}_{target_id}.service"
    # Write the dest URL to a temp file so systemd can pick it up
    import os
    os.makedirs("/tmp/panel-restream", exist_ok=True)
    with open(f"/tmp/panel-restream/{channel_id}_{target_id}.url", "w") as f:
        f.write(dest_url)
    result = subprocess.run(["systemctl", "start", service], capture_output=True, text=True)
    if result.returncode != 0:
        subprocess.run(["sudo", "systemctl", "start", service], capture_output=True, text=True)
    logger.info(f"Restream started: {channel_id} → {dest_url[:40]}")


def _stop_restream(channel_id: str, target_id: str):
    """Stop the restream process for this target."""
    service = f"panel-restream@{channel_id}_{target_id}.service"
    subprocess.run(["systemctl", "stop", service], capture_output=True, text=True)
    subprocess.run(["sudo", "systemctl", "stop", service], capture_output=True, text=True)
    logger.info(f"Restream stopped: {channel_id}_{target_id}")
