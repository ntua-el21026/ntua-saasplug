from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI

from app.config import get_settings
from app.database import configure_database, init_db
from app.routes import router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_database()
    init_db()
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
