import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.routers import auth, tenants, users, channels, assets, schedule, health, hooks, playlists, stats
from app.database import AsyncSessionLocal
from app.models.channel import Channel
from app.services.playout_utils import start_playout_service, is_playout_running

logger = logging.getLogger(__name__)


async def restore_playout_workers():
    """On startup, ensure all TV channels that should be running have their playout worker active."""
    await asyncio.sleep(3)  # Give the API a moment to fully start
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Channel).where(Channel.channel_type == "tv")
            )
            tv_channels = result.scalars().all()

        started = 0
        for ch in tv_channels:
            channel_id = str(ch.id)
            if not is_playout_running(channel_id):
                logger.info(f"Auto-starting playout for TV channel: {ch.name} ({channel_id})")
                start_playout_service(channel_id)
                started += 1

        logger.info(f"Startup: checked {len(tv_channels)} TV channels, started {started} playout workers")
    except Exception as e:
        logger.error(f"Error restoring playout workers: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    asyncio.create_task(restore_playout_workers())
    yield
    # Shutdown (nothing needed)


app = FastAPI(
    title="Streaming Panel API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(tenants.router,   prefix="/api/tenants",   tags=["tenants"])
app.include_router(users.router,     prefix="/api/users",     tags=["users"])
app.include_router(channels.router,  prefix="/api/channels",  tags=["channels"])
app.include_router(assets.router,    prefix="/api/assets",    tags=["assets"])
app.include_router(playlists.router, prefix="/api/playlists", tags=["playlists"])
app.include_router(schedule.router,  prefix="/api/schedule",  tags=["schedule"])
app.include_router(health.router,    prefix="/api/health",    tags=["health"])
app.include_router(hooks.router,     prefix="/api/hooks",     tags=["hooks"])
app.include_router(stats.router,     prefix="/api/stats",     tags=["stats"])


@app.get("/api/ping")
async def ping():
    """Simple liveness check - no auth required."""
    return {"status": "ok", "version": "1.0.0"}
