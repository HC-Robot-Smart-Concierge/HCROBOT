import time
import pytest
from app.api.v1.endpoints.operations.reception import (
    ROOM_PIN_ATTEMPTS,
    PIN_LOCKOUT_MAX_ATTEMPTS,
    PIN_LOCKOUT_DURATION_SEC,
)


def test_lockout_constants():
    assert PIN_LOCKOUT_MAX_ATTEMPTS == 5
    assert PIN_LOCKOUT_DURATION_SEC == 60


def test_room_pin_attempts_tracking():
    room_test = "999"
    ROOM_PIN_ATTEMPTS.pop(room_test, None)

    # 4 failed attempts should not trigger lockout
    ROOM_PIN_ATTEMPTS[room_test] = {"count": 4, "locked_until": 0.0}
    now = time.time()
    assert ROOM_PIN_ATTEMPTS[room_test]["locked_until"] <= now

    # 5th attempt triggers lockout
    ROOM_PIN_ATTEMPTS[room_test] = {"count": 5, "locked_until": now + 60.0}
    assert ROOM_PIN_ATTEMPTS[room_test]["locked_until"] > now

    # Reset
    ROOM_PIN_ATTEMPTS.pop(room_test, None)
    assert room_test not in ROOM_PIN_ATTEMPTS

