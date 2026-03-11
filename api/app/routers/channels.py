import uuid
import json
import secrets
import subprocess
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import aiofiles
from pathlib import Path
from datetime import datetime
import pytz
import logging

from app.database import get_db
from app.models.channel import Channel
from app.core.deps import get_current_user, require_role
from app.services.srs_manager import srs_manager
from app.redis_client import get_redis
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


class ChannelCreate(BaseModel):
    name: str
    slug: str
    channel_type: str  # live | tv
    timezone: str = "America/New_York"
    return_strategy: str = "as_clock"
    live_timeout_seconds: int = 10
    auto_return_to_vod: bool = True


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    return_strategy: Optional[str] = None
    offline_message: Optional[str] = None
    offline_bg_color: Optional[str] = None
    live_timeout_seconds: Optional[int] = None
    auto_return_to_vod: Optional[bool] = None
    logo_position: Optional[str] = None
    description: Optional[str] = None


@router.get("")
async def list_channels(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    from app.models.tenant import Tenant
    
    if user.role == "super_admin":
        result = await db.execute(select(Channel))
    else:
        result = await db.execute(select(Channel).where(Channel.tenant_id == user.tenant_id))
    channels = result.scalars().all()
    
    tenant_map = {}
    if user.role == "super_admin":
        tenants_result = await db.execute(select(Tenant))
        for t in tenants_result.scalars().all():
            tenant_map[str(t.id)] = t.name
    
    return [{
        "id": str(c.id), 
        "name": c.name, 
        "slug": c.slug, 
        "channel_type": c.channel_type, 
        "state": c.state,
        "tenant_name": tenant_map.get(str(c.tenant_id), "")
    } for c in channels]


@router.post("")
async def create_channel(
    body: ChannelCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    ch = Channel(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id,
        name=body.name,
        slug=body.slug,
        channel_type=body.channel_type,
        stream_key=secrets.token_urlsafe(24),
        timezone=body.timezone,
        return_strategy=body.return_strategy,
        live_timeout_seconds=body.live_timeout_seconds,
        auto_return_to_vod=body.auto_return_to_vod,
        state="OFFLINE",
    )
    db.add(ch)
    await db.commit()
    await db.refresh(ch)
    return {"id": str(ch.id), "stream_key": ch.stream_key}


@router.get("/{channel_id}")
async def get_channel(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    return ch


@router.put("/{channel_id}")
async def update_channel(
    channel_id: uuid.UUID,
    body: ChannelUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(ch, field, value)
    await db.commit()
    return {"status": "updated"}


@router.delete("/{channel_id}")
async def delete_channel(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    await db.delete(ch)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{channel_id}/ingest")
async def get_ingest(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    return {
        "rtmp_url": f"rtmp://{settings.SRS_RTMP_HOST}:{settings.SRS_RTMP_PORT}/live",
        "stream_key": ch.stream_key,
    }


@router.get("/{channel_id}/playback")
async def get_playback(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    
    return {
        "webrtc_url": srs_manager.webrtc_play_url(ch.stream_key),
        "hls_url": await srs_manager.hls_play_url_with_cdn(ch.stream_key, ch.channel_type),
    }


@router.get("/{channel_id}/status")
async def get_status(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    try:
        streams = await srs_manager.get_streams()
        live_active = any(s.get("name") == ch.stream_key for s in streams)
    except Exception:
        live_active = False
    return {"state": ch.state, "live_active": live_active, "last_live_seen": ch.last_live_seen}


@router.post("/{channel_id}/playout/start")
async def playout_start(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    if ch.channel_type != "tv":
        raise HTTPException(400, detail="Only TV channels have playout")

    result = subprocess.run(
        ["sudo", "systemctl", "start", f"panel-playout@{channel_id}.service"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        result2 = subprocess.run(
            ["systemctl", "start", f"panel-playout@{channel_id}.service"],
            capture_output=True,
            text=True,
        )
        if result2.returncode != 0:
            raise HTTPException(500, detail=f"Failed to start playout: {result2.stderr}")
    return {"status": "started"}


@router.post("/{channel_id}/playout/stop")
async def playout_stop(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
    redis=Depends(get_redis),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    await redis.publish(f"playout:{channel_id}:cmd", "STOP")
    ch.state = "READY"
    # Delete the currently playing schedule block
    from app.services.schedule_service import get_current_block
    block, _ = await get_current_block(db, str(channel_id))
    if block:
        await db.delete(block)
    await db.commit()
    return {"status": "stopping"}


@router.post("/{channel_id}/take-live")
async def take_live(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
    redis=Depends(get_redis),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    if ch.channel_type != "tv":
        raise HTTPException(400, "TV channel only")
    await redis.publish("controller:commands", json.dumps({
        "channel_id": str(channel_id), "cmd": "TAKE_LIVE"
    }))
    return {"status": "requested"}


@router.post("/{channel_id}/return-to-vod")
async def return_to_vod(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
    redis=Depends(get_redis),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    if ch.channel_type != "tv":
        raise HTTPException(400, "TV channel only")
    await redis.publish("controller:commands", json.dumps({
        "channel_id": str(channel_id), "cmd": "RETURN_TO_VOD"
    }))
    return {"status": "requested"}


@router.post("/{channel_id}/logo")
async def upload_logo(
    channel_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    """Upload a PNG logo for TV channel overlay."""
    from pathlib import Path
    import aiofiles
    from app.config import settings

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg"}:
        raise HTTPException(400, detail="Logo must be PNG or JPEG")

    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)

    logo_dir = Path(settings.MEDIA_ROOT) / str(user.tenant_id) / "logos"
    logo_dir.mkdir(parents=True, exist_ok=True)
    logo_path = logo_dir / f"{channel_id}{suffix}"

    async with aiofiles.open(logo_path, "wb") as f:
        while chunk := await file.read(256 * 1024):
            await f.write(chunk)

    ch.logo_path = str(logo_path)
    await db.commit()
    return {"status": "uploaded", "logo_path": str(logo_path)}


@router.post("/{channel_id}/filler")
async def upload_filler(
    channel_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
    redis=Depends(get_redis),
):
    from pathlib import Path
    import aiofiles
    from app.config import settings

    suffix = Path(file.filename or "").suffix.lower()
    allowed = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".mov", ".mkv", ".avi"}
    if suffix not in allowed:
        raise HTTPException(400, detail=f"Filler must be an image or video file")

    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)

    filler_dir = Path(settings.MEDIA_ROOT) / str(user.tenant_id) / "filler"
    filler_dir.mkdir(parents=True, exist_ok=True)
    filler_path = filler_dir / f"{channel_id}{suffix}"

    async with aiofiles.open(filler_path, "wb") as f:
        while chunk := await file.read(256 * 1024):
            await f.write(chunk)

    ch.filler_path = str(filler_path)
    await db.commit()

    await redis.publish(f"playout:{channel_id}:cmd", f"FILLER_UPDATED:{filler_path}")
    return {"status": "uploaded", "filler_path": str(filler_path)}


@router.delete("/{channel_id}/filler")
async def remove_filler(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
    redis=Depends(get_redis),
):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)

    if ch.filler_path:
        from pathlib import Path
        try:
            Path(ch.filler_path).unlink(missing_ok=True)
        except Exception:
            pass
    ch.filler_path = None
    await db.commit()

    await redis.publish(f"playout:{channel_id}:cmd", "FILLER_UPDATED:")
    return {"status": "removed"}


# ─── Public watch endpoints (no auth required) ───────────────────────────────

@router.get("/public/tenant/{tenant_slug}")
async def public_tenant(tenant_slug: str, db: AsyncSession = Depends(get_db)):
    from app.models.tenant import Tenant
    result = await db.execute(select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active == True))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, detail="Not found")
    ch_result = await db.execute(select(Channel).where(Channel.tenant_id == tenant.id))
    channels = ch_result.scalars().all()
    return {
        "tenant": {"id": str(tenant.id), "name": tenant.name, "slug": tenant.slug},
        "channels": [
            {
                "id": str(c.id),
                "name": c.name,
                "slug": c.slug,
                "channel_type": c.channel_type,
                "state": c.state,
                "hls_url": await srs_manager.hls_play_url_with_cdn(c.stream_key, c.channel_type),
            }
            for c in channels
        ]
    }


@router.get("/public/watch/{tenant_slug}/{channel_slug}")
async def public_channel(tenant_slug: str, channel_slug: str, db: AsyncSession = Depends(get_db)):
    from app.models.tenant import Tenant
    from app.models.schedule import ScheduleBlock
    from app.models.playlist import Playlist
    from app.models.asset import Asset
    
    t_result = await db.execute(select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active == True))
    tenant = t_result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, detail="Not found")
    c_result = await db.execute(select(Channel).where(Channel.slug == channel_slug, Channel.tenant_id == tenant.id))
    ch = c_result.scalar_one_or_none()
    if not ch:
        raise HTTPException(404, detail="Channel not found")
    
    # Get upcoming schedule blocks
    upcoming = []
    try:
        tz = pytz.timezone(ch.timezone or "UTC")
        now = datetime.now(tz)
        current_time = now.time()
        current_day_bit = 1 << now.weekday()
        
        blocks_result = await db.execute(
            select(ScheduleBlock)
            .where(
                ScheduleBlock.channel_id == ch.id,
                ScheduleBlock.day_mask.op('&')(current_day_bit) != 0
            )
            .order_by(ScheduleBlock.start_time)
        )
        blocks = blocks_result.scalars().all()
        
        for block in blocks:
            if block.start_time > current_time:
                content_name = "Unknown"
                if block.playlist_id:
                    playlist = await db.get(Playlist, block.playlist_id)
                    content_name = f"{playlist.name} (Playlist)" if playlist else "Playlist"
                elif block.asset_id:
                    asset = await db.get(Asset, block.asset_id)
                    content_name = asset.original_name if asset else "Video"
                
                upcoming.append({
                    "time": block.start_time.strftime("%I:%M %p"),
                    "content": content_name,
                    "type": block.block_type
                })
                
                if len(upcoming) >= 3:
                    break
    except Exception as e:
        logger.error(f"Error fetching upcoming schedule: {e}")
    
    return {
        "tenant": {"name": tenant.name, "slug": tenant.slug},
        "channel": {
            "id": str(ch.id),
            "name": ch.name,
            "slug": ch.slug,
            "channel_type": ch.channel_type,
            "state": ch.state,
            "hls_url": await srs_manager.hls_play_url_with_cdn(ch.stream_key, ch.channel_type),
            "webrtc_url": srs_manager.webrtc_play_url(ch.stream_key),
            "upcoming_schedule": upcoming,
            "description": ch.description
        }
    }


@router.post("/{channel_id}/offline-logo")
async def upload_offline_logo(channel_id: uuid.UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    import os, aiofiles
    upload_dir = f"/var/lib/panel/uploads/{ch.tenant_id}/offline"
    os.makedirs(upload_dir, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    dest = f"{upload_dir}/offline_logo_{channel_id}{ext}"
    async with aiofiles.open(dest, "wb") as f:
        await f.write(await file.read())
    ch.offline_logo_path = dest
    await db.commit()
    return {"offline_logo_path": dest}

@router.delete("/{channel_id}/offline-logo")
async def delete_offline_logo(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404)
    import os
    if ch.offline_logo_path and os.path.exists(ch.offline_logo_path):
        os.remove(ch.offline_logo_path)
    ch.offline_logo_path = None
    await db.commit()
    return {"ok": True}
