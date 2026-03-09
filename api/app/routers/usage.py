import os
import re
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.channel import Channel
from app.models.tenant import Tenant
from app.core.deps import get_current_user

router = APIRouter()

NGINX_LOG = "/var/log/nginx/access.log"
LOG_PATTERN = re.compile(
    r'^(\S+) \S+ \S+ \[([^\]]+)\] "GET /hls/live/(\S+?)(?:-int)?\.m3u8'
)
LOG_TIME_FORMAT = "%d/%b/%Y:%H:%M:%S %z"


def _count_viewers(stream_keys: list[str], window_seconds: int = 30) -> int:
    """Count unique IPs watching any of the given stream keys in the last N seconds."""
    if not stream_keys:
        return 0
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)
    unique_ips: set[str] = set()
    try:
        with open(NGINX_LOG, "r") as f:
            lines = f.readlines()[-5000:]
        for line in reversed(lines):
            m = LOG_PATTERN.match(line)
            if not m:
                continue
            ip, time_str, stream_name = m.group(1), m.group(2), m.group(3)
            try:
                log_time = datetime.strptime(time_str, LOG_TIME_FORMAT)
            except ValueError:
                continue
            if log_time < cutoff:
                break
            for key in stream_keys:
                if stream_name == key or stream_name.startswith(key):
                    unique_ips.add(ip)
                    break
    except Exception:
        pass
    return len(unique_ips)


def _dir_size_mb(path: str) -> float:
    total = 0
    try:
        for dirpath, _, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    except Exception:
        pass
    return round(total / (1024 * 1024), 2)


async def _get_srs_bitrate(stream_keys: list[str]) -> int:
    bitrate_kbps = 0
    try:
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get("http://127.0.0.1:1985/api/v1/streams")
            if r.status_code == 200:
                for s in r.json().get("streams", []):
                    if s.get("name") in stream_keys:
                        bitrate_kbps += s.get("kbps", {}).get("recv_30s", 0)
    except Exception:
        pass
    return bitrate_kbps


@router.get("")
async def get_tenant_usage(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant = await db.get(Tenant, user.tenant_id)
    if not tenant:
        return {}

    result = await db.execute(select(Channel).where(Channel.tenant_id == tenant.id))
    channels = result.scalars().all()
    stream_keys = [ch.stream_key for ch in channels if ch.stream_key]

    disk_mb = _dir_size_mb(f"/var/lib/panel/media/{tenant.id}")
    connections = _count_viewers(stream_keys, window_seconds=120)
    bitrate_kbps = await _get_srs_bitrate(stream_keys)

    return {
        "connections": {"current": connections, "max": 2000},
        "bitrate_kbps": {"current": bitrate_kbps, "max": 3584},
        "disk_mb": {"current": round(disk_mb, 1), "max": (tenant.max_storage_gb or 10) * 1024},
        "plan": tenant.plan,
        "tenant_name": tenant.name,
    }