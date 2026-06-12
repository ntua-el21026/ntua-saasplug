from enum import StrEnum
from typing import Callable

from pydantic import ValidationError

from saasplug_events.envelope import EventEnvelope


class ConsumerAction(StrEnum):
    ACK = "ack"
    REQUEUE = "requeue"
    REJECT = "reject"


EnvelopeHandler = Callable[[EventEnvelope], ConsumerAction]


def handle_delivery(channel, method, _properties, body: bytes, handler: EnvelopeHandler) -> ConsumerAction:
    delivery_tag = method.delivery_tag
    try:
        envelope = EventEnvelope.from_message_body(body)
    except (UnicodeDecodeError, ValidationError, ValueError):
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
        return ConsumerAction.REJECT

    action = handler(envelope)
    if action == ConsumerAction.ACK:
        channel.basic_ack(delivery_tag=delivery_tag)
    elif action == ConsumerAction.REQUEUE:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=True)
    else:
        channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
    return action
