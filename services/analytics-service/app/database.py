from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import inspect, text

from app.config import get_settings
from app.models import Base

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None
_database_url: str | None = None


def normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    return database_url


def configure_database(database_url: str | None = None) -> None:
    global _database_url, _engine, _session_factory

    selected_url = normalize_database_url(database_url or get_settings().database_url)
    if _engine is not None and _database_url == selected_url:
        return

    if _engine is not None:
        _engine.dispose()

    connect_args = {}
    if selected_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    _engine = create_engine(selected_url, pool_pre_ping=True, connect_args=connect_args)
    _session_factory = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
    _database_url = selected_url


def get_engine() -> Engine:
    if _engine is None:
        configure_database()
    assert _engine is not None
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    if _session_factory is None:
        configure_database()
    assert _session_factory is not None
    return _session_factory


def init_db() -> None:
    Base.metadata.create_all(bind=get_engine())
    migrate_analytics_schema()


def migrate_analytics_schema() -> None:
    engine = get_engine()
    inspector = inspect(engine)
    for table_name in ("provider_hourly_metrics", "provider_daily_metrics"):
        if table_name not in inspector.get_table_names():
            continue
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        statements: list[str] = []
        if "status_cache_hits" not in columns:
            statements.append(f"ALTER TABLE {table_name} ADD COLUMN status_cache_hits INTEGER NOT NULL DEFAULT 0")
        if "status_provider_calls" not in columns:
            statements.append(f"ALTER TABLE {table_name} ADD COLUMN status_provider_calls INTEGER NOT NULL DEFAULT 0")
        if statements:
            with engine.begin() as connection:
                for statement in statements:
                    connection.execute(text(statement))


def get_db() -> Generator[Session, None, None]:
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def reset_database_for_tests(database_url: str) -> None:
    configure_database(database_url)
    Base.metadata.drop_all(bind=get_engine())
    Base.metadata.create_all(bind=get_engine())
