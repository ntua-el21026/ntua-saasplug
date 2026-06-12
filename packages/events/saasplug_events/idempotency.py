from collections.abc import MutableSet
from uuid import UUID


class InMemoryIdempotencyStore:
    def __init__(self, initial_event_ids: set[str] | None = None) -> None:
        self._event_ids: MutableSet[str] = set(initial_event_ids or set())

    def is_processed(self, event_id: UUID | str) -> bool:
        return str(event_id) in self._event_ids

    def mark_processed(self, event_id: UUID | str) -> None:
        self._event_ids.add(str(event_id))


def should_process(event_id: UUID | str, store: InMemoryIdempotencyStore) -> bool:
    return not store.is_processed(event_id)
