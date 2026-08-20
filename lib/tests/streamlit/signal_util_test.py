# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import gc
import threading
import weakref
from typing import Any
from unittest.mock import Mock

import pytest

from streamlit.signal_util import Signal


class _BoundReceiver:
    def receive(self, sender: object) -> None:
        pass


class _RecordingReceiver:
    def __init__(self) -> None:
        self.received: list[object] = []

    def receive(self, sender: object) -> None:
        self.received.append(sender)


def test_send_without_receivers_is_noop() -> None:
    """Sending without receivers is a no-op."""
    signal = Signal()

    signal.send()


def test_send_forwards_sender_and_kwargs() -> None:
    """Signal payloads are forwarded to each receiver."""
    signal = Signal()
    receiver = Mock()
    signal.connect(receiver, weak=False)

    signal.send()
    signal.send("sender", value=42)

    assert receiver.call_args_list == [
        ((None,), {}),
        (("sender",), {"value": 42}),
    ]


def test_send_calls_each_receiver_once() -> None:
    """Each connected receiver is called once per send."""
    signal = Signal()
    first_receiver = Mock()
    second_receiver = Mock()
    signal.connect(first_receiver, weak=False)
    signal.connect(second_receiver, weak=False)

    signal.send("sender")

    first_receiver.assert_called_once_with("sender")
    second_receiver.assert_called_once_with("sender")


def test_duplicate_connect_and_disconnect_are_idempotent() -> None:
    """Duplicate connection and disconnection do not change delivery counts."""
    signal = Signal()
    receiver = Mock()

    signal.connect(receiver, weak=False)
    signal.connect(receiver, weak=False)
    signal.send()

    receiver.assert_called_once_with(None)

    signal.disconnect(receiver)
    signal.disconnect(receiver)
    signal.send()

    receiver.assert_called_once_with(None)


def test_disconnect_matches_freshly_accessed_bound_method() -> None:
    """A bound method can be disconnected through a fresh attribute access."""
    signal = Signal()
    receiver = _BoundReceiver()
    signal.connect(receiver.receive)

    signal.disconnect(receiver.receive)

    assert not signal.has_receivers()


def test_distinct_instances_of_same_method_are_separate_receivers() -> None:
    """Bound methods of different instances are tracked independently."""
    signal = Signal()
    first = _RecordingReceiver()
    second = _RecordingReceiver()
    signal.connect(first.receive, weak=False)
    signal.connect(second.receive, weak=False)

    signal.disconnect(first.receive)
    signal.send("sender")

    assert first.received == []
    assert second.received == ["sender"]


def test_connect_returns_receiver_for_decorator_form() -> None:
    """connect returns the receiver so @signal.connect keeps the function bound."""
    signal = Signal()
    received: list[object] = []

    @signal.connect
    def receiver(sender: object) -> None:
        received.append(sender)

    signal.send("sender")
    assert received == ["sender"]


def test_weak_bound_receiver_is_dropped_after_gc() -> None:
    """A weakly connected bound method is dropped when its instance is gone."""
    signal = Signal()
    receiver = _BoundReceiver()
    receiver_ref = weakref.ref(receiver)
    signal.connect(receiver.receive)
    assert signal.has_receivers()

    del receiver
    gc.collect()

    assert receiver_ref() is None
    assert not signal.has_receivers()


def test_weak_nested_function_is_dropped_after_gc() -> None:
    """A weakly connected nested function is dropped when no other refs remain."""
    signal = Signal()

    def receiver(sender: object) -> None:
        pass

    receiver_ref = weakref.ref(receiver)
    signal.connect(receiver)
    assert signal.has_receivers()

    del receiver
    gc.collect()

    assert receiver_ref() is None
    assert not signal.has_receivers()


def test_strong_connection_retains_nested_function() -> None:
    """A strong connection retains a nested receiver function."""
    signal = Signal()
    received: list[object] = []

    def connect_receiver() -> weakref.ReferenceType[Any]:
        def receiver(sender: object) -> None:
            received.append(sender)

        receiver_ref = weakref.ref(receiver)
        signal.connect(receiver, weak=False)
        return receiver_ref

    receiver_ref = connect_receiver()
    gc.collect()

    assert receiver_ref() is not None

    signal.send("sender")
    assert received == ["sender"]


def test_receiver_exception_propagates() -> None:
    """Exceptions raised by receivers propagate to the sender."""
    signal = Signal()
    later_receiver = Mock()

    def receiver(sender: object) -> None:
        raise RuntimeError("receiver failed")

    signal.connect(receiver, weak=False)
    signal.connect(later_receiver, weak=False)

    with pytest.raises(RuntimeError, match="receiver failed"):
        signal.send()

    later_receiver.assert_not_called()


def test_receiver_can_mutate_connections_during_send() -> None:
    """A receiver can mutate connections during synchronous dispatch."""
    signal = Signal()
    received: list[str] = []

    def second_receiver(sender: object) -> None:
        received.append("second")

    def first_receiver(sender: object) -> None:
        received.append("first")
        signal.disconnect(first_receiver)
        signal.connect(second_receiver, weak=False)

    signal.connect(first_receiver, weak=False)

    signal.send()
    assert received == ["first"]

    signal.send()
    assert received == ["first", "second"]


def test_receiver_runs_outside_registry_lock() -> None:
    """Dispatch uses a snapshot and does not hold the registry lock."""
    signal = Signal()
    receiver_started = threading.Event()
    release_receiver = threading.Event()
    connections_updated = threading.Event()
    snapshotted_receiver = Mock()
    new_receiver = Mock()

    def blocking_receiver(sender: object) -> None:
        receiver_started.set()
        assert release_receiver.wait(timeout=5)

    signal.connect(blocking_receiver, weak=False)
    signal.connect(snapshotted_receiver, weak=False)

    send_thread = threading.Thread(target=signal.send)
    send_thread.start()
    assert receiver_started.wait(timeout=5)

    def update_connections() -> None:
        signal.connect(new_receiver, weak=False)
        signal.disconnect(blocking_receiver)
        signal.disconnect(snapshotted_receiver)
        connections_updated.set()

    update_thread = threading.Thread(target=update_connections)
    update_thread.start()

    try:
        assert connections_updated.wait(timeout=5)
    finally:
        release_receiver.set()
        send_thread.join(timeout=5)
        update_thread.join(timeout=5)

    assert not send_thread.is_alive()
    assert not update_thread.is_alive()
    snapshotted_receiver.assert_called_once_with(None)

    signal.send("next")
    snapshotted_receiver.assert_called_once_with(None)
    new_receiver.assert_called_once_with("next")
