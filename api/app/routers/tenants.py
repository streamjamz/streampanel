import uuid
import secrets
import subprocess
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.database import get_db
from app.models.tenant import Tenant, PLANS
from app.models.user import User
from app.models.channel import Channel
from app.core.deps import require_role
from app.core.security import hash_password
from app.services.playout_utils import start_playout_service

router = APIRouter()


class TenantCreate(BaseModel):
    name: str
    slug: str
    plan: str = "live"
    notes: Optional[str] = None
    admin_email: str
    admin_password: str


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    plan: Optional[str] = None
    is_active: Optional[bool] = None
    max_channels: Optional[int] = None
    max_storage_gb: Optional[int] = None
    feature_flags: Optional[dict] = None
    notes: Optional[str] = None


def _tenant_dict(t: Tenant, user_count: int = 0, channel_count: int = 0) -> dict:
    plan_info = PLANS.get(t.plan, {})
    return {
        "id": str(t.id),
        "name": t.name,
        "slug": t.slug,
        "plan": t.plan,
        "plan_label": plan_info.get("label", t.plan),
        "is_active": t.is_active,
        "max_channels": t.max_channels,
        "max_storage_gb": t.max_storage_gb,
        "feature_flags": t.feature_flags or {},
        "features": plan_info.get("features", []),
        "notes": t.notes,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "user_count": user_count,
        "channel_count": channel_count,
    }


async def _create_channels_for_plan(db: AsyncSession, tenant_id: uuid.UUID, plan: str, tenant_name: str) -> list:
    """Auto-create channels based on plan. Returns list of created channel IDs."""
    plan_info = PLANS.get(plan, {})
    features = plan_info.get("features", [])
    created = []

    channels_to_create = []
    if "live_channels" in features:
        channels_to_create.append(("live", f"{tenant_name} Live"))
    if "tv_channels" in features:
        channels_to_create.append(("tv", f"{tenant_name} TV"))

    for ch_type, ch_name in channels_to_create:
        ch = Channel(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name=ch_name,
            slug=f"{ch_type}-{re.sub(r'[^a-z0-9]+', '-', tenant_name.lower()).strip('-')[:20]}",
            channel_type=ch_type,
            stream_key=secrets.token_urlsafe(24),
            state="OFFLINE",
        )
        db.add(ch)
        created.append((str(ch.id), ch_type))

    return created


@router.get("/plans")
async def list_plans(user=Depends(require_role(["super_admin"]))):
    return PLANS


@router.get("")
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    result = await db.execute(select(Tenant).order_by(Tenant.created_at.desc()))
    tenants = result.scalars().all()
    out = []
    for t in tenants:
        uc = await db.scalar(select(func.count(User.id)).where(User.tenant_id == t.id))
        cc = await db.scalar(select(func.count(Channel.id)).where(Channel.tenant_id == t.id))
        out.append(_tenant_dict(t, uc or 0, cc or 0))
    return out


@router.post("")
async def create_tenant(
    body: TenantCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    if body.plan not in PLANS:
        raise HTTPException(400, detail=f"Invalid plan. Choose from: {list(PLANS.keys())}")

    existing = await db.scalar(select(Tenant).where(Tenant.slug == body.slug))
    if existing:
        raise HTTPException(400, detail="Slug already exists")

    plan_info = PLANS[body.plan]
    t = Tenant(
        id=uuid.uuid4(),
        name=body.name,
        slug=body.slug,
        plan=body.plan,
        max_channels=plan_info["max_channels"],
        max_storage_gb=plan_info["max_storage_gb"],
        notes=body.notes,
        is_active=True,
    )
    db.add(t)
    await db.flush()

    # Create admin user
    admin = User(
        id=uuid.uuid4(),
        email=body.admin_email,
        hashed_password=hash_password(body.admin_password),
        role="tenant_admin",
        tenant_id=t.id,
        is_active=True,
    )
    db.add(admin)

    # Auto-create channels based on plan
    created_channels = await _create_channels_for_plan(db, t.id, body.plan, body.name)

    await db.commit()

    # Auto-start playout for any TV channels created
    for channel_id, ch_type in created_channels:
        if ch_type == "tv":
            start_playout_service(channel_id)

    return {"id": str(t.id), "admin_user_id": str(admin.id)}


@router.get("/{tenant_id}")
async def get_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    t = await db.get(Tenant, tenant_id)
    if not t:
        raise HTTPException(404, detail="Tenant not found")
    uc = await db.scalar(select(func.count(User.id)).where(User.tenant_id == t.id))
    cc = await db.scalar(select(func.count(Channel.id)).where(Channel.tenant_id == t.id))
    return _tenant_dict(t, uc or 0, cc or 0)


@router.patch("/{tenant_id}")
async def update_tenant(
    tenant_id: uuid.UUID,
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    t = await db.get(Tenant, tenant_id)
    if not t:
        raise HTTPException(404, detail="Tenant not found")

    if body.plan is not None:
        if body.plan not in PLANS:
            raise HTTPException(400, detail=f"Invalid plan. Choose from: {list(PLANS.keys())}")
        plan_info = PLANS[body.plan]
        t.plan = body.plan
        if body.max_channels is None:
            t.max_channels = plan_info["max_channels"]
        if body.max_storage_gb is None:
            t.max_storage_gb = plan_info["max_storage_gb"]

    if body.name is not None: t.name = body.name
    if body.is_active is not None: t.is_active = body.is_active
    if body.max_channels is not None: t.max_channels = body.max_channels
    if body.max_storage_gb is not None: t.max_storage_gb = body.max_storage_gb
    if body.feature_flags is not None: t.feature_flags = body.feature_flags
    if body.notes is not None: t.notes = body.notes

    await db.commit()
    return _tenant_dict(t)


@router.post("/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    t = await db.get(Tenant, tenant_id)
    if not t:
        raise HTTPException(404)
    t.is_active = False
    await db.commit()
    return {"status": "suspended"}


@router.post("/{tenant_id}/unsuspend")
async def unsuspend_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    t = await db.get(Tenant, tenant_id)
    if not t:
        raise HTTPException(404)
    t.is_active = True
    await db.commit()
    return {"status": "active"}


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["super_admin"])),
):
    t = await db.get(Tenant, tenant_id)
    if not t:
        raise HTTPException(404)
    await db.delete(t)
    await db.commit()
    return {"status": "deleted"}
