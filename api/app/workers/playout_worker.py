import asyncio
import logging
import random
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import redis.asyncio as aioredis
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.asset import Asset
from app.models.channel import Channel
from app.models.stream_target import StreamTarget  # noqa: F401
from app.models.playlist import Playlist, PlaylistItem
from app.models.playout_cursor import PlayoutCursor
from app.models.schedule import ScheduleBlock
from app.services.schedule_service import get_current_block

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("playout_worker")

if len(sys.argv) < 2:
    print("Usage: python -m app.workers.playout_worker <channel_id>")
    sys.exit(1)

CHANNEL_ID = sys.argv[1]
SRS_RTMP = f"rtmp://127.0.0.1:1935/live/{CHANNEL_ID}"

try:
    import psycopg2, os
    _db_url = os.environ.get("DATABASE_URL", "")
    if _db_url:
        _conn = psycopg2.connect(_db_url)
        _cur = _conn.cursor()
        _cur.execute("SELECT stream_key FROM channels WHERE id=%s", (CHANNEL_ID,))
        _row = _cur.fetchone()
        if _row and _row[0]:
            SRS_RTMP = f"rtmp://127.0.0.1:1935/live/{_row[0]}-int"
        _conn.close()
except Exception:
    pass

LOGO_POSITIONS = {
    "top-left":     "x=10:y=10",
    "top-right":    "x=W-w-10:y=10",
    "bottom-left":  "x=10:y=H-h-10",
    "bottom-right": "x=W-w-10:y=H-h-10",
    "center":       "x=(W-w)/2:y=(H-h)/2",
}

def build_ffmpeg_cmd_external(source_url: str, logo_path: str | None, logo_pos: str) -> list[str]:
    """FFmpeg command for pulling an external RTMP or HLS source."""
    overlay_expr = LOGO_POSITIONS.get(logo_pos, "x=W-w-10:y=10")
    use_logo = logo_path and Path(logo_path).exists()
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning",
        "-re", "-i", source_url,
    ]
    if use_logo:
        cmd += ["-i", logo_path,
                "-filter_complex", f"[0:v]scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[scaled];[scaled][1:v]overlay={overlay_expr}"]
    else:
        cmd += ["-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", "4000k", "-maxrate", "4500k", "-bufsize", "8000k",
        "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-f", "flv", SRS_RTMP,
    ]
    return cmd


def build_ffmpeg_cmd(asset_path: str, start_offset: float,
                     logo_path: str | None, logo_pos: str) -> list[str]:
    overlay_expr = LOGO_POSITIONS.get(logo_pos, "x=W-w-10:y=10")
    use_logo = logo_path and Path(logo_path).exists()
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning",
        "-re", "-ss", str(start_offset), "-i", asset_path,
    ]
    if use_logo:
        cmd += ["-i", logo_path,
                "-filter_complex", f"[0:v]scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[scaled];[scaled][1:v]overlay={overlay_expr}"]
    else:
        cmd += ["-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"]
    cmd += [
        "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", "4000k", "-maxrate", "4500k", "-bufsize", "8000k",
        "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-f", "flv", SRS_RTMP,
    ]
    return cmd

async def get_playlist_assets(playlist_id) -> list:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Playlist).options(selectinload(Playlist.items).selectinload(PlaylistItem.asset)).where(Playlist.id == playlist_id)
        )
        playlist = result.scalar_one_or_none()
        if not playlist:
            return []
        items = sorted(playlist.items, key=lambda x: x.position)
        assets = []
        for item in items:
            asset = await db.get(Asset, item.asset_id)
            if asset and asset.status == "ready":
                assets.append(asset)
        if playlist.shuffle:
            random.shuffle(assets)
        return assets


class PlayoutWorker:
    def __init__(self):
        self.paused = False
        self.idle = False
        self.current_proc: subprocess.Popen | None = None
        self.resume_cmd: str | None = None
        self._proc_start_ts: float = 0.0
        self._current_offset: float = 0.0
        self._playlist_queue: list = []
        self._playlist_block_id = None
        self._current_block_type: str = 'asset'
        self._current_block_id: str | None = None

    def kill_ffmpeg(self):
        if self.current_proc and self.current_proc.poll() is None:
            self.current_proc.terminate()
            try:
                self.current_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.current_proc.kill()
        self.current_proc = None

    async def _save_cursor(self, block_id, position_secs: float):
        async with AsyncSessionLocal() as db:
            # Verify block exists before saving to avoid FK violation
            if block_id is not None:
                from app.models.schedule import ScheduleBlock
                block_exists = await db.scalar(select(ScheduleBlock).where(ScheduleBlock.id == block_id))
                if not block_exists:
                    block_id = None
            result = await db.execute(select(PlayoutCursor).where(PlayoutCursor.channel_id == CHANNEL_ID))
            cursor = result.scalar_one_or_none()
            if cursor:
                cursor.current_block_id = block_id
                cursor.position_secs = position_secs
                cursor.updated_at = datetime.now(timezone.utc)
            else:
                db.add(PlayoutCursor(channel_id=CHANNEL_ID, current_block_id=block_id, position_secs=position_secs))
            await db.commit()

    async def _get_cursor(self) -> tuple:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(PlayoutCursor).where(PlayoutCursor.channel_id == CHANNEL_ID))
            c = result.scalar_one_or_none()
            if c:
                return c.current_block_id, float(c.position_secs)
        return None, 0.0

    async def _get_channel(self):
        global SRS_RTMP
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Channel).where(Channel.id == CHANNEL_ID))
            ch = result.scalar_one_or_none()
            if ch and ch.stream_key:
                SRS_RTMP = f"rtmp://127.0.0.1:1935/live/{ch.stream_key}-int"
            return ch

    async def _set_idle(self):
        self.kill_ffmpeg()
        self.idle = True
        logger.info(f"[{CHANNEL_ID}] No content -- going READY")
        async with AsyncSessionLocal() as db:
            await db.execute(update(Channel).where(Channel.id == CHANNEL_ID).values(state="READY"))
            await db.commit()

    async def play_asset(self, asset, offset: float, block_id=None):
        ch = await self._get_channel()
        logo = ch.logo_path if ch else None
        pos = (ch.logo_position or "top-right") if ch else "top-right"
        cmd = build_ffmpeg_cmd(asset.file_path, offset, logo, pos)
        logger.info(f"[{CHANNEL_ID}] Playing: {asset.original_name} offset={offset:.1f}s")
        self._proc_start_ts = datetime.now(timezone.utc).timestamp()
        self._current_offset = offset
        self._current_block_type = 'asset'
        self._current_block_id = str(block_id) if block_id else None
        self.idle = False
        async with AsyncSessionLocal() as db:
            await db.execute(update(Channel).where(Channel.id == CHANNEL_ID).values(state="TV_VOD_RUNNING"))
            await db.commit()
        self.current_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if block_id:
            await self._save_cursor(block_id, offset)

    async def play_block(self, block, offset: float) -> bool:
        if not block or block.block_type == "filler_loop":
            return False
        if block.block_type in ("rtmp", "hls") and block.source_url:
            ch = await self._get_channel()
            logo = ch.logo_path if ch else None
            pos = (ch.logo_position or "top-right") if ch else "top-right"
            cmd = build_ffmpeg_cmd_external(block.source_url, logo, pos)
            logger.info(f"[{CHANNEL_ID}] Playing external {block.block_type}: {block.source_url}")
            self._proc_start_ts = datetime.now(timezone.utc).timestamp()
            self._current_offset = 0
            self._current_block_type = block.block_type
            self._current_block_id = str(block.id)
            self.idle = False
            async with AsyncSessionLocal() as db:
                await db.execute(update(Channel).where(Channel.id == CHANNEL_ID).values(state="TV_VOD_RUNNING"))
                await db.commit()
            self.current_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            await self._save_cursor(block.id, 0)
            return True
        if block.block_type == "playlist" and block.playlist_id:
            assets = await get_playlist_assets(block.playlist_id)
            if not assets:
                return False
            # Find which asset should be playing at the given offset
            remaining = offset
            start_index = 0
            asset_offset = 0.0
            for i, a in enumerate(assets):
                dur = float(a.duration_secs) if a.duration_secs else 0.0
                if remaining < dur:
                    start_index = i
                    asset_offset = remaining
                    break
                remaining -= dur
            else:
                # offset exceeds total playlist duration, start from beginning
                start_index = 0
                asset_offset = 0.0
            self._playlist_queue = assets[start_index + 1:]
            self._playlist_block_id = block.id
            await self.play_asset(assets[start_index], asset_offset, block.id)
            return True
        if not block.asset_id:
            return False
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Asset).where(Asset.id == block.asset_id))
            asset = result.scalar_one_or_none()
        if not asset or asset.status != "ready":
            return False
        await self.play_asset(asset, offset, block.id)
        return True

    async def handle_redis_commands(self, redis: aioredis.Redis):
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"playout:{CHANNEL_ID}:cmd")
        async for msg in pubsub.listen():
            if msg["type"] != "message":
                continue
            cmd = msg["data"]
            logger.info(f"[{CHANNEL_ID}] CMD: {cmd}")
            if cmd == "PAUSE":
                self.paused = True
                self.idle = False
                elapsed = datetime.now(timezone.utc).timestamp() - self._proc_start_ts
                await self._save_cursor(None, self._current_offset + elapsed)
                self.kill_ffmpeg()
            elif cmd in ("RESUME_AS_CLOCK", "RESUME_PAUSED"):
                self.resume_cmd = cmd
                self.paused = False
                self.idle = False
                self._playlist_queue = []
            elif cmd == "STOP":
                self.kill_ffmpeg()
                self._playlist_queue = []
                self._playlist_block_id = None
                self.paused = False
                self.idle = True
                await self._save_cursor(None, 0.0)
                async with AsyncSessionLocal() as db:
                    await db.execute(update(Channel).where(Channel.id == CHANNEL_ID).values(state="READY"))
                    await db.commit()
                logger.info(f"[{CHANNEL_ID}] Stopped -- entering READY state")

    async def run(self):
        global SRS_RTMP
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Channel).where(Channel.id == CHANNEL_ID))
            ch = result.scalar_one_or_none()
            if ch and ch.stream_key:
                SRS_RTMP = f"rtmp://127.0.0.1:1935/live/{ch.stream_key}-int"
                logger.info(f"[{CHANNEL_ID}] Stream key: {ch.stream_key}-int")

        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        asyncio.create_task(self.handle_redis_commands(redis))
        logger.info(f"[{CHANNEL_ID}] Playout worker started")

        while True:
            if self.paused:
                await asyncio.sleep(1)
                continue

            if self.idle:
                await asyncio.sleep(10)
                block, offset = await get_current_block_for_channel()
                if block and block.block_type != "filler_loop":
                    logger.info(f"[{CHANNEL_ID}] Schedule block found -- resuming")
                    self.idle = False
                continue

            if self.resume_cmd == "RESUME_AS_CLOCK":
                block, offset = await get_current_block_for_channel()
                self._playlist_queue = []
                self.resume_cmd = None
                if not await self.play_block(block, offset):
                    await self._set_idle()
                    continue
            elif self.resume_cmd == "RESUME_PAUSED":
                _, offset = await self._get_cursor()
                block, _ = await get_current_block_for_channel()
                self._playlist_queue = []
                self.resume_cmd = None
                if not await self.play_block(block, offset):
                    await self._set_idle()
                    continue
            elif self._playlist_queue:
                await self.play_asset(self._playlist_queue.pop(0), 0, self._playlist_block_id)
                if self.current_proc:
                    await asyncio.get_event_loop().run_in_executor(None, self.current_proc.wait)
                await asyncio.sleep(1)
                continue
            else:
                block, offset = await get_current_block_for_channel()
                if not await self.play_block(block, offset):
                    await self._set_idle()
                    continue

            if self.current_proc:
                # For external sources (rtmp/hls), poll for schedule changes every 5s
                current_block_type = getattr(self, '_current_block_type', 'asset')
                if current_block_type in ('rtmp', 'hls'):
                    while self.current_proc and self.current_proc.poll() is None:
                        await asyncio.sleep(5)
                        # Check if a different block should now be playing
                        new_block, new_offset = await get_current_block_for_channel()
                        logger.info(f"[{CHANNEL_ID}] Poll: new_block={new_block.id if new_block else None} current={getattr(self, '_current_block_id', None)}")
                        if new_block and str(new_block.id) != str(getattr(self, '_current_block_id', None)):
                            logger.info(f"[{CHANNEL_ID}] Schedule change detected -- cutting RTMP/HLS")
                            self.kill_ffmpeg()
                            break
                        elif not new_block:
                            logger.info(f"[{CHANNEL_ID}] No block found -- cutting RTMP/HLS to READY")
                            self.kill_ffmpeg()
                            break
                else:
                    await asyncio.get_event_loop().run_in_executor(None, self.current_proc.wait)
                if self.current_proc and self.current_proc.returncode not in (0, -15):
                    logger.warning(f"[{CHANNEL_ID}] FFmpeg exit {self.current_proc.returncode}")
            await asyncio.sleep(1)


async def get_current_block_for_channel():
    async with AsyncSessionLocal() as db:
        return await get_current_block(db, CHANNEL_ID)


if __name__ == "__main__":
    asyncio.run(PlayoutWorker().run())
