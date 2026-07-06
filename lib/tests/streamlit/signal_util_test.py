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

from streamlit.signal_util import ANY, Signal


class _Receiver:
    """A helper receiver object used to test bound-method (weak) connections."""

    def __init__(self) -> None:
        self.calls: list[tuple[object, dict[str, object]]] = []

    def on_signal(self, sender: object, **kwargs: object) -> str:
        self.calls.append((sender, kwargs))
        return "handled"


def test_send_calls_receiver_with_sender_and_kwargs():
    """send() passes the sender positionally and forwards keyword arguments."""
    sig = Signal()
    received: list[tuple[object, dict[str, object]]] = []

    def receiver(sender: object, **kwargs: object) -> None:
        received.append((sender, kwargs))

    sig.connect(receiver, weak=False)
    sig.send("the-sender", event="x")

    assert received == [("the-sender", {"event": "x"})]


def test_send_returns_receiver_result_pairs():
    """send() returns a list of (receiver, return_value) tuples."""
    sig = Signal()

    def receiver(_sender: object, **_kwargs: object) -> int:
        return 42

    sig.connect(receiver, weak=False)
    results = sig.send()

    assert results == [(receiver, 42)]


def test_send_with_no_receivers_returns_empty_list():
    """Sending a signal with no receivers is a no-op that returns []."""
    assert Signal().send("sender") == []


def test_default_sender_is_none():
    """send() with no argument passes None as the sender."""
    sig = Signal()
    seen: list[object] = []
    sig.connect(lambda sender, **_kw: seen.append(sender), weak=False)

    sig.send()

    assert seen == [None]


def test_weak_bound_method_is_auto_disconnected_on_gc():
    """A weakly-connected bound method is dropped once its object is collected."""
    sig = Signal()
    receiver = _Receiver()
    sig.connect(receiver.on_signal)  # weak=True by default

    sig.send("s", value=1)
    assert receiver.calls == [("s", {"value": 1})]
    assert sig.has_receivers_for(ANY) is True

    del receiver
    gc.collect()

    # The dead weak receiver is skipped and pruned.
    assert sig.send("s") == []
    assert sig.has_receivers_for(ANY) is False


def test_weak_false_receiver_is_retained():
    """A non-weak receiver survives even without an external strong reference."""
    sig = Signal()

    def make_and_connect() -> None:
        def receiver(_sender: object, **_kwargs: object) -> None:
            pass

        sig.connect(receiver, weak=False)

    make_and_connect()
    gc.collect()

    # The closure is not collected because weak=False keeps a strong reference.
    assert sig.has_receivers_for(ANY) is True
    assert len(sig.send("s")) == 1


def test_disconnect_uses_stable_identity_for_bound_methods():
    """disconnect() matches a bound method even though each access is a new object."""
    sig = Signal()
    receiver = _Receiver()

    sig.connect(receiver.on_signal)
    # A freshly-accessed bound method compares unequal by identity but must still
    # resolve to the same receiver for disconnect purposes.
    sig.disconnect(receiver.on_signal)

    assert sig.send("s") == []
    assert sig.has_receivers_for(ANY) is False


def test_sender_specific_receiver_only_called_for_that_sender():
    """A receiver bound to a specific sender ignores other senders."""
    sig = Signal()
    seen: list[object] = []
    sig.connect(lambda sender, **_kw: seen.append(sender), sender="a", weak=False)

    sig.send("b")  # different sender -> not delivered
    assert seen == []

    sig.send("a")  # matching sender -> delivered
    assert seen == ["a"]


def test_any_receiver_called_for_every_sender():
    """A receiver connected to ANY is called regardless of the sender."""
    sig = Signal()
    seen: list[object] = []
    sig.connect(lambda sender, **_kw: seen.append(sender), sender=ANY, weak=False)

    sig.send("a")
    sig.send("b")

    assert seen == ["a", "b"]


def test_has_receivers_for_specific_and_any():
    """has_receivers_for reflects both sender-specific and ANY registrations."""
    sig = Signal()
    assert sig.has_receivers_for("a") is False

    sig.connect(lambda *_a, **_k: None, sender="a", weak=False)
    assert sig.has_receivers_for("a") is True
    # No ANY receiver, so a different sender has none, and ANY itself has none.
    assert sig.has_receivers_for("b") is False
    assert sig.has_receivers_for(ANY) is False


def test_string_sender_without_weakref_support():
    """Non-weakref-able senders (e.g. str) still route correctly.

    Mirrors event_based_path_watcher, which sends the changed path (a str) as sender.
    """
    sig = Signal()
    seen: list[object] = []
    sig.connect(lambda sender, **_kw: seen.append(sender), weak=False)

    sig.send("/some/path")

    assert seen == ["/some/path"]
