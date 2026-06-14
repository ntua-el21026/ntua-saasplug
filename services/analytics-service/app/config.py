import os
from functools import lru_cache


PROVIDER_CODES = ("redPlug", "greenPlug", "bluePlug")


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
        self.service_name = os.getenv("SERVICE_NAME", "analytics-service")
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://saasplug:saasplug@analytics-postgres:5432/analytics",
        )
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-local-env")
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
        self.rabbitmq_event_exchange = os.getenv("RABBITMQ_EVENT_EXCHANGE", "saasplug.events")
        self.rabbitmq_consume_batch_size = _get_int_env("ANALYTICS_RABBITMQ_CONSUME_BATCH_SIZE", 50)
        self.rabbitmq_consume_timeout_seconds = _get_float_env(
            "ANALYTICS_RABBITMQ_CONSUME_TIMEOUT_SECONDS",
            5,
        )
        self.rabbitmq_topology_declare_on_startup = _get_bool_env(
            "ANALYTICS_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP",
            False,
        )
        self.scheduler_internal_token = os.getenv("SCHEDULER_INTERNAL_TOKEN", "change-me-scheduler-token")


@lru_cache
def get_settings() -> Settings:
    return Settings()
