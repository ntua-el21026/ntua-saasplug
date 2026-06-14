import os
from functools import lru_cache


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
    except ValueError:
        return default


def _get_float_env(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return float(raw_value)
    except ValueError:
        return default


def _get_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.service_name = os.getenv("SERVICE_NAME", "scheduler-service")
        self.database_url = os.getenv(
            "SCHEDULER_DATABASE_URL",
            os.getenv("DATABASE_URL", "postgresql://saasplug:saasplug@scheduler-postgres:5432/scheduler"),
        )
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-local-env")
        self.tick_seconds = _get_int_env("SCHEDULER_TICK_SECONDS", 15)
        self.max_concurrent_jobs = _get_int_env("SCHEDULER_MAX_CONCURRENT_JOBS", 2)
        self.instance_id = os.getenv("SCHEDULER_INSTANCE_ID", "scheduler-service-1")
        self.internal_token = os.getenv("SCHEDULER_INTERNAL_TOKEN", "change-me-scheduler-token")
        self.http_timeout_seconds = _get_float_env("SCHEDULER_HTTP_TIMEOUT_SECONDS", 10)
        self.run_loop = _get_bool_env("SCHEDULER_RUN_LOOP", True)
        self.catalog_service_url = os.getenv("CATALOG_SERVICE_URL", "http://catalog-service:8000").rstrip("/")
        self.analytics_service_url = os.getenv("ANALYTICS_SERVICE_URL", "http://analytics-service:8000").rstrip("/")
        self.billing_service_url = os.getenv("BILLING_SERVICE_URL", "http://billing-service:8000").rstrip("/")
        self.reservation_service_url = os.getenv("RESERVATION_SERVICE_URL", "http://reservation-service:8000").rstrip("/")

    def service_url(self, service_name: str) -> str:
        urls = {
            "catalog-service": self.catalog_service_url,
            "analytics-service": self.analytics_service_url,
            "billing-service": self.billing_service_url,
            "reservation-service": self.reservation_service_url,
        }
        try:
            return urls[service_name]
        except KeyError as exc:
            raise ValueError(f"Unsupported scheduler target service: {service_name}") from exc


@lru_cache
def get_settings() -> Settings:
    return Settings()
