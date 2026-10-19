import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .ai.providers import AIError
from .api import account, journey, learning, studio
from .config import get_settings
from .curriculum.seed import seed_curriculum
from .db import SessionLocal, engine

log = logging.getLogger("artofsoul")
settings = get_settings()


def run_migrations() -> None:
    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parent.parent
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    run_migrations()
    with SessionLocal() as db:
        seed_curriculum(db)
    if "change-me" in settings.jwt_secret and settings.environment != "development":
        log.warning("JWT_SECRET is the default value — set a strong secret in production.")
    yield


app = FastAPI(title="ArtOfSoul.N API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=False,
                   allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])


@app.exception_handler(AIError)
async def ai_error(_: Request, exc: AIError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "kind": type(exc).__name__})


app.include_router(journey.router)
app.include_router(account.router)
app.include_router(learning.router)
app.include_router(studio.router)


@app.get("/", include_in_schema=False)
def root():
    return {"message": "This is the ArtOfSoul.N API. Open the app at http://localhost:5174"}


@app.get("/api/health")
def health():
    with engine.connect() as c:
        c.execute(text("SELECT 1"))
    return {"status": "ok", "app": settings.app_name}
