#!/usr/bin/env python3
"""
Restream Worker - pulls from SRS and pushes to an external RTMP target.
Usage: python3 restream_worker.py <channel_id_target_id>
"""
import subprocess
import sys
import signal
import os
import time
import logging
import psycopg2

if len(sys.argv) < 2:
    print("Usage: restream_worker.py <channel_id_target_id>")
    sys.exit(1)

_arg = sys.argv[1]
_idx = _arg.index('_', 36)
CHANNEL_ID = _arg[:_idx]
TARGET_ID = _arg[_idx+1:]
URL_FILE = f"/tmp/panel-restream/{CHANNEL_ID}_{TARGET_ID}.url"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] restream: %(message)s",
    handlers=[
        logging.FileHandler(f"/var/log/panel/restream-{sys.argv[1]}.log"),
        logging.StreamHandler(sys.stdout),
    ]
)
logger = logging.getLogger(__name__)

def get_stream_key():
    try:
        db_url = "postgresql://panel:9209b62989fdeb311a29af057d052345038aae745e8fa0cf@localhost:5432/panel"
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute("SELECT stream_key FROM channels WHERE id=%s", (CHANNEL_ID,))
        row = cur.fetchone()
        conn.close()
        return row[0] if row and row[0] else CHANNEL_ID
    except Exception as e:
        logger.warning(f"Could not get stream key: {e}")
        return CHANNEL_ID

def get_dest_url():
    try:
        return open(URL_FILE).read().strip()
    except Exception:
        logger.error(f"Could not read URL file: {URL_FILE}")
        sys.exit(1)

proc = None

def cleanup(signum, frame):
    global proc
    if proc and proc.poll() is None:
        proc.terminate()
        try: proc.wait(timeout=5)
        except: proc.kill()
    sys.exit(0)

signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

stream_key = get_stream_key()
logger.info(f"Restream worker started: {CHANNEL_ID} (key: {stream_key[:8]}...)")

def get_srs_source():
    """Pull from external encoder if live on main key, otherwise use internal playout key."""
    try:
        import urllib.request, json as _json
        with urllib.request.urlopen("http://127.0.0.1:1985/api/v1/streams/", timeout=2) as r:
            data = _json.loads(r.read())
            for stream in data.get("streams", []):
                if stream.get("name") == stream_key:
                    logger.info("External encoder active — restreaming from main key")
                    return f"rtmp://127.0.0.1:1935/live/{stream_key}"
    except Exception:
        pass
    return f"rtmp://127.0.0.1:1935/live/{stream_key}-int"

retry_delay = 5

while True:
    dest_url = get_dest_url()
    SRS_SOURCE = get_srs_source()
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "warning",
        "-re",
        "-i", SRS_SOURCE,
        "-c:v", "copy",
        "-c:a", "copy",
        "-f", "flv",
        dest_url,
    ]
    logger.info(f"Starting FFmpeg: {SRS_SOURCE} → {dest_url[:50]}...")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    
    output = []
    for line in proc.stdout:
        line = line.decode(errors='replace').strip()
        if line:
            logger.info(f"ffmpeg: {line}")
            output.append(line)
    
    proc.wait()
    code = proc.returncode
    
    if code == -15:
        logger.info("Stopped by signal")
        break
    
    logger.warning(f"FFmpeg exited with code {code}, retrying in {retry_delay}s...")
    time.sleep(retry_delay)
    retry_delay = min(retry_delay * 2, 60)
