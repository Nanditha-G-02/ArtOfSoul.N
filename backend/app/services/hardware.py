"""Inspect this computer and recommend a realistic local model configuration."""
import os
import platform
import shutil
import subprocess

from ..ai.router import get_router
from ..config import get_settings
from . import tts


def _gpu() -> dict | None:
    exe = shutil.which("nvidia-smi")
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                             capture_output=True, text=True, timeout=5).stdout.strip().splitlines()
        name, mem = out[0].split(",")
        return {"name": name.strip(), "vram_gb": round(int(mem.strip()) / 1024, 1)}
    except (OSError, ValueError, IndexError, subprocess.SubprocessError):
        return None


def report() -> dict:
    try:
        import psutil
        ram = round(psutil.virtual_memory().total / 1024 ** 3, 1)
        free_disk = round(psutil.disk_usage(str(get_settings().storage_dir)).free / 1024 ** 3, 1)
    except Exception:
        ram, free_disk = None, None
    gpu = _gpu()
    vram = gpu["vram_gb"] if gpu else 0
    if vram >= 10 or (ram or 0) >= 30:
        rec, why = "gemma4:12b", "Enough memory for the larger, more accurate model."
    elif (ram or 0) >= 14 or vram >= 6:
        rec, why = "gemma4:e4b", "Good balance of quality and speed for this machine."
    else:
        rec, why = "gemma4:e2b", "Smallest Gemma 4 model; best fit for limited memory."
    images_ok = vram >= 6
    router = get_router()
    _, current = router.spec("teacher")
    return {
        "os": f"{platform.system()} {platform.release()}", "cpu_cores": os.cpu_count(), "ram_gb": ram, "gpu": gpu,
        "free_disk_gb": free_disk,
        "recommended_model": rec, "recommendation_reason": why, "current_model": current,
        "image_generation": {"practical": images_ok,
                             "note": "A GPU with 6 GB+ VRAM makes local Stable Diffusion practical." if not images_ok
                             else "Your GPU can run local Stable Diffusion for reference images."},
        "ai_roles": router.status(), "voice": tts.status(),
    }
