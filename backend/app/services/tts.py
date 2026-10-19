"""Local text-to-speech with Piper (free, offline). Returns None when Piper or the voice isn't installed,
so the browser can fall back to the operating system's built-in voice."""
import hashlib
import io
import threading
import wave
from pathlib import Path

from ..config import get_settings

_voice = None
_lock = threading.Lock()
_status: dict = {}


def status() -> dict:
    s = get_settings()
    path = Path(s.piper_voice)
    try:
        import piper  # noqa: F401
        installed = True
    except ImportError:
        installed = False
    ready = installed and path.exists() and Path(str(path) + ".json").exists()
    hint = "" if ready else ("Install with: pip install piper-tts" if not installed else
                             f"Download the voice: python -m piper.download_voices en_US-ljspeech-medium --data-dir {path.parent}")
    return {"engine": "piper", "ready": ready, "voice": path.stem, "hint": hint}


def _load():
    global _voice
    if _voice is None:
        from piper import PiperVoice
        _voice = PiperVoice.load(str(get_settings().piper_voice))
    return _voice


def synthesize(text: str) -> bytes | None:
    if not status()["ready"]:
        return None
    text = " ".join(text.split())[:1200]
    cache_dir = get_settings().storage_dir / "tts"
    cache_dir.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256((Path(get_settings().piper_voice).stem + "|" + text).encode()).hexdigest()[:32]
    f = cache_dir / f"{key}.wav"
    if f.exists():
        return f.read_bytes()
    buf = io.BytesIO()
    with _lock:
        voice = _load()
        with wave.open(buf, "wb") as w:
            voice.synthesize_wav(text, w)
    data = buf.getvalue()
    f.write_bytes(data)
    return data
