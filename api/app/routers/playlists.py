import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.database import get_db
from app.models.playlist import Playlist, PlaylistItem
from app.models.asset import Asset
from app.core.deps import get_current_user, require_role

router = APIRouter()


def _item_dict(item: PlaylistItem) -> dict:
    return {
        "id": str(item.id),
        "asset_id": str(item.asset_id),
        "position": item.position,
        "asset_name": item.asset.original_name if item.asset else None,
        "duration_secs": float(item.asset.duration_secs) if item.asset and item.asset.duration_secs else None,
    }

def _playlist_dict(p: Playlist, include_items=True) -> dict:
    items = p.items or []
    d = {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "shuffle": p.shuffle,
        "genres": p.genres or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "item_count": len(items),
        "total_duration_secs": sum(
            float(i.asset.duration_secs) for i in items
            if i.asset and i.asset.duration_secs
        ),
    }
    if include_items:
        d["items"] = [_item_dict(i) for i in items]
    return d


def _playlist_query(include_items=True):
    q = select(Playlist)
    if include_items:
        q = q.options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
    return q


class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    shuffle: bool = False
    genres: Optional[list] = []


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    shuffle: Optional[bool] = None
    genres: Optional[list] = None


class ItemAdd(BaseModel):
    asset_id: uuid.UUID
    position: Optional[int] = None


class ItemsReorder(BaseModel):
    item_ids: List[uuid.UUID]


@router.get("")
async def list_playlists(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        _playlist_query(include_items=False)
        .where(Playlist.tenant_id == user.tenant_id)
        .order_by(Playlist.created_at.desc())
    )
    playlists = result.scalars().unique().all()
    # Get item counts separately
    out = []
    for p in playlists:
        result2 = await db.execute(
            select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
            .where(Playlist.id == p.id)
        )
        p2 = result2.scalar_one()
        out.append(_playlist_dict(p2, include_items=False))
    return out


@router.post("")
async def create_playlist(
    body: PlaylistCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    p = Playlist(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id,
        name=body.name,
        description=body.description,
        shuffle=body.shuffle,
        genres=body.genres,
    )
    db.add(p)
    await db.commit()
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == p.id)
    )
    p = result.scalar_one()
    return _playlist_dict(p)


@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id, Playlist.tenant_id == user.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Playlist not found")
    return _playlist_dict(p)


@router.patch("/{playlist_id}")
async def update_playlist(
    playlist_id: uuid.UUID,
    body: PlaylistUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id, Playlist.tenant_id == user.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Playlist not found")
    if body.name is not None: p.name = body.name
    if body.description is not None: p.description = body.description
    if body.shuffle is not None: p.shuffle = body.shuffle
    if body.genres is not None: p.genres = body.genres
    await db.commit()
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id)
    )
    return _playlist_dict(result.scalar_one())


@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    result = await db.execute(
        select(Playlist).where(Playlist.id == playlist_id, Playlist.tenant_id == user.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Playlist not found")
    await db.delete(p)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{playlist_id}/items")
async def add_item(
    playlist_id: uuid.UUID,
    body: ItemAdd,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id, Playlist.tenant_id == user.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, detail="Playlist not found")

    asset = await db.get(Asset, body.asset_id)
    if not asset or asset.tenant_id != user.tenant_id:
        raise HTTPException(404, detail="Asset not found")
    if asset.status != "ready":
        raise HTTPException(400, detail="Asset is not ready")

    position = body.position if body.position is not None else len(p.items)
    item = PlaylistItem(id=uuid.uuid4(), playlist_id=playlist_id, asset_id=body.asset_id, position=position)
    db.add(item)
    await db.commit()

    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id)
    )
    return _playlist_dict(result.scalar_one())


@router.delete("/{playlist_id}/items/{item_id}")
async def remove_item(
    playlist_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id, Playlist.tenant_id == user.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404)
    item = await db.get(PlaylistItem, item_id)
    if not item or item.playlist_id != playlist_id:
        raise HTTPException(404)
    await db.delete(item)
    remaining = [i for i in p.items if i.id != item_id]
    for idx, i in enumerate(sorted(remaining, key=lambda x: x.position)):
        i.position = idx
    await db.commit()
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id)
    )
    return _playlist_dict(result.scalar_one())


@router.put("/{playlist_id}/items/reorder")
async def reorder_items(
    playlist_id: uuid.UUID,
    body: ItemsReorder,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id, Playlist.tenant_id == user.tenant_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404)
    item_map = {i.id: i for i in p.items}
    for pos, iid in enumerate(body.item_ids):
        if iid in item_map:
            item_map[iid].position = pos
    await db.commit()
    result = await db.execute(
        select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset))
        .where(Playlist.id == playlist_id)
    )
    return _playlist_dict(result.scalar_one())
