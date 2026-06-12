from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import configure_database, init_db
from app.rabbitmq_consumer import declare_rabbitmq_topology
from app.routes import router


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_database(settings.database_url)
    init_db()
    if settings.rabbitmq_topology_declare_on_startup:
        try:
            declare_rabbitmq_topology(settings)
        except Exception:
            pass
    yield


settings = get_settings()

app = FastAPI(title=f"{settings.service_name} API", version="0.10.0", lifespan=lifespan)
app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "status": "running",
        "scope": "analytics-service",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": settings.service_name, "status": "healthy"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"service": settings.service_name, "status": "ready"}
