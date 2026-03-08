import uuid, secrets, hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db
from app.models.api_key import ApiKey
from app.core.deps import get_current_user

router = APIRouter()

def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

class KeyCreate(BaseModel):
    name: str

@router.post("", summary="Create API key")
async def create_key(body: KeyCreate, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("super_admin", "tenant_admin"):
        raise HTTPException(403, "Insufficient permissions")
    raw = "sp_" + secrets.token_urlsafe(32)
    key = ApiKey(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id,
        created_by=user.id,
        name=body.name,
        key_hash=_hash(raw),
        key_prefix=raw[:10],
    )
    db.add(key)
    await db.commit()
    return {
        "id": str(key.id),
        "name": key.name,
        "key": raw,
        "prefix": key.key_prefix,
        "created_at": key.created_at,
        "warning": "Save this key — it will not be shown again.",
    }

@router.get("", summary="List API keys")
async def list_keys(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("super_admin", "tenant_admin"):
        raise HTTPException(403, "Insufficient permissions")
    result = await db.execute(select(ApiKey).where(ApiKey.tenant_id == user.tenant_id).order_by(ApiKey.created_at.desc()))
    keys = result.scalars().all()
    return [{"id": str(k.id), "name": k.name, "prefix": k.key_prefix, "is_active": k.is_active, "created_at": k.created_at, "last_used_at": k.last_used_at} for k in keys]

@router.delete("/{key_id}", summary="Revoke API key")
async def revoke_key(key_id: uuid.UUID, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    if user.role not in ("super_admin", "tenant_admin"):
        raise HTTPException(403, "Insufficient permissions")
    key = await db.get(ApiKey, key_id)
    if not key or key.tenant_id != user.tenant_id:
        raise HTTPException(404, "Key not found")
    key.is_active = False
    await db.commit()
    return {"revoked": True}
