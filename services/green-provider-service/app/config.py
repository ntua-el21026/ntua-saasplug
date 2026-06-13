import os
from functools import lru_cache

from app import provider_config


class Settings:
    def __init__(self) -> None:
        self.service_name = os.getenv("SERVICE_NAME", provider_config.SERVICE_NAME_DEFAULT)
        self.provider_code = os.getenv("PROVIDER_CODE", provider_config.PROVIDER_CODE)
        self.database_url = os.getenv("DATABASE_URL", provider_config.DATABASE_URL_DEFAULT)
        self.provider_base_url = (
            os.getenv("PROVIDER_BASE_URL")
            or os.getenv(provider_config.BASE_URL_ENV)
            or provider_config.BASE_URL_DEFAULT
        ).rstrip("/")
        self.api_key_env_var = os.getenv(
            "PROVIDER_API_KEY_ENV_VAR",
            provider_config.API_KEY_ENV_VAR_DEFAULT,
        )
        self.provider_auth_scheme = os.getenv("PROVIDER_AUTH_SCHEME", "Bearer").strip()
        self.request_timeout_seconds = float(os.getenv("PROVIDER_API_TIMEOUT_SECONDS", "10"))

    @property
    def api_key_value(self) -> str | None:
        value = os.getenv(self.api_key_env_var)
        return value if value else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
