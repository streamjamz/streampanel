from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
import secrets
from datetime import time

from app.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import User, Contributor, Channel
from pydantic import BaseModel

router = APIRouter(tags=["contributors"])

# Schemas
class ContributorCreate(BaseModel):
    channel_id: uuid.UUID
    name: str
    role: str = "DJ"
    recurring_enabled: bool = False
    recurring_day: int | None = None
    recurring_start_time: str | None = None  # "20:00"
    recurring_duration_minutes: int | None = None

class ContributorUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    recurring_enabled: bool | None = None
    recurring_day: int | None = None
    recurring_start_time: str | None = None
    recurring_duration_minutes: int | None = None

class ContributorResponse(BaseModel):
    id: uuid.UUID
    channel_id: uuid.UUID
    name: str
    stream_key: str
    role: str
    is_active: bool
    recurring_enabled: bool
    recurring_day: int | None
    recurring_start_time: str | None
    recurring_duration_minutes: int | None
    created_at: str
    
    class Config:
        from_attributes = True

# List contributors for a channel
@router.get("/channel/{channel_id}", response_model=List[ContributorResponse])
async def list_contributors(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify channel exists and user has access
    channel_result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = channel_result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if current_user.role != "super_admin" and channel.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get contributors
    result = await db.execute(
        select(Contributor)
        .where(Contributor.channel_id == channel_id)
        .order_by(Contributor.created_at)
    )
    contributors = result.scalars().all()
    
    # Format response
    return [
        ContributorResponse(
            id=c.id,
            channel_id=c.channel_id,
            name=c.name,
            stream_key=c.stream_key,
            role=c.role,
            is_active=c.is_active,
            recurring_enabled=c.recurring_enabled,
            recurring_day=c.recurring_day,
            recurring_start_time=c.recurring_start_time.strftime("%H:%M") if c.recurring_start_time else None,
            recurring_duration_minutes=c.recurring_duration_minutes,
            created_at=c.created_at.isoformat()
        )
        for c in contributors
    ]

# Create contributor
@router.post("/", response_model=ContributorResponse)
async def create_contributor(
    data: ContributorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify channel exists and user has access
    channel_result = await db.execute(select(Channel).where(Channel.id == data.channel_id))
    channel = channel_result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    if current_user.role != "super_admin" and channel.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check contributor limit
    count_result = await db.execute(
        select(func.count(Contributor.id)).where(Contributor.channel_id == data.channel_id)
    )
    current_count = count_result.scalar()
    
    if current_count >= channel.contributor_limit:
        raise HTTPException(
            status_code=403,
            detail=f"Contributor limit reached ({channel.contributor_limit}). Contact support to upgrade."
        )
    
    # Create contributor
    contributor = Contributor(
        channel_id=data.channel_id,
        name=data.name,
        stream_key=secrets.token_urlsafe(32),
        role=data.role,
        recurring_enabled=data.recurring_enabled,
        recurring_day=data.recurring_day,
        recurring_start_time=time.fromisoformat(data.recurring_start_time) if data.recurring_start_time else None,
        recurring_duration_minutes=data.recurring_duration_minutes
    )
    
    db.add(contributor)
    await db.commit()
    await db.refresh(contributor)
    
    return ContributorResponse(
        id=contributor.id,
        channel_id=contributor.channel_id,
        name=contributor.name,
        stream_key=contributor.stream_key,
        role=contributor.role,
        is_active=contributor.is_active,
        recurring_enabled=contributor.recurring_enabled,
        recurring_day=contributor.recurring_day,
        recurring_start_time=contributor.recurring_start_time.strftime("%H:%M") if contributor.recurring_start_time else None,
        recurring_duration_minutes=contributor.recurring_duration_minutes,
        created_at=contributor.created_at.isoformat()
    )

# Update contributor
@router.patch("/{contributor_id}", response_model=ContributorResponse)
async def update_contributor(
    contributor_id: uuid.UUID,
    data: ContributorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Contributor).where(Contributor.id == contributor_id))
    contributor = result.scalar_one_or_none()
    
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    
    # Verify access
    channel_result = await db.execute(select(Channel).where(Channel.id == contributor.channel_id))
    channel = channel_result.scalar_one_or_none()
    
    if current_user.role != "super_admin" and channel.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    if data.name is not None:
        contributor.name = data.name
    if data.role is not None:
        contributor.role = data.role
    if data.is_active is not None:
        contributor.is_active = data.is_active
    if data.recurring_enabled is not None:
        contributor.recurring_enabled = data.recurring_enabled
    if data.recurring_day is not None:
        contributor.recurring_day = data.recurring_day
    if data.recurring_start_time is not None:
        contributor.recurring_start_time = time.fromisoformat(data.recurring_start_time)
    if data.recurring_duration_minutes is not None:
        contributor.recurring_duration_minutes = data.recurring_duration_minutes
    
    await db.commit()
    await db.refresh(contributor)
    
    return ContributorResponse(
        id=contributor.id,
        channel_id=contributor.channel_id,
        name=contributor.name,
        stream_key=contributor.stream_key,
        role=contributor.role,
        is_active=contributor.is_active,
        recurring_enabled=contributor.recurring_enabled,
        recurring_day=contributor.recurring_day,
        recurring_start_time=contributor.recurring_start_time.strftime("%H:%M") if contributor.recurring_start_time else None,
        recurring_duration_minutes=contributor.recurring_duration_minutes,
        created_at=contributor.created_at.isoformat()
    )

# Delete contributor
@router.delete("/{contributor_id}")
async def delete_contributor(
    contributor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Contributor).where(Contributor.id == contributor_id))
    contributor = result.scalar_one_or_none()
    
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    
    # Verify access
    channel_result = await db.execute(select(Channel).where(Channel.id == contributor.channel_id))
    channel = channel_result.scalar_one_or_none()
    
    if current_user.role != "super_admin" and channel.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.delete(contributor)
    await db.commit()
    
    return {"message": "Contributor deleted"}

# Regenerate stream key
@router.post("/{contributor_id}/regenerate-key", response_model=ContributorResponse)
async def regenerate_stream_key(
    contributor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Contributor).where(Contributor.id == contributor_id))
    contributor = result.scalar_one_or_none()
    
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    
    # Verify access
    channel_result = await db.execute(select(Channel).where(Channel.id == contributor.channel_id))
    channel = channel_result.scalar_one_or_none()
    
    if current_user.role != "super_admin" and channel.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    contributor.stream_key = secrets.token_urlsafe(32)
    await db.commit()
    await db.refresh(contributor)
    
    return ContributorResponse(
        id=contributor.id,
        channel_id=contributor.channel_id,
        name=contributor.name,
        stream_key=contributor.stream_key,
        role=contributor.role,
        is_active=contributor.is_active,
        recurring_enabled=contributor.recurring_enabled,
        recurring_day=contributor.recurring_day,
        recurring_start_time=contributor.recurring_start_time.strftime("%H:%M") if contributor.recurring_start_time else None,
        recurring_duration_minutes=contributor.recurring_duration_minutes,
        created_at=contributor.created_at.isoformat()
    )
