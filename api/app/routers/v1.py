import uuid, subprocess
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.channel import Channel
from app.models.asset import Asset
from app.models.playlist import Playlist
from app.models.schedule import ScheduleBlock
from app.models.stream_target import StreamTarget
from app.models.tenant import Tenant
from app.core.apikey_dep import get_api_key_tenant
from app.config import settings
import redis as sync_redis

router = APIRouter()

def _ch(ch):    return {"id":str(ch.id),"name":ch.name,"slug":ch.slug,"channel_type":ch.channel_type,"state":ch.state,"stream_key":ch.stream_key}
def _asset(a):  return {"id":str(a.id),"filename":a.original_name,"status":a.status,"duration_secs":a.duration_secs,"size_bytes":a.file_size}
def _pl(p):     return {"id":str(p.id),"name":p.name}
def _block(b):  return {"id":str(b.id),"block_type":b.block_type,"start_time":str(b.start_time),"day_mask":b.day_mask,"duration_secs":b.duration_secs,"playlist_id":str(b.playlist_id) if b.playlist_id else None,"asset_id":str(b.asset_id) if b.asset_id else None}
def _target(t): return {"id":str(t.id),"platform":t.platform,"name":t.name,"enabled":t.enabled}

# ── Tenant ────────────────────────────────────────────────────────────────────
@router.get("/tenant", summary="Get tenant info", tags=["v1"])
async def get_tenant(tenant: Tenant = Depends(get_api_key_tenant)):
    return {"id":str(tenant.id),"name":tenant.name,"slug":tenant.slug,"plan":tenant.plan,"max_channels":tenant.max_channels,"max_storage_gb":tenant.max_storage_gb}

# ── Channels ──────────────────────────────────────────────────────────────────
@router.get("/channels", summary="List channels", tags=["v1"])
async def list_channels(db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    r = await db.execute(select(Channel).where(Channel.tenant_id == tenant.id))
    return [_ch(c) for c in r.scalars().all()]

@router.get("/channels/{channel_id}", summary="Get channel", tags=["v1"])
async def get_channel(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    return _ch(ch)

@router.get("/channels/{channel_id}/ingest", summary="Get ingest details", tags=["v1"])
async def get_ingest(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    return {
        "rtmp_url": f"rtmp://{settings.SRS_RTMP_HOST}:{settings.SRS_RTMP_PORT}/live",
        "stream_key": ch.stream_key,
        "full_rtmp": f"rtmp://{settings.SRS_RTMP_HOST}:{settings.SRS_RTMP_PORT}/live/{ch.stream_key}",
        "hls_url": f"{settings.PANEL_BASE_URL}/hls/{ch.stream_key}/index.m3u8",
    }

@router.post("/channels/{channel_id}/playout/start", summary="Start playout", tags=["v1"])
async def start_playout(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    subprocess.run(["sudo", "systemctl", "start", f"panel-playout@{ch.id}.service"], capture_output=True)
    return {"started": True}

@router.post("/channels/{channel_id}/playout/stop", summary="Stop playout", tags=["v1"])
async def stop_playout(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    subprocess.run(["sudo", "systemctl", "stop", f"panel-playout@{ch.id}.service"], capture_output=True)
    return {"stopped": True}

@router.post("/channels/{channel_id}/playout/skip", summary="Skip current item", tags=["v1"])
async def skip_playout(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    try:
        r = sync_redis.from_url(settings.REDIS_URL, decode_responses=True)
        r.publish(f"playout:{ch.id}:cmd", "SKIP")
    except Exception as e:
        raise HTTPException(500, f"Redis error: {e}")
    return {"skipped": True}

# ── Assets ────────────────────────────────────────────────────────────────────
@router.get("/assets", summary="List assets", tags=["v1"])
async def list_assets(db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    r = await db.execute(select(Asset).where(Asset.tenant_id == tenant.id).order_by(Asset.created_at.desc()))
    return [_asset(a) for a in r.scalars().all()]

@router.get("/assets/{asset_id}", summary="Get asset", tags=["v1"])
async def get_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    a = await db.get(Asset, asset_id)
    if not a or a.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    return _asset(a)

@router.delete("/assets/{asset_id}", summary="Delete asset", tags=["v1"])
async def delete_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    a = await db.get(Asset, asset_id)
    if not a or a.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    await db.delete(a)
    await db.commit()
    return {"deleted": True}

# ── Playlists ─────────────────────────────────────────────────────────────────
@router.get("/playlists", summary="List playlists", tags=["v1"])
async def list_playlists(db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    r = await db.execute(select(Playlist).where(Playlist.tenant_id == tenant.id))
    return [_pl(p) for p in r.scalars().all()]

@router.get("/playlists/{playlist_id}", summary="Get playlist", tags=["v1"])
async def get_playlist(playlist_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    p = await db.get(Playlist, playlist_id)
    if not p or p.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    return _pl(p)

# ── Schedule ──────────────────────────────────────────────────────────────────
@router.get("/channels/{channel_id}/schedule", summary="Get schedule", tags=["v1"])
async def get_schedule(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    r = await db.execute(select(ScheduleBlock).where(ScheduleBlock.channel_id == channel_id).order_by(ScheduleBlock.start_time))
    return [_block(b) for b in r.scalars().all()]

# ── Stream Targets ────────────────────────────────────────────────────────────
@router.get("/channels/{channel_id}/targets", summary="List stream targets", tags=["v1"])
async def list_targets(channel_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    r = await db.execute(select(StreamTarget).where(StreamTarget.channel_id == channel_id))
    return [_target(t) for t in r.scalars().all()]

@router.patch("/channels/{channel_id}/targets/{target_id}/toggle", summary="Toggle stream target", tags=["v1"])
async def toggle_target(channel_id: uuid.UUID, target_id: uuid.UUID, db: AsyncSession = Depends(get_db), tenant: Tenant = Depends(get_api_key_tenant)):
    ch = await db.get(Channel, channel_id)
    if not ch or ch.tenant_id != tenant.id: raise HTTPException(404, "Not found")
    t = await db.get(StreamTarget, target_id)
    if not t or t.channel_id != channel_id: raise HTTPException(404, "Not found")
    t.enabled = not t.enabled
    await db.commit()
    return {"id": str(t.id), "enabled": t.enabled}
