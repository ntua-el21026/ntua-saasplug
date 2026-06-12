import os
from decimal import Decimal, InvalidOperation
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


def _get_decimal_env(name: str, default: str) -> Decimal:
    raw_value = os.getenv(name, default)
    try:
        return Decimal(raw_value)
    except (InvalidOperation, TypeError):
        return Decimal(default)


class Settings:
    def __init__(self) -> None:
        self.service_name = os.getenv("SERVICE_NAME", "billing-service")
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://saasplug:saasplug@billing-postgres:5432/billing",
        )
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-local-env")
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
        self.rabbitmq_event_exchange = os.getenv("RABBITMQ_EVENT_EXCHANGE", "saasplug.events")
        self.rabbitmq_publish_timeout_seconds = _get_float_env("RABBITMQ_PUBLISH_TIMEOUT_SECONDS", 5)
        self.rabbitmq_consume_batch_size = _get_int_env("BILLING_RABBITMQ_CONSUME_BATCH_SIZE", 50)
        self.rabbitmq_consume_timeout_seconds = _get_float_env(
            "BILLING_RABBITMQ_CONSUME_TIMEOUT_SECONDS",
            5,
        )
        self.rabbitmq_topology_declare_on_startup = _get_bool_env(
            "BILLING_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP",
            False,
        )
        self.default_currency = os.getenv("BILLING_DEFAULT_CURRENCY", "EUR")
        self.default_reservation_success_fee = _get_decimal_env(
            "BILLING_DEFAULT_RESERVATION_SUCCESS_FEE",
            "0.50",
        )
        self.default_point_view_fee = _get_decimal_env("BILLING_DEFAULT_POINT_VIEW_FEE", "0.01")
        self.default_point_view_fee_enabled = _get_bool_env(
            "BILLING_DEFAULT_POINT_VIEW_FEE_ENABLED",
            True,
        )
        self.default_reservation_failure_fee = _get_decimal_env(
            "BILLING_DEFAULT_RESERVATION_FAILURE_FEE",
            "0.00",
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
