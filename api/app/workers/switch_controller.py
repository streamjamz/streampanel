"""
Switch Controller – per-channel state machine.
"""
import asyncio
import json
import logging
import subprocess
import sys
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from sqlalchemy import select, update

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.channel import Channel
from app.models.stream_target import StreamTarget  # noqa: F401

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("switch_controller")

POLL_INTERVAL = 2
TAKE_LIVE_TIMEOUT = 15
FLAP_COOLDOWN = 8


class ChannelFSM:
    def __init__(self, channel_id: str, redis: aioredis.Redis):
        self.channel_id = channel_id
        self.redis = redis
        self.state: str = "UNKNOWN"
        self.last_transition: datetime = datetime.now(timezone.utc)
        self.take_live_requested_at: datetime | None = None
        self.copy_proc: subprocess.Popen | None = None

    def _cooldown_ok(self) -> bool:
        return (datetime.now(timezone.utc) - self.last_transition).total_seconds() >= FLAP_COOLDOWN

    async def _set_state(self, new_state: str, force: bool = False):
        if new_state == self.state:
            return
        if not force and not self._cooldown_ok():
            logger.warning(f"[{self.channel_id}] Cooldown — ignoring → {new_state}")
            return
        logger.info(f"[{self.channel_id}] {self.state} → {new_state}")
        self.state = new_state
        self.last_transition = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            await db.execute(update(Channel).where(Channel.id == self.channel_id).values(state=new_state))
            await db.commit()
        await self.redis.publish(
            f"channel:{self.channel_id}:state",
            json.dumps({"state": new_state, "ts": datetime.now(timezone.utc).isoformat()}),
        )

    async def _is_external_live(self) -> bool:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Channel).where(Channel.id == self.channel_id))
            ch = result.scalar_one_or_none()
            if not ch:
                return False
            stream_key = ch.stream_key
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{settings.SRS_API_URL}/api/v1/clients/", timeout=3)
                for c in r.json().get("clients", []):
                    if (c.get("publish") and
                        c.get("name") == stream_key and
                        c.get("ip") not in ("127.0.0.1", "::1")):
                        return True
        except Exception:
            pass
        return False

    async def _get_channel(self):
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Channel).where(Channel.id == self.channel_id))
            return result.scalar_one_or_none()

    async def _signal_playout(self, cmd: str):
        await self.redis.publish(f"playout:{self.channel_id}", cmd)

    async def _start_copy(self, stream_key: str):
        """Start FFmpeg to copy OBS stream to -int"""
        if self.copy_proc and self.copy_proc.poll() is None:
            return  # Already running
        
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", f"rtmp://127.0.0.1:1935/live/{stream_key}",
            "-c", "copy",
            "-f", "flv", f"rtmp://127.0.0.1:1935/live/{stream_key}-int"
        ]
        
        logger.info(f"[{self.channel_id}] Starting OBS copy to -int")
        self.copy_proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    def _stop_copy(self):
        """Stop FFmpeg copy process"""
        if self.copy_proc and self.copy_proc.poll() is None:
            logger.info(f"[{self.channel_id}] Stopping OBS copy")
            self.copy_proc.terminate()
            try:
                self.copy_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.copy_proc.kill()
        self.copy_proc = None

    async def tick(self):
        ch = await self._get_channel()
        if not ch:
            return

        if self.state == "UNKNOWN":
            self.state = ch.state or "OFFLINE"

        ext_live = await self._is_external_live()
        now = datetime.now(timezone.utc)

        if ch.channel_type == "live":
            if ext_live and self.state != "LIVE_ONLY":
                await self._set_state("LIVE_ONLY")
            elif not ext_live and self.state == "LIVE_ONLY":
                if ch.last_live_seen:
                    elapsed = (now - ch.last_live_seen.replace(tzinfo=timezone.utc)).total_seconds()
                    if elapsed > ch.live_timeout_seconds:
                        await self._set_state("OFFLINE")

        elif ch.channel_type == "tv":
            if self.state in ("TV_VOD_RUNNING", "OFFLINE"):
                if ext_live:
                    logger.info(f"[{self.channel_id}] External encoder detected — auto take-live")
                    await self._signal_playout("PAUSE")
                    await self._start_copy(ch.stream_key)
                    await self._set_state("TV_LIVE_RUNNING", force=True)

            elif self.state == "TV_LIVE_REQUESTED":
                if ext_live:
                    await self._signal_playout("PAUSE")
                    await self._start_copy(ch.stream_key)
                    await self._set_state("TV_LIVE_RUNNING", force=True)
                elif self.take_live_requested_at:
                    if (now - self.take_live_requested_at).total_seconds() > TAKE_LIVE_TIMEOUT:
                        await self._set_state("TV_VOD_RUNNING", force=True)
                        self.take_live_requested_at = None

            elif self.state == "TV_LIVE_RUNNING":
                if not ext_live and ch.last_live_seen:
                    elapsed = (now - ch.last_live_seen.replace(tzinfo=timezone.utc)).total_seconds()
                    if elapsed > ch.live_timeout_seconds:
                        logger.info(f"[{self.channel_id}] Encoder gone — resuming playout")
                        self._stop_copy()
                        await self._signal_playout("RESUME_AS_CLOCK")
                        await self._set_state("TV_VOD_RUNNING", force=True)

    async def request_take_live(self):
        if self.state not in ("TV_VOD_RUNNING", "OFFLINE"):
            return
        self.take_live_requested_at = datetime.now(timezone.utc)
        await self._set_state("TV_LIVE_REQUESTED", force=True)

    async def request_return_to_vod(self):
        self._stop_copy()
        await self._signal_playout("RESUME_AS_CLOCK")
        await self._set_state("TV_VOD_RUNNING", force=True)


async def run():
    redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    fsm_map: dict[str, ChannelFSM] = {}
    pubsub = redis.pubsub()
    await pubsub.subscribe("controller:commands")

    async def handle_commands():
        async for msg in pubsub.listen():
            if msg["type"] != "message":
                continue
            try:
                data = json.loads(msg["data"])
                ch_id = data.get("channel_id")
                cmd = data.get("cmd")
                if ch_id not in fsm_map:
                    fsm_map[ch_id] = ChannelFSM(ch_id, redis)
                fsm = fsm_map[ch_id]
                if cmd == "TAKE_LIVE":
                    await fsm.request_take_live()
                elif cmd == "RETURN_TO_VOD":
                    await fsm.request_return_to_vod()
            except Exception as e:
                logger.error(f"Command error: {e}")

    async def poll_loop():
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    channels = (await db.execute(select(Channel))).scalars().all()
                for ch in channels:
                    ch_id = str(ch.id)
                    if ch_id not in fsm_map:
                        fsm_map[ch_id] = ChannelFSM(ch_id, redis)
                    await fsm_map[ch_id].tick()
            except Exception as e:
                logger.error(f"Poll loop error: {e}")
            await asyncio.sleep(POLL_INTERVAL)

    logger.info("Switch controller started")
    await asyncio.gather(poll_loop(), handle_commands())


if __name__ == "__main__":
    asyncio.run(run())