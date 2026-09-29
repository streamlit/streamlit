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

"""Shared, bounded executor used by ``refresh_mode="background"`` caches.

Background cache refreshes run on a single process-wide, bounded thread pool so
that a mass-expiry event (many keys going stale at once) can't spawn an unbounded
number of threads. Submission is gated by a semaphore: when all workers are busy
the refresh is *skipped* rather than queued, matching the product spec's
"skip rather than build a backlog" requirement. The stale value is still served,
and the next access simply re-triggers the refresh.

On runtimes that forbid thread creation, the first failed thread start latches a
graceful-degradation flag so subsequent submissions are skipped without raising.

The pool size is controlled by the hidden ``runner.cacheBackgroundRefreshMaxWorkers``
config option (default 4); setting it to 0 disables background refresh entirely, so
stale entries recompute in the foreground at hard expiry instead.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)

# Fallback pool size used only if the config option can't be read (it normally
# provides the default). Background refreshes are typically I/O-bound
# (database/API/model calls), so a small, predictable bound is preferable; some
# runtimes (e.g. SiS) also restrict thread counts.
_DEFAULT_MAX_WORKERS: Final = 4


class _BackgroundRefreshManager:
    """A process-wide, bounded executor for background cache refreshes."""

    def __init__(self, max_workers: int | None = None) -> None:
        """Create the manager.

        Parameters
        ----------
        max_workers : int or None
            When ``None`` (the default, used by the process-wide singleton), the pool
            size is read from the ``runner.cacheBackgroundRefreshMaxWorkers`` config
            option on first use — config isn't parsed yet at module import time. Tests
            pass an explicit value to bypass config and size the pool eagerly.
        """
        self._configured_max_workers = max_workers
        self._lock = threading.Lock()
        self._executor: ThreadPoolExecutor | None = None
        # Resolved pool size and its submission gate. Both stay ``None`` until the
        # size is known: eagerly when max_workers is given, else lazily from config.
        # A resolved size <= 0 disables background refresh, leaving _slots as None.
        self._max_workers: int | None = None
        self._slots: threading.Semaphore | None = None
        # Latched once thread creation fails on a restricted runtime, after which the
        # manager skips all submissions (graceful degradation to foreground refresh).
        self._threads_unavailable = False

        if max_workers is not None:
            self._init_slots(max_workers)

    @property
    def threads_unavailable(self) -> bool:
        """Whether background threads have been permanently disabled."""
        return self._threads_unavailable

    def _init_slots(self, max_workers: int) -> None:
        # A semaphore gates submission so at most ``max_workers`` refreshes run at
        # once (non-blocking acquire, skip when full — no queueing). A size <= 0
        # disables background refresh: no semaphore, and submit() always skips.
        self._max_workers = max_workers
        self._slots = threading.Semaphore(max_workers) if max_workers > 0 else None

    @staticmethod
    def _resolve_configured_max_workers() -> int:
        from streamlit import config

        max_workers = config.get_option("runner.cacheBackgroundRefreshMaxWorkers")
        try:
            return int(max_workers)
        except (TypeError, ValueError):  # pragma: no cover - defensive
            return _DEFAULT_MAX_WORKERS

    def _ensure_initialized(self) -> None:
        # Resolve the pool size from config on first use (config-backed singleton).
        if self._max_workers is not None:
            return
        with self._lock:
            if self._max_workers is None:
                self._init_slots(self._resolve_configured_max_workers())

    def _ensure_executor(self) -> ThreadPoolExecutor:
        # Create the pool lazily (double-checked) so no threads are spawned until a
        # background refresh is actually needed.
        if self._executor is None:
            with self._lock:
                if self._executor is None:
                    self._executor = ThreadPoolExecutor(
                        max_workers=self._max_workers,
                        thread_name_prefix="CacheBackgroundRefresh",
                    )
        return self._executor

    def submit(self, task: Callable[[], None]) -> bool:
        """Try to run ``task`` on the shared pool.

        Returns
        -------
        bool
            ``True`` if the manager scheduled the task, ``False`` if it skipped the
            task because background refresh is disabled, the pool is saturated, or
            thread creation is unavailable on this runtime.
        """
        if self._threads_unavailable:
            return False

        self._ensure_initialized()
        slots = self._slots
        if slots is None:
            # Background refresh disabled via config (max workers <= 0).
            return False

        if not slots.acquire(blocking=False):
            # All workers are busy: skip rather than queue.
            return False

        try:
            executor = self._ensure_executor()

            def _runner() -> None:
                try:
                    task()
                finally:
                    slots.release()

            # ThreadPoolExecutor starts worker threads lazily on submit, so a
            # restricted runtime raises RuntimeError("can't start new thread") here.
            executor.submit(_runner)
            return True
        except RuntimeError:
            slots.release()
            self._threads_unavailable = True
            _LOGGER.warning(
                "Background cache refresh is unavailable on this runtime; falling "
                "back to a blocking foreground refresh at hard expiry."
            )
            return False
        except Exception:
            slots.release()
            _LOGGER.warning(
                "Failed to schedule background cache refresh.", exc_info=True
            )
            return False

    def shutdown(self) -> None:
        """Shut down the pool and reset internal state.

        This is primarily intended for tests so that each test starts from a clean
        executor and a cleared degradation latch.
        """
        with self._lock:
            executor = self._executor
            self._executor = None
        if executor is not None:
            executor.shutdown(wait=True)
        # Restore the eager size for an explicitly-sized manager; reset the
        # config-backed singleton to "unresolved" so the size is re-read next time.
        if self._configured_max_workers is not None:
            self._init_slots(self._configured_max_workers)
        else:
            self._max_workers = None
            self._slots = None
        self._threads_unavailable = False


# Process-wide singleton.
_background_refresh_manager = _BackgroundRefreshManager()


def get_background_refresh_manager() -> _BackgroundRefreshManager:
    """Return the process-wide background refresh manager."""
    return _background_refresh_manager


def reset() -> None:
    """Reset the process-wide manager. Intended for use in tests."""
    _background_refresh_manager.shutdown()
