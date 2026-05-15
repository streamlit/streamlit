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

"""Session-scoped manager for lazy dataframe sources.

This module manages the lifecycle of lazy dataframe sources within a session.
Sources are registered during script execution and cleaned up when the session
ends or the element disappears.

The lifecycle follows the media-file reference pattern:
- On full rerun: clear active refs before script, register during render, prune after finish
- On fragment rerun: only replace sources re-rendered by that fragment
- On session shutdown: clear all sources for that session
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from streamlit.dataframe.source import DataframeSourceProtocol

_LOGGER: Final = get_logger(__name__)


@dataclass
class RegisteredSource:
    """A registered lazy dataframe source with its metadata."""

    source: DataframeSourceProtocol
    generation: str
    delta_path: str
    fragment_id: str | None = None


@dataclass
class DataframeSourceManager:
    """Session-scoped manager for lazy dataframe sources.

    This manager handles the lifecycle of lazy dataframe sources within a session.
    It follows the media-file reference pattern for cleanup.

    Attributes
    ----------
    _sources : dict[str, RegisteredSource]
        Map of source_id to registered source.
    _active_delta_paths : set[str]
        Set of delta paths that were registered in the current script run.
    _lock : threading.RLock
        Lock for thread-safe operations.
    """

    _sources: dict[str, RegisteredSource] = field(default_factory=dict)
    _active_delta_paths: set[str] = field(default_factory=set)
    _lock: threading.RLock = field(default_factory=threading.RLock)

    def register_source(
        self,
        source: DataframeSourceProtocol,
        delta_path: str,
        fragment_id: str | None = None,
    ) -> tuple[str, str]:
        """Register a lazy dataframe source.

        Parameters
        ----------
        source : DataframeSourceProtocol
            The lazy dataframe source to register.
        delta_path : str
            The delta path identifying this element's location.
        fragment_id : str | None
            The fragment ID if this is a fragment rerun, None otherwise.

        Returns
        -------
        tuple[str, str]
            A tuple of (source_id, generation) for this source.
        """
        with self._lock:
            # Remove existing sources with the same delta_path to prevent memory leaks
            # when a script reruns and re-registers sources for the same delta paths.
            to_remove = [
                sid
                for sid, registered in self._sources.items()
                if registered.delta_path == delta_path
            ]
            for sid in to_remove:
                del self._sources[sid]
                _LOGGER.debug(
                    "Replaced existing source %s at delta_path %s", sid, delta_path
                )

            source_id = str(uuid.uuid4())
            generation = str(uuid.uuid4())

            self._sources[source_id] = RegisteredSource(
                source=source,
                generation=generation,
                delta_path=delta_path,
                fragment_id=fragment_id,
            )
            self._active_delta_paths.add(delta_path)

            _LOGGER.debug(
                "Registered lazy dataframe source %s at %s (generation=%s)",
                source_id,
                delta_path,
                generation,
            )

            return source_id, generation

    def get_source(
        self,
        source_id: str,
        generation: str,
    ) -> DataframeSourceProtocol | None:
        """Get a registered source by ID and generation.

        Parameters
        ----------
        source_id : str
            The source ID to look up.
        generation : str
            The expected generation for validation.

        Returns
        -------
        DataframeSourceProtocol | None
            The source if found and generation matches, None otherwise.
        """
        with self._lock:
            registered = self._sources.get(source_id)
            if registered is None:
                _LOGGER.debug("Source %s not found", source_id)
                return None

            if registered.generation != generation:
                _LOGGER.debug(
                    "Source %s generation mismatch: expected %s, got %s",
                    source_id,
                    registered.generation,
                    generation,
                )
                return None

            return registered.source

    def clear_active_refs(self, fragment_id: str | None = None) -> None:
        """Clear active delta path references before a script run.

        Parameters
        ----------
        fragment_id : str | None
            If provided, only clear refs for this fragment. Otherwise clear all.
        """
        with self._lock:
            if fragment_id is None:
                # Full rerun: clear all active refs
                self._active_delta_paths.clear()
                _LOGGER.debug("Cleared all active delta path refs")
            else:
                # Fragment rerun: clear only refs for this fragment
                # Note: We track active refs by delta path, so we need to
                # look at which sources belong to this fragment
                fragment_paths = {
                    registered.delta_path
                    for registered in self._sources.values()
                    if registered.fragment_id == fragment_id
                }
                self._active_delta_paths -= fragment_paths
                _LOGGER.debug(
                    "Cleared active refs for fragment %s: %s",
                    fragment_id,
                    fragment_paths,
                )

    def prune_unreferenced_sources(self, fragment_id: str | None = None) -> None:
        """Remove sources that were not re-registered during the script run.

        Parameters
        ----------
        fragment_id : str | None
            If provided, only prune sources for this fragment. Otherwise prune
            all sources not in the active refs.
        """
        with self._lock:
            to_remove: list[str] = []

            for source_id, registered in self._sources.items():
                # For fragment reruns, only consider sources from this fragment
                if fragment_id is not None and registered.fragment_id != fragment_id:
                    continue

                # If the delta path is not in active refs, the source should be pruned
                if registered.delta_path not in self._active_delta_paths:
                    to_remove.append(source_id)

            for source_id in to_remove:
                del self._sources[source_id]
                _LOGGER.debug("Pruned unreferenced source %s", source_id)

    def clear_all(self) -> None:
        """Clear all sources. Called on session shutdown."""
        with self._lock:
            source_count = len(self._sources)
            self._sources.clear()
            self._active_delta_paths.clear()
            _LOGGER.debug("Cleared all %d sources on session shutdown", source_count)

    @property
    def source_count(self) -> int:
        """Return the number of registered sources."""
        with self._lock:
            return len(self._sources)
