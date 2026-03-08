import uuid
from datetime import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.database import get_db
from app.models.schedule import ScheduleBlock
from app.models.channel import Channel
from app.models.playlist import Playlist
from app.core.deps import get_current_user, require_role
from app.services.schedule_service import get_current_block

router = APIRouter()


async def _load_block(db: AsyncSession, block_id) -> ScheduleBlock:
    result = await db.execute(
        select(ScheduleBlock)
        .options(selectinload(ScheduleBlock.asset), selectinload(ScheduleBlock.playlist))
        .where(ScheduleBlock.id == block_id)
    )
    return result.scalar_one()


def _block_dict(block: ScheduleBlock) -> dict:
    duration = float(block.duration_secs) if block.duration_secs else None
    return {
        "id": str(block.id),
        "channel_id": str(block.channel_id),
        "asset_id": str(block.asset_id) if block.asset_id else None,
        "playlist_id": str(block.playlist_id) if block.playlist_id else None,
        "block_type": block.block_type,
        "start_time": block.start_time.strftime("%H:%M:%S") if block.start_time else None,
        "duration_secs": duration,
        "day_mask": block.day_mask,
        "priority": block.priority,
        "notes": block.notes,
        "asset_name": block.asset.original_name if block.asset else None,
        "playlist_name": block.playlist.name if block.playlist else None,
    }


class BlockCreate(BaseModel):
    channel_id: uuid.UUID
    asset_id: Optional[uuid.UUID] = None
    playlist_id: Optional[uuid.UUID] = None
    block_type: str = "asset"
    start_time: str
    duration_secs: Optional[float] = None
    day_mask: int = 127
    priority: int = 0
    notes: Optional[str] = None


@router.get("/channel/{channel_id}")
async def list_blocks(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(ScheduleBlock)
        .options(selectinload(ScheduleBlock.asset), selectinload(ScheduleBlock.playlist))
        .where(ScheduleBlock.channel_id == channel_id)
        .order_by(ScheduleBlock.start_time)
    )
    blocks = result.scalars().unique().all()
    return [_block_dict(b) for b in blocks]


@router.post("/channel/{channel_id}")
async def create_block(
    channel_id: uuid.UUID,
    body: BlockCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    h, m, s = map(int, body.start_time.split(":"))

    duration = body.duration_secs
    if body.block_type == "playlist" and body.playlist_id and not duration:
        result = await db.execute(
            select(Playlist)
            .options(selectinload(Playlist.items).selectinload(__import__('app.models.playlist', fromlist=['PlaylistItem']).PlaylistItem.asset))
            .where(Playlist.id == body.playlist_id)
        )
        pl = result.scalar_one_or_none()
        if pl and pl.items:
            duration = sum(
                float(i.asset.duration_secs) for i in pl.items
                if i.asset and i.asset.duration_secs
            )

    if body.block_type == "asset" and body.asset_id and not duration:
        from app.models.asset import Asset
        asset = await db.get(Asset, body.asset_id)
        if asset and asset.duration_secs:
            duration = float(asset.duration_secs)

    block = ScheduleBlock(
        id=uuid.uuid4(),
        channel_id=channel_id,
        asset_id=body.asset_id,
        playlist_id=body.playlist_id,
        block_type=body.block_type,
        start_time=time(h, m, s),
        duration_secs=duration,
        day_mask=body.day_mask,
        priority=body.priority,
        notes=body.notes,
    )
    db.add(block)
    await db.commit()
    return _block_dict(await _load_block(db, block.id))


@router.put("/block/{block_id}")
async def update_block(
    block_id: uuid.UUID,
    body: BlockCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    block = await db.get(ScheduleBlock, block_id)
    if not block:
        raise HTTPException(404)
    for field, value in body.model_dump(exclude_none=True).items():
        if field == "start_time":
            h, m, s = map(int, value.split(":"))
            block.start_time = time(h, m, s)
        else:
            setattr(block, field, value)
    await db.commit()
    return _block_dict(await _load_block(db, block_id))


@router.delete("/block/{block_id}")
async def delete_block(
    block_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    block = await db.get(ScheduleBlock, block_id)
    if not block:
        raise HTTPException(404)
    await db.delete(block)
    await db.commit()
    return {"status": "deleted"}


@router.get("/channel/{channel_id}/now")
async def schedule_now(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    block, offset = await get_current_block(db, str(channel_id))
    if not block:
        return {"block": None, "offset_secs": 0, "message": "Nothing scheduled (filler)"}
    return {
        "block_id": str(block.id),
        "asset_id": str(block.asset_id) if block.asset_id else None,
        "playlist_id": str(block.playlist_id) if block.playlist_id else None,
        "block_type": block.block_type,
        "offset_secs": offset,
    }


@router.post("/channel/{channel_id}/validate")
async def validate_schedule(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(ScheduleBlock)
        .where(ScheduleBlock.channel_id == channel_id)
        .order_by(ScheduleBlock.start_time)
    )
    blocks = result.scalars().all()
    issues = []
    for i in range(len(blocks) - 1):
        a, b = blocks[i], blocks[i + 1]
        if a.duration_secs:
            a_end = a.start_time.hour * 3600 + a.start_time.minute * 60 + a.start_time.second + float(a.duration_secs)
            b_start = b.start_time.hour * 3600 + b.start_time.minute * 60 + b.start_time.second
            if a_end > b_start:
                issues.append(f"Overlap between block {a.id} and {b.id}")
    return {"valid": len(issues) == 0, "issues": issues}
