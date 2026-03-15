from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, tenants, users, channels, assets, schedule, health, hooks, playlists, stats, stream_targets, api_keys, v1, system_settings, usage, contributors
from app.models.stream_target import StreamTarget  # noqa: F401 - registers model with SQLAlchemy
from app.models.api_key import ApiKey  # noqa: F401 - registers model with SQLAlchemy

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Restore playout workers on startup
    try:
        import subprocess
        from app.database import AsyncSessionLocal
        from app.models.channel import Channel
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Channel).where(Channel.channel_type == 'tv'))
            channels_list = result.scalars().all()
        for ch in channels_list:
            r = subprocess.run(['systemctl', 'is-active', f'panel-playout@{ch.id}.service'], capture_output=True, text=True)
            if r.stdout.strip() != 'active':
                subprocess.run(['sudo', 'systemctl', 'start', f'panel-playout@{ch.id}.service'], capture_output=True)
    except Exception as e:
        print(f"Warning: Could not restore playout workers: {e}")
    yield

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
app.include_router(auth.router,           prefix="/api/auth",      tags=["auth"])
app.include_router(tenants.router,        prefix="/api/tenants",   tags=["tenants"])
app.include_router(users.router,          prefix="/api/users",     tags=["users"])
app.include_router(channels.router,       prefix="/api/channels",  tags=["channels"])
app.include_router(assets.router,         prefix="/api/assets",    tags=["assets"])
app.include_router(playlists.router,      prefix="/api/playlists", tags=["playlists"])
app.include_router(schedule.router,       prefix="/api/schedule",  tags=["schedule"])
app.include_router(health.router,         prefix="/api/health",    tags=["health"])
app.include_router(hooks.router,          prefix="/api/hooks",     tags=["hooks"])
app.include_router(stats.router,          prefix="/api/stats",     tags=["stats"])
app.include_router(stream_targets.router, prefix="/api/targets",   tags=["targets"])
app.include_router(api_keys.router,       prefix="/api/keys",      tags=["api-keys"])
app.include_router(v1.router,             prefix="/api/v1",        tags=["v1"])
app.include_router(system_settings.router, prefix="/api/system-settings", tags=["system-settings"])
app.include_router(usage.router, prefix="/api/usage", tags=["usage"])
app.include_router(contributors.router, prefix="/api/contributors", tags=["contributors"])
app.include_router(usage.router, prefix="/api/usage", tags=["usage"])
app.include_router(contributors.router, prefix="/api/contributors", tags=["contributors"])
# # app.include_router(settings.router,       prefix="/api/settings", tags=["settings"])

@app.get("/api/ping")
async def ping():
    return {"status": "ok", "version": "1.0.0"}
