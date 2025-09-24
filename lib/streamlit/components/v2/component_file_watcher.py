# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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


"""Component file watching utilities.

This module provides the `ComponentFileWatcher`, a utility that watches
component asset directories for changes and notifies a caller-provided callback
with the affected component names. It abstracts the underlying path-watcher
implementation and ensures exception-safe startup and cleanup.

Why this exists
---------------
Streamlit supports advanced Custom Components that ship a package of static
assets (for example, a Vite/Webpack build output). While a user develops their
app, those frontend files may change. The component registry for Custom
Components v2 must stay synchronized with the on-disk assets so that the server
can resolve the up-to-date files.

This watcher exists to keep the registry in sync by listening for changes in
component asset roots and notifying a higher-level manager that can re-resolve
the affected component definitions.

Notes
-----
- Watching is directory-based with a recursive glob ("**/*").
- Common noisy directories (e.g., ``node_modules``) are ignored in callbacks.
- Startup is exception-safe and does not leak partially created watchers.

See Also
--------
- :class:`streamlit.watcher.local_sources_watcher.LocalSourcesWatcher` - watches
  app source files per session to trigger reruns.
- :class:`streamlit.components.v2.component_registry.BidiComponentRegistry` -
  the server-side store of Custom Component v2 definitions that reacts to
  watcher notifications.
"""

from __future__ import annotations

import threading
from typing import TYPE_CHECKING, Final, Protocol, cast

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path


_LOGGER: Final = get_logger(__name__)


class _HasClose(Protocol):
    def close(self) -> None: ...


class ComponentFileWatcher:
    """Handle file watching for component asset directories.

    Parameters
    ----------
    component_update_callback : Callable[[list[str]], None]
        Callback invoked when files change under any watched directory. It
        receives a list of component names affected by the change.
    """

    def __init__(self, component_update_callback: Callable[[list[str]], None]) -> None:
        """Initialize the file watcher.

        Parameters
        ----------
        component_update_callback : Callable[[list[str]], None]
            Callback function to call when components under watched roots change.
            Signature: (affected_component_names)
        """
        self._component_update_callback = component_update_callback
        self._lock = threading.Lock()

        # File watching state
        self._watched_directories: dict[
            str, list[str]
        ] = {}  # directory -> component_names
        self._path_watchers: list[_HasClose] = []  # Store actual watcher instances
        self._watching_active = False

        # Store asset roots to watch: component_name -> asset_root
        self._asset_watch_roots: dict[str, Path] = {}

        # Default noisy directories to ignore in callbacks
        self._ignored_dirs: tuple[str, ...] = (
            "__pycache__",
            ".cache",
            ".git",
            ".hg",
            ".mypy_cache",
            ".pytest_cache",
            ".ruff_cache",
            ".svn",
            ".swc",
            ".yarn",
            "coverage",
            "node_modules",
            "venv",
        )

    @property
    def is_watching_active(self) -> bool:
        """Check if file watching is currently active.

        Returns
        -------
        bool
            True if file watching is active, False otherwise
        """
        return self._watching_active

    def start_file_watching(self, asset_watch_roots: dict[str, Path]) -> None:
        """Start file watching for asset roots.

        Parameters
        ----------
        asset_watch_roots : dict[str, Path]
            Mapping of component names to asset root directories to watch.

        Notes
        -----
        The method is idempotent: it stops any active watchers first, then
        re-initializes watchers for the provided ``asset_watch_roots``.
        """
        # Always stop first to ensure a clean state, then start with the new roots.
        # This sequencing avoids races between concurrent stop/start calls.
        self.stop_file_watching()
        self._start_file_watching(asset_watch_roots)

    def stop_file_watching(self) -> None:
        """Stop file watching and clean up watchers.

        Notes
        -----
        This method is safe to call multiple times and will no-op if
        watching is not active.
        """
        with self._lock:
            if not self._watching_active:
                return

            # Close all path watchers
            for watcher in self._path_watchers:
                try:
                    watcher.close()
                except Exception:  # noqa: PERF203
                    _LOGGER.exception("Failed to close path watcher")

            self._path_watchers.clear()
            self._watched_directories.clear()
            # Also clear asset root references to avoid stale state retention
            self._asset_watch_roots.clear()
            self._watching_active = False
            _LOGGER.debug("Stopped file watching for component registry")

    def _start_file_watching(self, asset_watch_roots: dict[str, Path]) -> None:
        """Internal method to start file watching with the given roots.

        This method is exception-safe: in case of failures while creating
        watchers, any previously created watcher instances are closed and no
        internal state is committed.
        """
        with self._lock:
            if self._watching_active:
                return

            if not asset_watch_roots:
                _LOGGER.debug("No asset roots to watch")
                return

            try:
                path_watcher_class = self._get_default_path_watcher_class()
                if path_watcher_class is None:
                    # NoOp watcher; skip activation
                    return

                directories_to_watch = self._prepare_directories_to_watch(
                    asset_watch_roots
                )

                new_watchers, new_watched_dirs = self._build_watchers_for_directories(
                    path_watcher_class, directories_to_watch
                )

                # Commit new watchers and state only after successful creation
                if new_watchers:
                    self._commit_watch_state(
                        new_watchers, new_watched_dirs, asset_watch_roots
                    )
                else:
                    _LOGGER.debug("No directories were watched; staying inactive")
            except Exception:
                _LOGGER.exception("Failed to start file watching")

    def _get_default_path_watcher_class(self) -> type | None:
        """Return the default path watcher class.

        Returns
        -------
        type | None
            The concrete path watcher class to instantiate, or ``None`` if
            the NoOp watcher is configured and file watching should be
            skipped.
        """
        from streamlit.watcher.path_watcher import (
            NoOpPathWatcher,
            get_default_path_watcher_class,
        )

        path_watcher_class = get_default_path_watcher_class()
        if path_watcher_class is NoOpPathWatcher:
            _LOGGER.debug("NoOpPathWatcher in use; skipping component file watching")
            return None
        return path_watcher_class

    def _prepare_directories_to_watch(
        self, asset_watch_roots: dict[str, Path]
    ) -> dict[str, list[str]]:
        """Build a mapping of directory to component names.

        Parameters
        ----------
        asset_watch_roots : dict[str, Path]
            Mapping of component names to their asset root directories.

        Returns
        -------
        dict[str, list[str]]
            A map from absolute directory path to a deduplicated list of
            component names contained in that directory.
        """
        directories_to_watch: dict[str, list[str]] = {}
        for comp_name, root in asset_watch_roots.items():
            directory = str(root.resolve())
            if directory not in directories_to_watch:
                directories_to_watch[directory] = []
            if comp_name not in directories_to_watch[directory]:
                directories_to_watch[directory].append(comp_name)
        return directories_to_watch

    def _build_watchers_for_directories(
        self, path_watcher_class: type, directories_to_watch: dict[str, list[str]]
    ) -> tuple[list[_HasClose], dict[str, list[str]]]:
        """Create watchers for directories with rollback on failure.

        Parameters
        ----------
        path_watcher_class : type
            The path watcher class to instantiate for each directory.
        directories_to_watch : dict[str, list[str]]
            A map of directory to the associated component name list.

        Returns
        -------
        tuple[list[_HasClose], dict[str, list[str]]]
            The list of created watcher instances and the watched directory
            mapping.

        Raises
        ------
        Exception
            Propagates any exception during watcher creation after closing
            already-created watchers.
        """
        new_watchers: list[_HasClose] = []
        new_watched_dirs: dict[str, list[str]] = {}

        for directory, component_names in directories_to_watch.items():
            try:
                cb = self._make_directory_callback(tuple(component_names))
                # Use a glob pattern that matches all files to let Streamlit's
                # watcher handle MD5 calculation and change detection
                watcher = path_watcher_class(
                    directory,
                    cb,
                    glob_pattern="**/*",
                    allow_nonexistent=False,
                )
                new_watchers.append(cast("_HasClose", watcher))
                new_watched_dirs[directory] = component_names
                _LOGGER.debug(
                    "Prepared watcher for directory %s (components: %s)",
                    directory,
                    component_names,
                )
            except Exception:  # noqa: PERF203
                # Roll back watchers created so far
                self._rollback_watchers(new_watchers)
                raise

        return new_watchers, new_watched_dirs

    def _commit_watch_state(
        self,
        new_watchers: list[_HasClose],
        new_watched_dirs: dict[str, list[str]],
        asset_watch_roots: dict[str, Path],
    ) -> None:
        """Commit created watchers and mark watching active.

        Parameters
        ----------
        new_watchers : list[_HasClose]
            Fully initialized watcher instances.
        new_watched_dirs : dict[str, list[str]]
            Mapping from directory to component names.
        asset_watch_roots : dict[str, Path]
            The asset roots used to initialize watchers; stored for reference.
        """
        self._path_watchers = new_watchers
        self._watched_directories = new_watched_dirs
        self._asset_watch_roots = dict(asset_watch_roots)
        self._watching_active = True
        _LOGGER.debug(
            "Started file watching for %d directories", len(self._watched_directories)
        )

    def _rollback_watchers(self, watchers: list[_HasClose]) -> None:
        """Close any created watchers when setup fails.

        Parameters
        ----------
        watchers : list[_HasClose]
            Watcher instances that were successfully created before a failure.
        """
        for w in watchers:
            try:
                w.close()
            except Exception:  # noqa: PERF203
                _LOGGER.exception("Failed to close path watcher during rollback")

    def _make_directory_callback(self, comps: tuple[str, ...]) -> Callable[[str], None]:
        """Create a callback for a directory watcher that captures component names."""

        def callback(changed_path: str) -> None:
            if self._is_in_ignored_directory(changed_path):
                _LOGGER.debug("Ignoring change in noisy directory: %s", changed_path)
                return
            _LOGGER.debug(
                "Directory change detected: %s, checking components: %s",
                changed_path,
                comps,
            )
            self._handle_component_change(list(comps))

        return callback

    def _handle_component_change(self, affected_components: list[str]) -> None:
        """Handle component changes for both directory and file events.

        Parameters
        ----------
        affected_components : list[str]
            List of component names affected by the change
        """
        if not self._watching_active:
            return

        # Notify manager to handle re-resolution based on recorded API inputs
        try:
            self._component_update_callback(affected_components)
        except Exception:
            # Never allow exceptions from user callbacks to break watcher loops
            _LOGGER.exception("Component update callback raised")

    def _is_in_ignored_directory(self, changed_path: str) -> bool:
        """Return True if the changed path is inside an ignored directory.

        Parameters
        ----------
        changed_path : str
            The filesystem path that triggered the change event.

        Returns
        -------
        bool
            True if the path is located inside one of the ignored directories,
            False otherwise.
        """
        try:
            from pathlib import Path as _Path

            parts = set(_Path(changed_path).resolve().parts)
            return any(ignored in parts for ignored in self._ignored_dirs)
        except Exception:
            return False
