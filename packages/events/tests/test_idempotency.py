from uuid import uuid4

from saasplug_events.idempotency import InMemoryIdempotencyStore, should_process


def test_in_memory_idempotency_store_tracks_processed_event_ids() -> None:
    event_id = uuid4()
    store = InMemoryIdempotencyStore()

    assert should_process(event_id, store) is True

    store.mark_processed(event_id)

    assert should_process(event_id, store) is False
