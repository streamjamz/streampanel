import os
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from app.models.channel import Channel
import redis.asyncio as aioredis
from app.config import settings

router = APIRouter()
logger = logging.getLogger("hooks")
HOOK_SECRET = os.environ.get("SRS_HOOK_SECRET", "")

async def _verify_hook_secret(request: Request):
    if not HOOK_SECRET:
        return
    secret = request.query_params.get("secret") or request.headers.get("X-SRS-Secret", "")
    if secret != HOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid hook secret")

async def _get_channel_by_stream_key(stream_name: str, db: AsyncSession):
    result = await db.execute(select(Channel).where(Channel.stream_key == stream_name))
    ch = result.scalar_one_or_none()
    is_internal = False
    if not ch and stream_name.endswith("-int"):
        base_key = stream_name[:-4]
        result = await db.execute(select(Channel).where(Channel.stream_key == base_key))
        ch = result.scalar_one_or_none()
        if ch:
            is_internal = True
    if not ch:
        try:
            channel_id = uuid.UUID(stream_name)
            result = await db.execute(select(Channel).where(Channel.id == channel_id))
            ch = result.scalar_one_or_none()
            if ch:
                is_internal = True
        except (ValueError, AttributeError):
            pass
    return ch, is_internal

@router.post("/srs/publish")
async def srs_on_publish(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    await _verify_hook_secret(request)
    stream_name = body.get("stream")
    if not stream_name:
        raise HTTPException(400, detail="Missing stream name")

    ch, is_internal = await _get_channel_by_stream_key(stream_name, db)

    if not ch:
        logger.warning(f"Rejected unknown stream key: {stream_name}")
        return {"code": 403, "msg": "Unknown stream key"}

    if is_internal:
        logger.info(f"RTMP publish (playout): channel={ch.name} key={stream_name}")
        return {"code": 0}

    # External encoder (OBS) connected
    logger.info(f"OBS CONNECTED: channel={ch.name} (id={ch.id}) key={stream_name}")

    # Update last_live_seen
    await db.execute(
        update(Channel)
        .where(Channel.id == ch.id)
        .values(last_live_seen=datetime.now(timezone.utc))
    )
    await db.commit()

    # Pause playout worker immediately so OBS can take over
    # ✅ FIX: Send to correct Redis channel (without :cmd suffix)
    try:
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Send PAUSE command - worker expects this format
        await redis.publish(f"playout:{ch.id}:cmd", "PAUSE")
        
        # Also set OBS_CONNECTED flag
        await redis.set(f"channel:{ch.id}:OBS_CONNECTED", "1", ex=30)
        
        await redis.aclose()
        logger.info(f"✓ Sent PAUSE command to playout:{ch.id}")
    except Exception as e:
        logger.error(f"✗ Failed to pause playout: {e}")

    # Update state
    await db.execute(
        update(Channel).where(Channel.id == ch.id).values(state="TV_LIVE_RUNNING")
    )
    await db.commit()

    return {"code": 0}

@router.post("/srs/unpublish")
async def srs_on_unpublish(
    request: Request,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    await _verify_hook_secret(request)
    stream_name = body.get("stream", "unknown")

    ch, is_internal = await _get_channel_by_stream_key(stream_name, db)

    if not ch or is_internal:
        logger.info(f"RTMP unpublish (internal): key={stream_name}")
        return {"code": 0}

    # External encoder disconnected
    logger.info(f"OBS DISCONNECTED: channel={ch.name} (id={ch.id}) key={stream_name}")

    # Resume playout as clock
    # ✅ FIX: Send to correct Redis channel (without :cmd suffix)
    try:
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Send RESUME_AS_CLOCK command - worker expects this format
        await redis.publish(f"playout:{ch.id}:cmd", "RESUME_AS_CLOCK")
        
        # Clear OBS_CONNECTED flag
        await redis.delete(f"channel:{ch.id}:OBS_CONNECTED")
        
        await redis.aclose()
        logger.info(f"✓ Sent RESUME_AS_CLOCK command to playout:{ch.id}")
    except Exception as e:
        logger.error(f"✗ Failed to resume playout: {e}")

    # Set state back - playout worker will update to TV_VOD_RUNNING when it starts
    await db.execute(
        update(Channel).where(Channel.id == ch.id).values(state="OFFLINE")
    )
    await db.commit()

    return {"code": 0}
