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

"""Session-scoped manager for ``st.text_input`` suggestion sources.

This copies the lock / uuid / fragment-aware ref-clearing / orphan-prune
lifecycle of :class:`~streamlit.runtime.dataframe_source_manager.DataframeSourceManager`
rather than sharing a base class. Two deliberate departures:

- Sources are keyed on the widget ``element_id``, not delta-path coordinates.
  Coordinates shift when a conditional element appears above a keyed widget.
- ``source_id`` is minted once per ``(session_id, element_id)`` and kept across
  reruns. Re-registration replaces ``func`` / ``max_chars`` behind the same id.
  The assignment map outlives the per-rerun ref map and is dropped when the
  source itself is pruned.
"""

from __future__ import annotations

import collections
import threading
import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from itertools import islice
from typing import TYPE_CHECKING, Final

from streamlit.runtime.runtime_util import get_max_message_size_bytes

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

_AUTOCOMPLETE_MAX_RESULTS: Final = 50
_AUTOCOMPLETE_TEXT_CEILING: Final = 4096
_AUTOCOMPLETE_ITEM_CEILING: Final = 4096
# Slack for request_id, source_id, echoed text (up to the text ceiling), and
# protobuf tags so an oversized ``BackendOperationResponse`` is never rewritten
# into an exception delta.
_AUTOCOMPLETE_ENVELOPE_SLACK_BYTES: Final = 8192
# Conservative per-string protobuf overhead (tag + length varint).
_PROTO_STRING_OVERHEAD_BYTES: Final = 5


class AutocompleteSourceError(Exception):
    """Raised when a suggestion request cannot be served.

    The message is safe to surface to the frontend (it does not include
    sensitive connection details). Only a ``source_id`` belonging to a
    different session uses this path; an unknown / expired source fails closed
    to an empty list instead.
    """


def _get_session_id() -> str:
    """Return the active AppSession's session id (mirrors MediaFileManager)."""
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()
    if ctx is None:
        # Only None when running "python myscript.py" rather than
        # "streamlit run myscript.py"; the session id doesn't matter then.
        return "dontcare"
    return ctx.session_id


def _get_fragment_id() -> str | None:
    """Return the active fragment id, if source registration happens in one."""
    from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState

    try:
        return ThreadState.get().fragment_id
    except RuntimeError:
        return None


def _tighten_ceiling(max_chars: int | None, absolute: int) -> int:
    """Return the effective character ceiling; ``max_chars`` may only tighten it."""
    if max_chars is None:
        return absolute
    return min(absolute, max_chars)


def normalize_suggestions(result: object, *, max_chars: int | None = None) -> list[str]:
    """Cap and sanitize a suggestion source's return value.

    A bare ``str`` is itself a ``Sequence[str]`` but would split into characters,
    so it is rejected. Non-iterables, mappings, and ``bytes`` fail closed to
    ``[]``. Items that are not ``str``, or that exceed the per-item ceiling
    (which ``max_chars`` may only tighten), are dropped rather than rewritten.
    At most ``_AUTOCOMPLETE_MAX_RESULTS`` items are kept, walking at most
    N+1 values so an unbounded generator is not materialized. Trailing items
    that would overflow the websocket message-size limit are dropped.
    """
    if result is None or isinstance(result, (str, bytes, bytearray, Mapping)):
        return []

    if not isinstance(result, Iterable):
        return []

    item_ceiling = _tighten_ceiling(max_chars, _AUTOCOMPLETE_ITEM_CEILING)
    max_encoded_bytes = (
        get_max_message_size_bytes() - _AUTOCOMPLETE_ENVELOPE_SLACK_BYTES
    )
    if max_encoded_bytes <= 0:
        return []

    suggestions: list[str] = []
    encoded = 0
    for item in islice(result, _AUTOCOMPLETE_MAX_RESULTS + 1):
        if len(suggestions) >= _AUTOCOMPLETE_MAX_RESULTS:
            break
        if not isinstance(item, str):
            continue
        if len(item) > item_ceiling:
            continue
        item_size = len(item.encode("utf-8")) + _PROTO_STRING_OVERHEAD_BYTES
        if encoded + item_size > max_encoded_bytes:
            break
        suggestions.append(item)
        encoded += item_size
    return suggestions


def query_exceeds_autocomplete_limit(text: str, max_chars: int | None) -> bool:
    """True when inbound ``text`` is over the absolute (or tightened) ceiling."""
    return len(text) > _tighten_ceiling(max_chars, _AUTOCOMPLETE_TEXT_CEILING)


@dataclass(frozen=True)
class RegisteredAutocompleteSource:
    """Metadata returned when a suggestion source is registered."""

    func: Callable[[str], Sequence[str]]
    source_id: str
    session_id: str
    element_id: str
    fragment_id: str | None
    max_chars: int | None


class AutocompleteSourceManager:
    """Tracks suggestion sources per session and serves lookups."""

    def __init__(self) -> None:
        # source_id -> RegisteredAutocompleteSource
        self._sources: dict[str, RegisteredAutocompleteSource] = {}
        # session_id -> {element_id -> source_id} (per-rerun refs)
        self._refs_by_session_and_element: dict[str, dict[str, str]] = (
            collections.defaultdict(dict)
        )
        # session_id -> {element_id -> source_id} (stable assignment; outlives refs)
        self._source_id_by_session_and_element: dict[str, dict[str, str]] = (
            collections.defaultdict(dict)
        )
        # Re-entrant-free lock guarding the maps above. User callables run
        # outside the lock to avoid blocking registration/cleanup.
        self._lock = threading.Lock()

    def register_source(
        self,
        func: Callable[[str], Sequence[str]],
        *,
        element_id: str,
        max_chars: int | None,
    ) -> RegisteredAutocompleteSource:
        """Register ``func`` for the current session at ``element_id``.

        Reuses a previously minted ``source_id`` for the same
        ``(session_id, element_id)`` so in-flight frontend requests stay valid
        across reruns. The stored callable, ``max_chars``, and ``fragment_id``
        are replaced on each registration.
        """
        session_id = _get_session_id()
        fragment_id = _get_fragment_id()

        with self._lock:
            stable_map = self._source_id_by_session_and_element[session_id]
            source_id = stable_map.get(element_id)
            if source_id is None:
                source_id = uuid.uuid4().hex
                stable_map[element_id] = source_id

            entry = RegisteredAutocompleteSource(
                func=func,
                source_id=source_id,
                session_id=session_id,
                element_id=element_id,
                fragment_id=fragment_id,
                max_chars=max_chars,
            )
            self._sources[source_id] = entry
            self._refs_by_session_and_element[session_id][element_id] = source_id

        return entry

    def get_suggestions(self, session_id: str, source_id: str, text: str) -> list[str]:
        """Call the registered source and return a normalized suggestion list.

        An unknown or expired ``source_id`` returns ``[]``. A ``source_id``
        belonging to a different session raises :class:`AutocompleteSourceError`.
        Oversized inbound ``text`` is rejected (not truncated) before the
        callable runs.
        """
        with self._lock:
            entry = self._sources.get(source_id)

        if entry is None:
            return []
        if entry.session_id != session_id:
            raise AutocompleteSourceError(
                "Autocomplete source does not belong to session."
            )

        if query_exceeds_autocomplete_limit(text, entry.max_chars):
            return []

        result = entry.func(text)
        return normalize_suggestions(result, max_chars=entry.max_chars)

    def clear_session_refs(
        self,
        session_id: str | None = None,
        *,
        fragment_ids: set[str] | list[str] | tuple[str, ...] | None = None,
    ) -> None:
        """Drop element-id references for a session (does not delete sources).

        Call without ``fragment_ids`` at the start of a full rerun and on
        session shutdown. For fragment reruns, pass the fragment ids that are
        about to run so refs owned by those fragments are dropped while refs in
        the app body and untouched fragments stay active. Sources are actually
        removed by ``remove_orphaned_sources``. Stable ``source_id`` assignments
        are kept so a re-registered widget reuses its id.
        """
        if session_id is None:
            session_id = _get_session_id()

        with self._lock:
            if fragment_ids is None:
                self._refs_by_session_and_element.pop(session_id, None)
                return

            fragment_id_set = set(fragment_ids)
            if not fragment_id_set:
                return

            element_map = self._refs_by_session_and_element.get(session_id)
            if element_map is None:
                return

            for element_id, source_id in list(element_map.items()):
                entry = self._sources.get(source_id)
                if entry is not None and entry.fragment_id in fragment_id_set:
                    del element_map[element_id]

            if not element_map:
                self._refs_by_session_and_element.pop(session_id, None)

    def remove_orphaned_sources(self) -> None:
        """Delete sources no longer referenced by any session.

        Also drops the matching stable ``source_id`` assignment so a later
        widget at the same element id mints a fresh id.
        """
        with self._lock:
            referenced: set[str] = set()
            for element_map in self._refs_by_session_and_element.values():
                referenced.update(element_map.values())

            orphaned = [
                source_id for source_id in self._sources if source_id not in referenced
            ]
            for source_id in orphaned:
                entry = self._sources.pop(source_id)
                stable_map = self._source_id_by_session_and_element.get(
                    entry.session_id
                )
                if stable_map is None:
                    continue
                if stable_map.get(entry.element_id) == source_id:
                    del stable_map[entry.element_id]
                if not stable_map:
                    self._source_id_by_session_and_element.pop(entry.session_id, None)

    def clear_all_for_session(self, session_id: str) -> None:
        """Remove all references, stable ids, and sources for a session."""
        self.clear_session_refs(session_id)
        with self._lock:
            self._source_id_by_session_and_element.pop(session_id, None)
        self.remove_orphaned_sources()

    def get_source_count(self) -> int:
        """Return the number of registered sources (for tests/debugging)."""
        with self._lock:
            return len(self._sources)
