from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import configure_database, init_db
from app.routes import router


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_database()
    init_db()
    yield


app = FastAPI(title="reservation-service", version="0.8.0", lifespan=lifespan)
app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    settings = get_settings()
    return {
        "service": settings.service_name,
        "status": "running",
        "scope": "reservation-truth",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": get_settings().service_name, "status": "healthy"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"service": get_settings().service_name, "status": "ready"}
