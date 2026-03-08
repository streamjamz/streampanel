from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.services.settings_service import settings_service

router = APIRouter()

class SettingUpdate(BaseModel):
    value: str
    value_type: str = "string"

@router.get("")
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"]))
):
    """Get all system settings (super admin only)"""
    return await settings_service.get_all(db)

@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"]))
):
    """Get a specific setting (super admin only)"""
    value = await settings_service.get(db, key)
    if value is None:
        raise HTTPException(404, detail="Setting not found")
    return {"key": key, "value": value}

@router.put("/{key}")
async def update_setting(
    key: str,
    body: SettingUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"]))
):
    """Update a setting (super admin only)"""
    await settings_service.set(db, key, body.value, body.value_type)
    
    # Clear cache after update
    settings_service.clear_cache()
    
    return {"status": "updated", "key": key, "value": body.value}

@router.post("/clear-cache")
async def clear_settings_cache(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"]))
):
    """Clear settings cache and reload from database"""
    settings_service.clear_cache()
    return {"status": "cache cleared"}
