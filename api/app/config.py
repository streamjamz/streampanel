from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SRS_API_URL: str = "http://127.0.0.1:1985"
    SRS_RTMP_HOST: str = "localhost"
    SRS_RTMP_PORT: int = 1935
    PANEL_BASE_URL: str = "https://panel.example.com"
    MEDIA_ROOT: str = "/var/lib/panel/media"
    
    # Streaming Options (CDN support)
    ENABLE_DIRECT_HLS: bool = True
    ENABLE_CDN_HLS: bool = False
    CDN_HLS_URL: Optional[str] = None
    
    class Config:
        env_file = "/etc/panel/panel.env"

settings = Settings()
