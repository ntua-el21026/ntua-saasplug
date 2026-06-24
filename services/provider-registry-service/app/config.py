import os
from dataclasses import dataclass


def _get_int_env(name: str, default: int) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    try:
        return int(raw_value)
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
    return normalized in {"", "replace-me", "change-me", "change-me-in-local-env"} or normalized.startswith("change-me")


def strict_secret_validation_enabled() -> bool:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    return _get_bool_env("SAASPLUG_STRICT_SECRETS", False) or app_env in {"production", "demo"}


def validate_required_secret(name: str, value: str | None) -> None:
    if is_placeholder(value):
        raise RuntimeError(f"{name} must be set to a non-placeholder value when strict secret validation is enabled")


@dataclass(frozen=True)
class Settings:
    service_name: str
    database_url: str
    jwt_secret: str
    default_timeout_seconds: int
    red_provider_base_url: str
    green_provider_base_url: str
    blue_provider_base_url: str


def get_settings() -> Settings:
    settings = Settings(
        service_name=os.getenv("SERVICE_NAME", "provider-registry-service"),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql://saasplug:saasplug@provider-registry-postgres:5432/provider_registry",
        ),
        jwt_secret=os.getenv("JWT_SECRET", "change-me-in-local-env"),
        default_timeout_seconds=_get_int_env("PROVIDER_API_TIMEOUT_SECONDS", 10),
        red_provider_base_url=os.getenv(
            "RED_PROVIDER_BASE_URL",
            "https://davinci.softlab.ntua.gr/saas26/redPlug/api",
        ),
        green_provider_base_url=os.getenv(
            "GREEN_PROVIDER_BASE_URL",
            "https://davinci.softlab.ntua.gr/saas26/greenPlug/api",
        ),
        blue_provider_base_url=os.getenv(
            "BLUE_PROVIDER_BASE_URL",
            "https://davinci.softlab.ntua.gr/saas26/bluePlug/api",
        ),
    )
    if strict_secret_validation_enabled():
        validate_required_secret("JWT_SECRET", settings.jwt_secret)
    return settings
