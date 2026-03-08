from fastapi import APIRouter, Depends
from app.services.srs_manager import srs_manager
from app.redis_client import get_redis
from app.core.deps import get_current_user
import subprocess

router = APIRouter()


@router.get("")
async def health():
    return {"status": "ok"}


@router.get("/srs")
async def health_srs(user=Depends(get_current_user)):
    try:
        data = await srs_manager.health()
        return {"status": "ok", "data": data}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


@router.get("/worker")
async def health_worker(user=Depends(get_current_user)):
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "panel-switch-controller"],
            capture_output=True, text=True,
        )
        status = result.stdout.strip()
        return {"switch_controller": status}
    except Exception as e:
        return {"status": "error", "detail": str(e)}
