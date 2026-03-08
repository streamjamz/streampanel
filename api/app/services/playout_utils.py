import subprocess
import logging

logger = logging.getLogger(__name__)


def start_playout_service(channel_id: str) -> bool:
    """Start playout systemd service for a channel. Returns True on success."""
    service = f"panel-playout@{channel_id}.service"
    for cmd in [["systemctl", "start", service], ["sudo", "systemctl", "start", service]]:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            logger.info(f"Started playout service for channel {channel_id}")
            return True
    logger.error(f"Failed to start playout for {channel_id}")
    return False


def stop_playout_service(channel_id: str) -> bool:
    """Stop playout systemd service for a channel."""
    service = f"panel-playout@{channel_id}.service"
    result = subprocess.run(["systemctl", "stop", service], capture_output=True, text=True)
    if result.returncode != 0:
        subprocess.run(["sudo", "systemctl", "stop", service], capture_output=True, text=True)
    return True


def is_playout_running(channel_id: str) -> bool:
    """Check if playout service is active."""
    service = f"panel-playout@{channel_id}.service"
    result = subprocess.run(["systemctl", "is-active", service], capture_output=True, text=True)
    return result.stdout.strip() == "active"
