from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schedule import ScheduleBlock
from app.models.channel import Channel


async def get_current_block(db: AsyncSession, channel_id: str) -> tuple:
    """
    Returns (block, offset_secs) for what should currently be playing.
    Block start_time is interpreted in the channel's configured timezone.
    """
    # Load channel timezone
    result = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = result.scalar_one_or_none()
    tz_name = (channel.timezone if channel and channel.timezone else "UTC")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc

    now_local = datetime.now(tz)
    dow = 2 ** now_local.weekday()  # Mon=1, Tue=2, ..., Sun=64

    result = await db.execute(
        select(ScheduleBlock)
        .where(
            ScheduleBlock.channel_id == channel_id,
            ScheduleBlock.day_mask.op("&")(dow) > 0,
        )
        .order_by(ScheduleBlock.start_time)
    )
    blocks = result.scalars().all()

    now_ts = now_local.timestamp()

    for block in blocks:
        st = block.start_time
        # Interpret block start_time in channel's local timezone
        block_start_dt = now_local.replace(
            hour=st.hour, minute=st.minute, second=st.second, microsecond=0
        )
        block_start_ts = block_start_dt.timestamp()
        # For playlist blocks load live duration from items
        if block.block_type == "playlist" and block.playlist_id:
            from sqlalchemy.orm import selectinload
            from app.models.playlist import Playlist, PlaylistItem
            pl_result = await db.execute(
                select(Playlist).options(
                    selectinload(Playlist.items).selectinload(PlaylistItem.asset)
                ).where(Playlist.id == block.playlist_id)
            )
            pl = pl_result.scalar_one_or_none()
            if pl and pl.items:
                duration = sum(
                    float(i.asset.duration_secs) for i in pl.items
                    if i.asset and i.asset.duration_secs
                )
            else:
                duration = float(block.duration_secs or 0)
        else:
            duration = float(block.duration_secs or 0)
        block_end_ts = block_start_ts + duration

        if block_start_ts <= now_ts < block_end_ts:
            offset = now_ts - block_start_ts
            return block, offset

    return None, 0.0