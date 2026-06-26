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

"""Coordinates background refreshes for caches that use ``refresh_type="background"``.

A single process-wide ``ThreadPoolExecutor`` runs refresh callbacks so that a
burst of expired cache entries cannot spawn an unbounded number of threads.
Refreshes are deduplicated per cache key so that only one refresh runs at a time
for a given key, even when many sessions hit the same expired entry concurrently.

If the runtime environment forbids creating threads (for example, some sandboxed
deployments), the coordinator falls back to running the refresh synchronously on
the calling thread.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)

# The default number of worker threads used for background cache refreshes. This
# is intentionally small: refreshes are expected to be infrequent and we want to
# avoid overwhelming external resources (databases, APIs) that the refreshed
# functions typically call.
_DEFAULT_MAX_WORKERS: Final = 4


class BackgroundRefreshCoordinator:
    """Schedules deduplicated, bounded-concurrency background cache refreshes."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._executor: ThreadPoolExecutor | None = None
        self._in_flight: set[Any] = set()
        # Set to False if creating worker threads fails, so that we stop trying
        # and run refreshes synchronously instead.
        self._threading_available = True

    def _get_executor(self) -> ThreadPoolExecutor:
        if self._executor is None:
            configured = config.get_option("runner.cacheRefreshMaxWorkers")
            # Guard against unset (None) or invalid (<= 0) configuration values,
            # which would otherwise make ThreadPoolExecutor raise.
            max_workers = (
                configured
                if isinstance(configured, int) and configured > 0
                else _DEFAULT_MAX_WORKERS
            )
            self._executor = ThreadPoolExecutor(
                max_workers=max_workers, thread_name_prefix="CacheBackgroundRefresh"
            )
        return self._executor

    def schedule(self, refresh_key: Any, refresh_fn: Callable[[], None]) -> None:
        """Schedule ``refresh_fn`` to run in the background for ``refresh_key``.

        If a refresh for ``refresh_key`` is already in flight, this is a no-op
        (deduplication). ``refresh_fn`` must handle its own exceptions; it is
        expected to never raise.
        """
        run_synchronously = False
        with self._lock:
            if refresh_key in self._in_flight:
                # A refresh for this key is already running; dedup.
                return

            if self._threading_available:
                # Create the executor before marking the key as in flight so a
                # failure here can never leave a key stuck in ``_in_flight``.
                executor = self._get_executor()
                self._in_flight.add(refresh_key)
                try:
                    executor.submit(self._run, refresh_key, refresh_fn)
                except RuntimeError:
                    # Thread creation failed (e.g. a restricted environment).
                    # Fall back to synchronous execution from now on.
                    self._threading_available = False
                    self._in_flight.discard(refresh_key)
                    run_synchronously = True
            else:
                run_synchronously = True

        if run_synchronously:
            # Run outside the lock so we never hold it while executing user code.
            refresh_fn()

    def _run(self, refresh_key: Any, refresh_fn: Callable[[], None]) -> None:
        try:
            refresh_fn()
        finally:
            with self._lock:
                self._in_flight.discard(refresh_key)

    def shutdown(self, wait: bool = True) -> None:
        """Shut down the executor. Primarily used to avoid thread leaks in tests."""
        with self._lock:
            executor = self._executor
            self._executor = None
            self._in_flight.clear()
            self._threading_available = True
        if executor is not None:
            executor.shutdown(wait=wait)


# Process-wide singleton coordinator.
_coordinator = BackgroundRefreshCoordinator()


def schedule_background_refresh(
    refresh_key: Any, refresh_fn: Callable[[], None]
) -> None:
    """Schedule a deduplicated background cache refresh on the shared coordinator."""
    _coordinator.schedule(refresh_key, refresh_fn)


def get_background_refresh_coordinator() -> BackgroundRefreshCoordinator:
    """Return the process-wide background refresh coordinator."""
    return _coordinator
