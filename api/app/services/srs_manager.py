import httpx
from app.config import settings

class SRSManager:
    def __init__(self):
        self.base = settings.SRS_API_URL
    
    async def health(self) -> dict:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{self.base}/api/v1/summaries", timeout=3)
            return r.json()
    
    async def get_streams(self) -> list[dict]:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{self.base}/api/v1/streams/", timeout=3)
            return r.json().get("streams", [])
    
    async def get_clients(self) -> list[dict]:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"{self.base}/api/v1/clients/", timeout=3)
            return r.json().get("clients", [])
    
    async def kick_client(self, client_id: str):
        async with httpx.AsyncClient() as c:
            await c.delete(f"{self.base}/api/v1/clients/{client_id}", timeout=3)
    
    def rtmp_publish_url(self, stream_key: str) -> str:
        return f"rtmp://{settings.SRS_RTMP_HOST}:{settings.SRS_RTMP_PORT}/live/{stream_key}"
    
    def webrtc_play_url(self, stream_key: str) -> str:
        return f"{settings.PANEL_BASE_URL}/rtc/v1/whep/?app=live&stream={stream_key}"
    
    def hls_play_url(self, stream_key: str, channel_type: str = "tv") -> str:
        """Generate HLS playback URL based on channel type"""
        if channel_type == "live":
            return f"{settings.PANEL_BASE_URL}/hls/live/{stream_key}.m3u8"
        else:
            return f"{settings.PANEL_BASE_URL}/hls/live/{stream_key}-int.m3u8"

srs_manager = SRSManager()
