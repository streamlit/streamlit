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

"""Session-scoped manager for lazy ``st.dataframe`` row sources.

This mirrors the reference/prune lifecycle of
:class:`~streamlit.runtime.media_file_manager.MediaFileManager`, but serves
short-lived Arrow row chunks instead of media-file URLs.

Lifecycle:
- ``register_source`` is called while a script runs, keyed by the dataframe
  element's delta-path coordinates. Re-registering at the same coordinates
  replaces the previous source with a new ``source_id`` so stale in-flight
  chunk responses are ignored by the frontend.
- ``clear_session_refs`` drops a session's coordinate references at the start of
  a full rerun (skipped for fragment reruns, like media files).
- ``remove_orphaned_sources`` prunes sources no longer referenced by any session
  after a script finishes.
- ``clear_all_for_session`` removes everything for a session on shutdown.

The manager is runtime-scoped with session-keyed internal maps. ``source_id`` is
an unguessable token and chunk requests are validated against the requesting
session.
"""

from __future__ import annotations

import collections
import threading
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING

from streamlit import dataframe_util
from streamlit.dataframe.lazy_df_source import (
    DEFAULT_PAGE_SIZE,
    MAX_CHUNK_ROWS,
    SortSpec,
)

if TYPE_CHECKING:
    from streamlit.dataframe.lazy_df_source import DataframeSource


class DataframeSourceError(Exception):
    """Raised when a lazy dataframe chunk request cannot be served.

    The message is safe to surface to the frontend (it does not include
    sensitive connection details).
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


@dataclass(frozen=True)
class RegisteredDataframeSource:
    """Metadata returned when a lazy dataframe source is registered."""

    source: DataframeSource
    source_id: str
    page_size: int
    session_id: str
    coordinates: str
    fragment_id: str | None


class DataframeSourceManager:
    """Tracks lazy dataframe sources per session and serves row chunks."""

    def __init__(self) -> None:
        # source_id -> RegisteredDataframeSource
        self._sources: dict[str, RegisteredDataframeSource] = {}
        # session_id -> {coordinates -> source_id}
        self._sources_by_session_and_coord: dict[str, dict[str, str]] = (
            collections.defaultdict(dict)
        )
        # Re-entrant-free lock guarding the maps above. Source loading happens
        # outside the lock to avoid blocking registration/cleanup.
        self._lock = threading.Lock()

    def register_source(
        self,
        source: DataframeSource,
        coordinates: str,
        *,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> RegisteredDataframeSource:
        """Register ``source`` for the current session at ``coordinates``.

        Returns the registration metadata, including a fresh ``source_id``.
        """
        session_id = _get_session_id()
        fragment_id = _get_fragment_id()
        source_id = uuid.uuid4().hex
        entry = RegisteredDataframeSource(
            source=source,
            source_id=source_id,
            page_size=page_size,
            session_id=session_id,
            coordinates=coordinates,
            fragment_id=fragment_id,
        )

        with self._lock:
            self._sources[source_id] = entry
            # Overwriting the coordinate mapping orphans any previous source at
            # the same location; it is pruned by remove_orphaned_sources().
            self._sources_by_session_and_coord[session_id][coordinates] = source_id

        return entry

    def load_chunk(
        self,
        session_id: str,
        source_id: str,
        offset: int,
        limit: int,
        sort: SortSpec | None,
    ) -> tuple[bytes, int]:
        """Load a row range and return ``(arrow_ipc_bytes, offset)``.

        Validates that ``source_id`` belongs to ``session_id`` before loading
        any data.

        Raises
        ------
        DataframeSourceError
            If the source is unknown, belongs to another session, or the
            request is invalid.
        """
        with self._lock:
            entry = self._sources.get(source_id)

        if entry is None:
            raise DataframeSourceError("Dataframe source not found or expired.")
        if entry.session_id != session_id:
            raise DataframeSourceError("Dataframe source does not belong to session.")

        if offset < 0:
            raise DataframeSourceError("Chunk offset must be non-negative.")

        # Clamp the limit to a hard maximum to prevent a modified client from
        # requesting arbitrarily large chunks.
        capped_limit = min(max(limit, 0), MAX_CHUNK_ROWS)

        # Short-circuit out-of-bounds requests with an empty (schema-only) chunk
        # instead of running a row query. This avoids unnecessary work for deep
        # offsets, which can be expensive for some native lazy sources.
        #
        # Known-size sources report an integer ``row_count``. Future unknown-size
        # sequential sources report ``row_count=None``; for those the offset can
        # never be proven out of bounds up front, so we skip the short-circuit and
        # let the source decide when it is exhausted.
        row_count = entry.source.row_count
        if row_count is not None and offset >= row_count:
            empty_table = entry.source.schema.empty_table()
            arrow_bytes = dataframe_util.convert_arrow_table_to_arrow_bytes(empty_table)
            return arrow_bytes, offset

        table = entry.source.load_rows(offset, capped_limit, sort=sort)
        arrow_bytes = dataframe_util.convert_arrow_table_to_arrow_bytes(table)
        return arrow_bytes, offset

    def clear_session_refs(
        self,
        session_id: str | None = None,
        *,
        fragment_ids: set[str] | list[str] | tuple[str, ...] | None = None,
    ) -> None:
        """Drop coordinate references for a session (does not delete sources).

        Call without ``fragment_ids`` at the start of a full rerun and on
        session shutdown. For fragment reruns, pass the fragment ids that are
        about to run so refs owned by those fragments are dropped while refs in
        the app body and untouched fragments stay active. Sources are actually
        removed by ``remove_orphaned_sources``.
        """
        if session_id is None:
            session_id = _get_session_id()

        with self._lock:
            if fragment_ids is None:
                self._sources_by_session_and_coord.pop(session_id, None)
                return

            fragment_id_set = set(fragment_ids)
            if not fragment_id_set:
                return

            coord_map = self._sources_by_session_and_coord.get(session_id)
            if coord_map is None:
                return

            for coordinates, source_id in list(coord_map.items()):
                entry = self._sources.get(source_id)
                if entry is not None and entry.fragment_id in fragment_id_set:
                    del coord_map[coordinates]

            if not coord_map:
                self._sources_by_session_and_coord.pop(session_id, None)

    def remove_orphaned_sources(self) -> None:
        """Delete sources no longer referenced by any session."""
        with self._lock:
            referenced: set[str] = set()
            for coord_map in self._sources_by_session_and_coord.values():
                referenced.update(coord_map.values())

            orphaned = [
                source_id for source_id in self._sources if source_id not in referenced
            ]
            for source_id in orphaned:
                del self._sources[source_id]

    def clear_all_for_session(self, session_id: str) -> None:
        """Remove all references and sources for a session (shutdown path)."""
        self.clear_session_refs(session_id)
        self.remove_orphaned_sources()

    def get_source_count(self) -> int:
        """Return the number of registered sources (for tests/debugging)."""
        with self._lock:
            return len(self._sources)
