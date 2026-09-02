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

"""Synchronous in-process signals for Streamlit internals.

Intentionally minimal: receivers get every event (no per-sender filtering),
return values are discarded, and async receivers are unsupported. Add
capabilities only when a call site needs them.
"""

from __future__ import annotations

import inspect
import threading
import weakref
from collections.abc import Callable
from typing import Any, TypeAlias

_Receiver: TypeAlias = Callable[..., Any]
_ReceiverKey: TypeAlias = int | tuple[int, int]
_StoredReceiver: TypeAlias = _Receiver | weakref.ReferenceType[_Receiver]


class Signal:
    """Broadcast synchronous events to connected receivers."""

    def __init__(self) -> None:
        self._receivers: dict[_ReceiverKey, _StoredReceiver] = {}
        # RLock: a weakref callback may re-enter remove_receiver while the
        # registry lock is held.
        self._lock = threading.RLock()

    def connect(self, receiver: _Receiver, *, weak: bool = True) -> _Receiver:
        """Connect a receiver and return it, so this also works as a decorator.

        Connections are weak by default: the signal does not keep the receiver
        alive, so a receiver with no other strong reference (a lambda or nested
        function) is dropped right away. Pass ``weak=False`` to let the signal
        own the receiver until it is disconnected.
        """
        receiver_key = _get_receiver_key(receiver)
        stored_receiver: _StoredReceiver

        if weak:
            # Weak so the cleanup callback does not keep this signal alive.
            signal_ref = weakref.ref(self)

            def remove_receiver(receiver_ref: weakref.ReferenceType[Any]) -> None:
                signal = signal_ref()
                if signal is None:
                    return  # pragma: no cover - defensive

                with signal._lock:
                    # Skip if connect() later stored a different receiver at this key.
                    if signal._receivers.get(receiver_key) is not receiver_ref:
                        return  # pragma: no cover - defensive
                    del signal._receivers[receiver_key]

            if inspect.ismethod(receiver):
                # A bound method is created fresh on each attribute access, so a
                # plain weakref would die as soon as connect() returns. WeakMethod
                # tracks the underlying instance instead.
                stored_receiver = weakref.WeakMethod(receiver, remove_receiver)
            else:
                stored_receiver = weakref.ref(receiver, remove_receiver)
        else:
            stored_receiver = receiver

        with self._lock:
            self._receivers[receiver_key] = stored_receiver

        return receiver

    def disconnect(self, receiver: _Receiver) -> None:
        """Disconnect a receiver if it is connected."""
        with self._lock:
            self._receivers.pop(_get_receiver_key(receiver), None)

    def send(self, sender: Any = None, /, **kwargs: Any) -> None:
        """Call each live receiver synchronously, in the order they connected.

        Receivers run against a snapshot, so a receiver may connect or
        disconnect during dispatch. Changes take effect on the next send: a
        receiver disconnected mid-dispatch still runs for the current one. A
        receiver exception propagates to the caller and skips remaining
        receivers.
        """
        for receiver in self._get_live_receivers():
            receiver(sender, **kwargs)

    def has_receivers(self) -> bool:
        """Return whether the signal has any live receivers."""
        return bool(self._get_live_receivers())

    def _get_live_receivers(self) -> list[_Receiver]:
        """Return the live receivers, dropping entries whose weak reference died."""
        live_receivers: list[_Receiver] = []

        with self._lock:
            for receiver_key, stored_receiver in list(self._receivers.items()):
                receiver = (
                    stored_receiver()
                    if isinstance(stored_receiver, weakref.ReferenceType)
                    else stored_receiver
                )
                if receiver is None:  # pragma: no cover - defensive
                    self._receivers.pop(receiver_key, None)
                else:
                    live_receivers.append(receiver)

        return live_receivers


def _get_receiver_key(receiver: _Receiver) -> _ReceiverKey:
    if inspect.ismethod(receiver):
        # Bound methods are recreated on each access. Key by (function, instance)
        # so a fresh `obj.method` still connects and disconnects the same receiver.
        return (id(receiver.__func__), id(receiver.__self__))

    return id(receiver)
