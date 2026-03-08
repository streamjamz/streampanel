from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    tenant_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: UUID
    email: str
    role: str
    is_active: bool
    tenant_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class TenantCreate(BaseModel):
    name: str
    slug: str


class TenantOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
