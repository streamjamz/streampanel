import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.user import User
from app.core.deps import get_current_user, require_role
from app.core.security import hash_password

router = APIRouter()

VALID_ROLES = {"super_admin", "tenant_admin", "operator", "viewer"}


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    tenant_id: Optional[uuid.UUID] = None


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.get("")
async def list_users(db: AsyncSession = Depends(get_db), user=Depends(require_role(["tenant_admin", "super_admin"]))):
    if user.role == "super_admin":
        result = await db.execute(select(User))
    else:
        result = await db.execute(select(User).where(User.tenant_id == user.tenant_id))
    users = result.scalars().all()
    return [{"id": str(u.id), "email": u.email, "role": u.role, "is_active": u.is_active} for u in users]


@router.post("")
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(400, "Invalid role")
    tenant_id = body.tenant_id if user.role == "super_admin" else user.tenant_id
    u = User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(u)
    await db.commit()
    return {"id": str(u.id)}


@router.put("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404)
    if body.role:
        u.role = body.role
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.password:
        u.hashed_password = hash_password(body.password)
    await db.commit()
    return {"status": "updated"}


@router.delete("/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role(["tenant_admin", "super_admin"])),
):
    u = await db.get(User, user_id)
    if not u:
        raise HTTPException(404)
    await db.delete(u)
    await db.commit()
    return {"status": "deleted"}


@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    from app.models.tenant import Tenant
    tenant = await db.get(Tenant, user.tenant_id)
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "tenant_id": str(user.tenant_id),
        "tenant_slug": tenant.slug if tenant else "",
    }
