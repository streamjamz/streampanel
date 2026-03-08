import hashlib
from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
from app.database import get_db
from app.models.api_key import ApiKey
from app.models.tenant import Tenant

def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

async def get_api_key_tenant(
    x_api_key: str = Header(..., description="Your API key"),
    db: AsyncSession = Depends(get_db),
):
    h = _hash_key(x_api_key)
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == h, ApiKey.is_active == True))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    await db.execute(update(ApiKey).where(ApiKey.id == key.id).values(last_used_at=datetime.now(timezone.utc)))
    await db.commit()
    t = await db.get(Tenant, key.tenant_id)
    if not t:
        raise HTTPException(status_code=401, detail="Tenant not found")
    return t
