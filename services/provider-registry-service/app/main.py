import os

from fastapi import FastAPI

SERVICE_NAME = os.getenv("SERVICE_NAME", "provider-registry-service")

app = FastAPI(title=f"{SERVICE_NAME} baseline", version="0.1.0")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": SERVICE_NAME,
        "status": "running",
        "scope": "infrastructure-baseline",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "healthy"}


@app.get("/ready")
def ready() -> dict[str, str]:
    return {"service": SERVICE_NAME, "status": "ready"}
