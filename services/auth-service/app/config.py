import os
from dataclasses import dataclass


PLACEHOLDER_VALUES = {
    "",
    "replace-me",
    "change-me",
    "change-me-in-local-env",
    "change-me-demo-password",
}


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
    return normalized in PLACEHOLDER_VALUES or normalized.startswith("change-me")


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
    jwt_access_token_expire_minutes: int
    jwt_refresh_token_expire_days: int
    demo_user_password: str
    reset_demo_users_on_startup: bool
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    google_frontend_callback_uri: str

    @property
    def access_token_expires_in_seconds(self) -> int:
        return self.jwt_access_token_expire_minutes * 60

    @property
    def google_oauth_configured(self) -> bool:
        return not (
            is_placeholder(self.google_client_id)
            or is_placeholder(self.google_client_secret)
            or is_placeholder(self.google_redirect_uri)
        )


def get_settings() -> Settings:
    settings = Settings(
        service_name=os.getenv("SERVICE_NAME", "auth-service"),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql://saasplug:saasplug@auth-postgres:5432/auth",
        ),
        jwt_secret=os.getenv("JWT_SECRET", "change-me-in-local-env"),
        jwt_access_token_expire_minutes=_get_int_env(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
            30,
        ),
        jwt_refresh_token_expire_days=_get_int_env("JWT_REFRESH_TOKEN_EXPIRE_DAYS", 7),
        demo_user_password=os.getenv(
            "DEMO_USER_PASSWORD",
            "change-me-demo-password",
        ),
        reset_demo_users_on_startup=_get_bool_env("RESET_DEMO_USERS_ON_STARTUP", False),
        google_client_id=os.getenv("GOOGLE_CLIENT_ID", "replace-me"),
        google_client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "replace-me"),
        google_redirect_uri=os.getenv(
            "GOOGLE_REDIRECT_URI",
            "http://localhost:8080/api/auth/auth/google/callback",
        ),
        google_frontend_callback_uri=os.getenv(
            "GOOGLE_FRONTEND_CALLBACK_URI",
            "http://localhost:8080/login/google/callback",
        ),
    )
    if strict_secret_validation_enabled():
        validate_required_secret("JWT_SECRET", settings.jwt_secret)
        validate_required_secret("DEMO_USER_PASSWORD", settings.demo_user_password)
    return settings
