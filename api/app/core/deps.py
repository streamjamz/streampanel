from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import decode_token

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Check tenant is not suspended (super_admin bypasses this)
    if user.role != "super_admin" and user.tenant_id:
        tenant = await db.get(Tenant, user.tenant_id)
        if tenant and not tenant.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account suspended. Please contact support."
            )

    return user


def require_role(roles: list[str]):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _check


def require_feature(feature: str):
    """Dependency that checks tenant has access to a specific feature."""
    async def _check(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        if user.role == "super_admin":
            return user
        if user.tenant_id:
            tenant = await db.get(Tenant, user.tenant_id)
            if tenant and not tenant.has_feature(feature):
                raise HTTPException(
                    status_code=403,
                    detail=f"Your plan does not include access to this feature."
                )
        return user
    return _check
