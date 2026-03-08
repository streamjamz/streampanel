import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import aiofiles

from app.database import get_db
from app.models.asset import Asset
from app.core.deps import get_current_user, require_role
from app.services.asset_service import process_asset_by_id
from app.config import settings

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".ts", ".mxf", ".wmv", ".flv", ".webm", ".m4v"}
MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024  # 10 GB


def _asset_dict(a: Asset) -> dict:
    return {
        "id": str(a.id),
        "original_name": a.original_name,
        "duration_secs": float(a.duration_secs) if a.duration_secs else None,
        "status": a.status,
        "width": a.width,
        "height": a.height,
        "video_codec": a.video_codec,
        "audio_codec": a.audio_codec,
        "audio_channels": getattr(a, "audio_channels", None),
        "file_size": a.file_size,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "genres": a.genres or [],
    }


@router.post("/upload")
async def upload_asset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, detail=f"File type '{suffix}' not allowed.")

    asset_id = uuid.uuid4()
    dest_dir = Path(settings.MEDIA_ROOT) / str(user.tenant_id) / str(asset_id)
    dest_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename).name.replace("..", "").replace("/", "").replace("\\", "")
    file_path = dest_dir / safe_name

    total_size = 0
    async with aiofiles.open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                file_path.unlink(missing_ok=True)
                raise HTTPException(413, detail="File too large (max 10GB)")
            await f.write(chunk)

    asset = Asset(
        id=asset_id,
        tenant_id=user.tenant_id,
        filename=str(asset_id) + "_" + safe_name,
        original_name=safe_name,
        file_path=str(file_path),
        file_size=total_size,
        status="processing",
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    background_tasks.add_task(process_asset_by_id, str(asset.id), str(asset.file_path))
    return {"id": str(asset_id), "status": "processing", "filename": safe_name}


@router.get("")
async def list_assets(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    result = await db.execute(select(Asset).where(Asset.tenant_id == user.tenant_id))
    return [_asset_dict(a) for a in result.scalars().all()]


@router.get("/{asset_id}")
async def get_asset(asset_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    asset = await db.get(Asset, asset_id)
    if not asset or asset.tenant_id != user.tenant_id:
        raise HTTPException(404, detail="Asset not found")
    return _asset_dict(asset)


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    asset = await db.get(Asset, asset_id)
    if not asset or asset.tenant_id != user.tenant_id:
        raise HTTPException(404, detail="Asset not found")
    file_dir = Path(asset.file_path).parent
    if file_dir.exists():
        shutil.rmtree(file_dir, ignore_errors=True)
    await db.delete(asset)
    await db.commit()
    return {"status": "deleted"}
@router.patch("/{asset_id}/genres")
async def update_asset_genres(
    asset_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["operator", "tenant_admin", "super_admin"])),
):
    asset = await db.get(Asset, asset_id)
    if not asset or asset.tenant_id != user.tenant_id:
        raise HTTPException(404, detail="Asset not found")
    asset.genres = body.get("genres", [])
    await db.commit()
    await db.refresh(asset)
    return _asset_dict(asset)
