from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.system_setting import SystemSetting
from app.core.deps import require_role

router = APIRouter()

class SettingUpdate(BaseModel):
    value: str

@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"]))
):
    """Get all system settings (super admin only)"""
    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    
    return {
        s.key: {
            "value": s.value or "",
            "description": s.description
        } for s in settings
    }

@router.put("/{key}")
async def update_setting(
    key: str,
    body: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"]))
):
    """Update a system setting (super admin only)"""
    setting = await db.get(SystemSetting, key)
    
    if not setting:
        raise HTTPException(404, detail="Setting not found")
    
    setting.value = body.value
    await db.commit()
    
    return {"status": "updated", "key": key, "value": body.value}
