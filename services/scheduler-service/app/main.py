from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.database import configure_database, get_session_factory, init_db
from app.executor import recover_stale_running_jobs
from app.jobs import seed_default_jobs
from app.routes import router
from app.runner import SchedulerLoop

_scheduler_loop: SchedulerLoop | None = None


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global _scheduler_loop
    settings = get_settings()
    configure_database(settings.database_url)
    init_db()
    session = get_session_factory()()
    try:
        seed_default_jobs(session)
        recover_stale_running_jobs(session, settings)
    finally:
        session.close()
    if settings.run_loop:
        _scheduler_loop = SchedulerLoop(settings)
        _scheduler_loop.start()
    try:
        yield
    finally:
        if _scheduler_loop is not None:
            _scheduler_loop.stop()
            _scheduler_loop = None


settings = get_settings()

app = FastAPI(title=f"{settings.service_name} API", version="0.10.0", lifespan=lifespan)
app.include_router(router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "status": "running",
        "scope": "scheduler-service",
    }
