import asyncio
import json
import uuid
import shutil
import threading
from pathlib import Path
from app.models.asset import Asset


async def probe_asset(file_path: str) -> dict:
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", file_path,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {stderr.decode()}")
    return json.loads(stdout)


async def generate_thumbnail(file_path: str, thumb_path: str):
    safe_input = Path(file_path).parent / "input_video.tmp"
    try:
        shutil.copy2(file_path, str(safe_input))
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-i", str(safe_input),
            "-ss", "00:00:05",
            "-vframes", "1",
            "-vf", "scale=320:-1",
            "-y", thumb_path,
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
    finally:
        safe_input.unlink(missing_ok=True)


async def _process_asset_async(asset_id, file_path: str, SessionLocal):
    from sqlalchemy import update
    from app.models.asset import Asset as AssetModel
    import logging
    logger = logging.getLogger("asset_service")

    if isinstance(asset_id, str):
        asset_id = uuid.UUID(asset_id)

    try:
        info = await probe_asset(file_path)
        streams = info.get("streams", [])
        fmt = info.get("format", {})
        v = next((s for s in streams if s["codec_type"] == "video"), None)
        a = next((s for s in streams if s["codec_type"] == "audio"), None)

        thumb_path = str(Path(file_path).parent / "thumbnail.jpg")
        try:
            await generate_thumbnail(file_path, thumb_path)
        except Exception as te:
            logger.warning(f"Thumbnail generation failed (non-fatal): {te}")
            thumb_path = None

        async with SessionLocal() as db:
            await db.execute(
                update(AssetModel).where(AssetModel.id == asset_id).values(
                    duration_secs=float(fmt.get("duration", 0)),
                    width=v["width"] if v else None,
                    height=v["height"] if v else None,
                    video_codec=v["codec_name"] if v else None,
                    audio_codec=a["codec_name"] if a else None,
                    audio_channels=a.get("channels") if a else None,
                    thumbnail_path=thumb_path,
                    status="ready",
                )
            )
            await db.commit()
        logger.info(f"Asset {asset_id} processed successfully")

    except Exception as e:
        logger.error(f"Asset processing failed for {asset_id}: {e}", exc_info=True)
        try:
            async with SessionLocal() as db:
                await db.execute(
                    update(AssetModel).where(AssetModel.id == asset_id).values(status="error")
                )
                await db.commit()
        except Exception as e2:
            logger.error(f"Failed to mark asset as error: {e2}")


def process_asset(asset: Asset):
    """Legacy entry point."""
    process_asset_by_id(str(asset.id), str(asset.file_path))


def process_asset_by_id(asset_id: str, file_path: str):
    """Background task entry point - runs in its own thread with a completely fresh DB engine."""
    def run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
            from sqlalchemy.orm import sessionmaker
            from app.config import settings
            engine = create_async_engine(settings.DATABASE_URL, echo=False)
            SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
            loop.run_until_complete(_process_asset_async(asset_id, file_path, SessionLocal))
        finally:
            loop.close()
    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join()