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

"""A tiny in-process signal (observer) implementation.

This is a dependency-free replacement for the small subset of the ``blinker``
library that Streamlit uses. The :class:`Signal` API mirrors ``blinker.Signal``
closely enough that call sites only need to change their import:

- ``connect(receiver, sender=ANY, weak=True)`` registers a receiver. As in
  blinker, receivers are tracked with a :mod:`weakref` by default so they are
  automatically disconnected when garbage collected. Bound methods are tracked
  with :class:`weakref.WeakMethod` so the receiver stays alive exactly as long
  as the object it is bound to.
- ``send(sender=None, **kwargs)`` calls every receiver registered for ``sender``
  or for :data:`ANY`, passing ``sender`` as the first positional argument along
  with ``kwargs``. It returns a list of ``(receiver, return_value)`` tuples.
- ``disconnect(receiver, sender=ANY)`` removes a receiver.
- ``has_receivers_for(sender)`` reports whether a matching receiver exists.

Receivers are identified by a stable identity (mirroring blinker's ``make_id``)
so that connecting and later disconnecting the *same* callable works even though
Python may create distinct bound-method objects for each attribute access.
"""

from __future__ import annotations

import inspect
import sys
import weakref
from collections import defaultdict
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Callable, Generator, Hashable


class _Symbol:
    """A constant, self-describing sentinel (nicer repr than ``object()``)."""

    def __init__(self, name: str) -> None:
        self.name = name

    def __repr__(self) -> str:
        return self.name


ANY = _Symbol("ANY")
"""Sentinel meaning "receiver is called for every sender"."""

# Senders are keyed by their identity; ANY uses a fixed sentinel id. This relies
# on senders never being the integer ``0`` (``_make_id`` returns ints unchanged),
# which holds for Streamlit's usage where senders are objects or strings. This
# mirrors blinker, which likewise reserves a fixed id for ANY.
_ANY_ID = 0


def _make_id(obj: object) -> Hashable:
    """Return a stable identifier for a receiver or sender.

    Bound methods do not have a stable ``id()``, but the underlying function and
    instance do, so we key on both. Strings and ints are used directly since
    equal values hash equally.
    """
    if inspect.ismethod(obj):
        return (id(obj.__func__), id(obj.__self__))
    if isinstance(obj, (str, int)):
        return obj
    return id(obj)


def _make_ref(
    obj: Any, callback: Callable[[weakref.ref[Any]], None] | None = None
) -> weakref.ref[Any]:
    """Create a weak reference, using WeakMethod for bound methods."""
    if inspect.ismethod(obj):
        return weakref.WeakMethod(obj, callback)
    return weakref.ref(obj, callback)


class Signal:
    """A notification emitter (a minimal ``blinker.Signal`` replacement)."""

    ANY = ANY

    def __init__(self, doc: str | None = None) -> None:
        if doc:
            self.__doc__ = doc

        # Maps a receiver id to either the receiver itself (strong reference)
        # or a weakref to it. Checking the truthiness of this dict is part of
        # the public contract (``if signal.receivers:``).
        self.receivers: dict[Hashable, weakref.ref[Any] | Callable[..., Any]] = {}
        self._by_receiver: dict[Hashable, set[Hashable]] = defaultdict(set)
        self._by_sender: dict[Hashable, set[Hashable]] = defaultdict(set)
        self._weak_senders: dict[Hashable, weakref.ref[Any]] = {}

    def connect(
        self, receiver: Callable[..., Any], sender: Any = ANY, weak: bool = True
    ) -> Callable[..., Any]:
        """Connect ``receiver`` to be called when the signal is sent.

        Parameters
        ----------
        receiver
            The callable invoked on :meth:`send`, receiving ``sender`` as its
            first positional argument plus any keyword arguments.
        sender
            Only call ``receiver`` when :meth:`send` is called with this sender.
            :data:`ANY` (the default) matches every sender.
        weak
            Track the receiver with a weakref (the default). Set ``False`` when
            connecting a function/closure that would otherwise be collected as
            soon as the enclosing scope exits.
        """
        receiver_id = _make_id(receiver)
        sender_id = _ANY_ID if sender is ANY else _make_id(sender)

        if weak:
            self.receivers[receiver_id] = _make_ref(
                receiver, self._make_cleanup_receiver(receiver_id)
            )
        else:
            self.receivers[receiver_id] = receiver

        self._by_sender[sender_id].add(receiver_id)
        self._by_receiver[receiver_id].add(sender_id)

        if sender is not ANY and sender_id not in self._weak_senders:
            try:
                self._weak_senders[sender_id] = _make_ref(
                    sender, self._make_cleanup_sender(sender_id)
                )
            except TypeError:
                # The sender does not support weak references (e.g. str/int).
                pass

        return receiver

    def send(self, sender: Any = None, **kwargs: Any) -> list[tuple[Any, Any]]:
        """Call all receivers connected to ``sender`` or :data:`ANY`.

        Returns a list of ``(receiver, return_value)`` tuples. Exceptions raised
        by a receiver propagate to the caller.
        """
        return [
            (receiver, receiver(sender, **kwargs))
            for receiver in self.receivers_for(sender)
        ]

    def has_receivers_for(self, sender: Any) -> bool:
        """Return whether any receiver would be called for ``sender``.

        Does not verify that weakly referenced receivers are still alive; see
        :meth:`receivers_for` for a stronger check.
        """
        if not self.receivers:
            return False
        if self._by_sender[_ANY_ID]:
            return True
        if sender is ANY:
            return False
        return _make_id(sender) in self._by_sender

    def receivers_for(self, sender: Any) -> Generator[Callable[..., Any], None, None]:
        """Yield the live receivers to call for ``sender`` (plus :data:`ANY`).

        Weakly referenced receivers that have been collected are disconnected
        and skipped.
        """
        if not self.receivers:
            return

        sender_id = _make_id(sender)

        if sender_id in self._by_sender:
            ids = self._by_sender[_ANY_ID] | self._by_sender[sender_id]
        else:
            ids = self._by_sender[_ANY_ID].copy()

        for receiver_id in ids:
            receiver = self.receivers.get(receiver_id)
            if receiver is None:
                continue

            if isinstance(receiver, weakref.ref):
                strong = receiver()
                if strong is None:
                    self._disconnect(receiver_id, _ANY_ID)
                    continue
                yield strong
            else:
                yield receiver

    def disconnect(self, receiver: Callable[..., Any], sender: Any = ANY) -> None:
        """Disconnect ``receiver`` (from ``sender``, or from all senders)."""
        sender_id = _ANY_ID if sender is ANY else _make_id(sender)
        receiver_id = _make_id(receiver)
        self._disconnect(receiver_id, sender_id)

    def _disconnect(self, receiver_id: Hashable, sender_id: Hashable) -> None:
        if sender_id == _ANY_ID:
            if self._by_receiver.pop(receiver_id, None) is not None:
                for bucket in self._by_sender.values():
                    bucket.discard(receiver_id)
            self.receivers.pop(receiver_id, None)
        else:
            self._by_sender[sender_id].discard(receiver_id)
            self._by_receiver[receiver_id].discard(sender_id)

    def _make_cleanup_receiver(
        self, receiver_id: Hashable
    ) -> Callable[[weakref.ref[Any]], None]:
        """Return a weakref callback that disconnects a collected receiver."""

        def cleanup(_ref: weakref.ref[Any]) -> None:
            # Disconnecting during interpreter shutdown can raise a spurious
            # ignored exception, so skip cleanup in that case.
            if not sys.is_finalizing():
                self._disconnect(receiver_id, _ANY_ID)

        return cleanup

    def _make_cleanup_sender(
        self, sender_id: Hashable
    ) -> Callable[[weakref.ref[Any]], None]:
        """Return a weakref callback that drops a collected sender's routing."""

        def cleanup(_ref: weakref.ref[Any]) -> None:
            self._weak_senders.pop(sender_id, None)
            for receiver_id in self._by_sender.pop(sender_id, ()):
                self._by_receiver[receiver_id].discard(sender_id)

        return cleanup
