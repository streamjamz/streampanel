import uuid
import logging
import httpx
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.database import get_db
from app.models.contributor import Contributor
from app.models.channel import Channel
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


class ContributorCreate(BaseModel):
    channel_id: uuid.UUID
    name: str
    role: str = "DJ"
    recurring_schedule: str | None = None


class ContributorUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    recurring_schedule: str | None = None


@router.get("/channel/{channel_id}")
async def list_contributors(
    channel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """List all contributors for a channel."""
    # Verify channel access
    ch = await db.get(Channel, channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404, "Channel not found")
    
    result = await db.execute(
        select(Contributor)
        .where(Contributor.channel_id == channel_id)
        .order_by(Contributor.created_at)
    )
    contributors = result.scalars().all()
    
    return [
        {
            "id": str(c.id),
            "channel_id": str(c.channel_id),
            "name": c.name,
            "stream_key": c.stream_key,
            "role": c.role,
            "is_active": c.is_active,
            "recurring_schedule": c.recurring_schedule,
            "created_at": c.created_at.isoformat(),
        }
        for c in contributors
    ]


@router.post("")
async def create_contributor(
    body: ContributorCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a new contributor for a channel."""
    # Verify channel access
    ch = await db.get(Channel, body.channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(404, "Channel not found")
    
    # Check contributor limit (default 3, can be customized per channel later)
    count_result = await db.execute(
        select(func.count(Contributor.id)).where(Contributor.channel_id == body.channel_id)
    )
    current_count = count_result.scalar()
    max_contributors = ch.max_contributors  # Default limit
    
    if current_count >= max_contributors:
        raise HTTPException(
            400,
            f"Contributor limit reached ({current_count}/{max_contributors}). Contact support to upgrade."
        )
    
    # Generate unique stream key
    stream_key = secrets.token_urlsafe(24)
    
    contributor = Contributor(
        id=uuid.uuid4(),
        channel_id=body.channel_id,
        name=body.name,
        stream_key=stream_key,
        role=body.role,
        recurring_schedule=body.recurring_schedule,
    )
    db.add(contributor)
    await db.commit()
    await db.refresh(contributor)
    
    return {
        "id": str(contributor.id),
        "channel_id": str(contributor.channel_id),
        "name": contributor.name,
        "stream_key": contributor.stream_key,
        "role": contributor.role,
        "is_active": contributor.is_active,
        "recurring_schedule": contributor.recurring_schedule,
    }


@router.patch("/{contributor_id}")
async def update_contributor(
    contributor_id: uuid.UUID,
    body: ContributorUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Update a contributor."""
    contributor = await db.get(Contributor, contributor_id)
    if not contributor:
        raise HTTPException(404, "Contributor not found")
    
    # Verify channel access
    ch = await db.get(Channel, contributor.channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(403, "Access denied")
    
    if body.name is not None:
        contributor.name = body.name
    if body.role is not None:
        contributor.role = body.role
    if body.is_active is not None:
        contributor.is_active = body.is_active
    if body.recurring_schedule is not None:
        contributor.recurring_schedule = body.recurring_schedule
    
    await db.commit()
    await db.refresh(contributor)
    
    return {
        "id": str(contributor.id),
        "name": contributor.name,
        "role": contributor.role,
        "is_active": contributor.is_active,
        "recurring_schedule": contributor.recurring_schedule,
    }


@router.delete("/{contributor_id}")
async def delete_contributor(
    contributor_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """Delete a contributor."""
    contributor = await db.get(Contributor, contributor_id)
    if not contributor:
        raise HTTPException(404, "Contributor not found")
    
    # Verify channel access
    ch = await db.get(Channel, contributor.channel_id)
    if not ch or (ch.tenant_id != user.tenant_id and user.role != "super_admin"):
        raise HTTPException(403, "Access denied")
    
    await db.delete(contributor)
    await db.commit()
    
    return {"status": "deleted"}

@router.get("/channel/{channel_id}/status")
async def get_contributors_status(
    channel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get live status for all contributors of a channel."""
    # Get all contributors for this channel
    result = await db.execute(
        select(Contributor)
        .where(Contributor.channel_id == channel_id)
        .order_by(Contributor.created_at.desc())
    )
    contributors = result.scalars().all()
    
    # Check SRS for active streams
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("http://127.0.0.1:1985/api/v1/streams/", timeout=2.0)
            srs_data = resp.json()
            active_keys = set()
            for stream in srs_data.get("streams", []):
                if stream.get("publish", {}).get("active"):
                    active_keys.add(stream.get("name"))
    except Exception as e:
        logger.error(f"Failed to check SRS streams: {e}")
        active_keys = set()
    
    # Build response with live status
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "role": c.role,
            "stream_key": c.stream_key,
            "is_active": c.is_active,
            "is_live": c.stream_key in active_keys,
            "created_at": c.created_at.isoformat()
        }
        for c in contributors
    ]
