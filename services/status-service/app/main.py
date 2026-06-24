from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app.config import get_settings
from app.database import configure_database, get_session_factory, init_db
from app.routes import router
from app.status_logic import ensure_cache_policy


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_database()
    init_db()
    runtime_settings = get_settings()
    db = get_session_factory()()
    try:
        ensure_cache_policy(db, runtime_settings.cache_ttl_seconds)
    finally:
        db.close()
    yield


settings = get_settings()

app = FastAPI(title=settings.service_name, version="0.1.0", lifespan=lifespan)
app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "status": "running",
        "scope": "status-cache",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": settings.service_name, "status": "healthy"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"service": settings.service_name, "status": "ready"}
