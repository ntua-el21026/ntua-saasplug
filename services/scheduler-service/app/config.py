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


def is_placeholder(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip()
    return normalized in {
        "",
        "replace-me",
        "change-me",
        "change-me-in-local-env",
        "change-me-scheduler-token",
    } or normalized.startswith("change-me")


def strict_secret_validation_enabled() -> bool:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    return _get_bool_env("SAASPLUG_STRICT_SECRETS", False) or app_env in {"production", "demo"}


def validate_required_secret(name: str, value: str | None) -> None:
    if is_placeholder(value):
        raise RuntimeError(f"{name} must be set to a non-placeholder value when strict secret validation is enabled")


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
        if strict_secret_validation_enabled():
            validate_required_secret("JWT_SECRET", self.jwt_secret)
            validate_required_secret("SCHEDULER_INTERNAL_TOKEN", self.internal_token)

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
