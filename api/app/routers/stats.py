import psutil
from fastapi import APIRouter, Depends
from app.core.deps import get_current_user

router = APIRouter()

@router.get("")
async def get_system_stats(user=Depends(get_current_user)):
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    freq = psutil.cpu_freq()
    disks = []
    for p in psutil.disk_partitions():
        try:
            u = psutil.disk_usage(p.mountpoint)
            disks.append({"mountpoint": p.mountpoint, "device": p.device, "total": u.total, "used": u.used, "free": u.free, "percent": u.percent})
        except: pass
    net = psutil.net_io_counters()
    streams = []
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as c:
            r = await c.get("http://127.0.0.1:1985/api/v1/streams")
            if r.status_code == 200:
                for s in r.json().get("streams", []):
                    streams.append({"name": s.get("name"), "clients": s.get("clients", 0), "publish": s.get("publish", {}).get("active", False), "kbps_recv": s.get("kbps", {}).get("recv_30s", 0), "kbps_send": s.get("kbps", {}).get("send_30s", 0)})
    except: pass
    return {
        "cpu": {"percent": cpu, "count": psutil.cpu_count(), "freq_mhz": round(freq.current, 0) if freq else None},
        "memory": {"total": mem.total, "used": mem.used, "available": mem.available, "percent": mem.percent},
        "disks": disks,
        "network": {"bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv},
        "streams": streams,
    }
