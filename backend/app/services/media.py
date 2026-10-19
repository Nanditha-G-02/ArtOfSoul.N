"""Safe image handling and signed, expiring media URLs (so <img> tags work without exposing tokens)."""
import base64
import hashlib
import hmac
import io
import time
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import get_settings

ALLOWED_FORMATS = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp")}
MIN_SIDE = 256
MAX_PIXELS = 40_000_000
MODEL_MAX_SIDE = 1568  # keeps vision requests efficient


class UploadError(ValueError):
    pass


def _dir(kind: str, user_id: int) -> Path:
    d = get_settings().storage_dir / kind / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def validate_and_store(raw: bytes, kind: str, user_id: int) -> dict:
    s = get_settings()
    if len(raw) > s.max_upload_mb * 1024 * 1024:
        raise UploadError(f"File is larger than {s.max_upload_mb} MB.")
    if not raw:
        raise UploadError("The file is empty.")
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        probe = Image.open(io.BytesIO(raw))
        fmt = probe.format
        probe.verify()
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError) as e:
        raise UploadError("That file is not a readable image.") from e
    if fmt not in ALLOWED_FORMATS:
        raise UploadError("Please upload a JPEG, PNG or WEBP image.")
    img = ImageOps.exif_transpose(img)
    if min(img.size) < MIN_SIDE:
        raise UploadError(f"The image is too small to assess (minimum {MIN_SIDE}px on the short side).")
    # re-encode: strips EXIF/GPS metadata and any embedded payloads
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    name = f"{uuid.uuid4().hex}.jpg"
    img.convert("RGB").save(_dir(kind, user_id) / name, "JPEG", quality=92)
    return {"stored_name": name, "mime": "image/jpeg", "width": img.width, "height": img.height}


def save_png(data: bytes, kind: str, user_id: int) -> str:
    img = Image.open(io.BytesIO(data))
    img.load()
    name = f"{uuid.uuid4().hex}.png"
    img.save(_dir(kind, user_id) / name, "PNG")
    return name


def path_for(kind: str, user_id: int, stored_name: str) -> Path:
    p = (_dir(kind, user_id) / stored_name).resolve()
    if p.parent != _dir(kind, user_id).resolve():
        raise UploadError("Invalid path")
    return p


def for_model(kind: str, user_id: int, stored_name: str, region: dict | None = None) -> dict:
    """Base64 image part for a vision model; optionally cropped to a fractional region."""
    img = Image.open(path_for(kind, user_id, stored_name)).convert("RGB")
    if region:
        w, h = img.size
        box = (int(region["x"] * w), int(region["y"] * h), int((region["x"] + region["w"]) * w), int((region["y"] + region["h"]) * h))
        img = img.crop(box)
    img.thumbnail((MODEL_MAX_SIDE, MODEL_MAX_SIDE))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    return {"type": "image", "media_type": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}


# ---------------------------------------------------------------- signed URLs
def _sig(kind: str, user_id: int, name: str, exp: int) -> str:
    key = get_settings().jwt_secret.encode()
    return hmac.new(key, f"{kind}|{user_id}|{name}|{exp}".encode(), hashlib.sha256).hexdigest()[:32]


def signed_url(kind: str, user_id: int, name: str, ttl: int = 3600 * 6) -> str:
    exp = int(time.time()) + ttl
    return f"/api/media/{kind}/{user_id}/{name}?exp={exp}&sig={_sig(kind, user_id, name, exp)}"


def verify(kind: str, user_id: int, name: str, exp: int, sig: str) -> bool:
    return exp > time.time() and hmac.compare_digest(sig, _sig(kind, user_id, name, exp))
