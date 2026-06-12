from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EventEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event_id: UUID
    event_type: str = Field(min_length=1)
    event_version: int = Field(ge=1)
    occurred_at: datetime
    correlation_id: UUID
    producer: str = Field(min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("occurred_at")
    @classmethod
    def occurred_at_must_be_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must be timezone-aware")
        return value.astimezone(UTC)

    def to_message_body(self) -> bytes:
        return self.model_dump_json().encode("utf-8")

    @classmethod
    def from_message_body(cls, body: bytes | str) -> "EventEnvelope":
        if isinstance(body, bytes):
            body = body.decode("utf-8")
        return cls.model_validate_json(body)
