from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import configure_database, get_session_factory, init_db
from app.routes import router as auth_router
from app.seed import seed_demo_users


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_database(settings.database_url)
    init_db()
    db = get_session_factory()()
    try:
        seed_demo_users(db, settings)
    finally:
        db.close()
    yield


settings = get_settings()

app = FastAPI(
    title=f"{settings.service_name} API",
    version="0.3.0",
    lifespan=lifespan,
)
app.include_router(auth_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "status": "running",
        "scope": "auth-service",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": settings.service_name, "status": "healthy"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"service": settings.service_name, "status": "ready"}
