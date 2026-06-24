import os
from functools import lru_cache
from urllib.parse import urlparse


PROVIDER_CODES = ("redPlug", "greenPlug", "bluePlug")


def _get_bool_env(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def is_placeholder(value: str | None) -> bool:
    if value is None:
        return True
    normalized = value.strip()
    return normalized in {"", "guest", "replace-me", "change-me", "change-me-in-local-env"} or normalized.startswith("change-me")


def strict_secret_validation_enabled() -> bool:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    return _get_bool_env("SAASPLUG_STRICT_SECRETS", False) or app_env in {"production", "demo"}


def validate_required_secret(name: str, value: str | None) -> None:
    if is_placeholder(value):
        raise RuntimeError(f"{name} must be set to a non-placeholder value when strict secret validation is enabled")


def validate_rabbitmq_url(value: str) -> None:
    parsed = urlparse(value)
    if parsed.scheme not in {"amqp", "amqps"} or is_placeholder(parsed.username) or is_placeholder(parsed.password):
        raise RuntimeError("RABBITMQ_URL must use non-placeholder credentials when strict secret validation is enabled")


class Settings:
    def __init__(self) -> None:
        self.service_name = os.getenv("SERVICE_NAME", "status-service")
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql://saasplug:saasplug@status-postgres:5432/status",
        )
        self.jwt_secret = os.getenv("JWT_SECRET", "change-me-in-local-env")
        self.cache_ttl_seconds = int(os.getenv("STATUS_CACHE_TTL_SECONDS", "300"))
        self.provider_timeout_seconds = float(os.getenv("STATUS_PROVIDER_TIMEOUT_SECONDS", "10"))
        self.rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672/")
        self.rabbitmq_event_exchange = os.getenv("RABBITMQ_EVENT_EXCHANGE", "saasplug.events")
        self.rabbitmq_publish_timeout_seconds = float(os.getenv("RABBITMQ_PUBLISH_TIMEOUT_SECONDS", "5"))
        self.rabbitmq_event_publish_enabled = _get_bool_env("STATUS_RABBITMQ_EVENT_PUBLISH_ENABLED", False)
        self.red_provider_service_url = os.getenv(
            "RED_PROVIDER_SERVICE_URL",
            "http://red-provider-service:8000",
        ).rstrip("/")
        self.green_provider_service_url = os.getenv(
            "GREEN_PROVIDER_SERVICE_URL",
            "http://green-provider-service:8000",
        ).rstrip("/")
        self.blue_provider_service_url = os.getenv(
            "BLUE_PROVIDER_SERVICE_URL",
            "http://blue-provider-service:8000",
        ).rstrip("/")
        if strict_secret_validation_enabled():
            validate_required_secret("JWT_SECRET", self.jwt_secret)
            validate_rabbitmq_url(self.rabbitmq_url)

    def provider_service_url(self, provider_code: str) -> str:
        provider_urls = {
            "redPlug": self.red_provider_service_url,
            "greenPlug": self.green_provider_service_url,
            "bluePlug": self.blue_provider_service_url,
        }
        try:
            return provider_urls[provider_code]
        except KeyError as exc:
            raise ValueError(f"Unsupported provider code: {provider_code}") from exc


@lru_cache
def get_settings() -> Settings:
    return Settings()
