import os
from functools import lru_cache


PROVIDER_CODES = ("redPlug", "greenPlug", "bluePlug")


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
        self.rabbitmq_event_publish_enabled = (
            os.getenv("STATUS_RABBITMQ_EVENT_PUBLISH_ENABLED", "false").lower() == "true"
        )
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
