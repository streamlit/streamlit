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
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Callable

_LOGGER: Final = get_logger(__name__)

# The maximum number of concurrent background refreshes. Background refreshes are
# typically I/O-bound (database/API/model calls), so a small, predictable bound is
# preferable; some runtimes (e.g. SiS) also restrict thread counts.
_MAX_WORKERS: Final = 4


class _BackgroundRefreshManager:
    """A process-wide, bounded executor for background cache refreshes."""

    def __init__(self, max_workers: int = _MAX_WORKERS) -> None:
        self._max_workers = max_workers
        self._lock = threading.Lock()
        self._executor: ThreadPoolExecutor | None = None
        # Gates submission so at most ``max_workers`` refreshes run at once. We
        # acquire without blocking and skip when no slot is free (no queueing).
        self._slots = threading.Semaphore(max_workers)
        # Latched once thread creation fails on a restricted runtime, after which
        # all submissions are skipped (graceful degradation to foreground refresh).
        self._threads_unavailable = False

    @property
    def threads_unavailable(self) -> bool:
        """Whether background threads have been permanently disabled."""
        return self._threads_unavailable

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
            ``True`` if the task was scheduled, ``False`` if it was skipped because
            the pool is saturated or thread creation is unavailable on this runtime.
        """
        if self._threads_unavailable:
            return False

        if not self._slots.acquire(blocking=False):
            # All workers are busy: skip rather than queue.
            return False

        try:
            executor = self._ensure_executor()

            def _runner() -> None:
                try:
                    task()
                finally:
                    self._slots.release()

            # ThreadPoolExecutor starts worker threads lazily on submit, so a
            # restricted runtime raises RuntimeError("can't start new thread") here.
            executor.submit(_runner)
            return True
        except RuntimeError:
            self._slots.release()
            self._threads_unavailable = True
            _LOGGER.warning(
                "Background cache refresh is unavailable on this runtime; falling "
                "back to a blocking foreground refresh at hard expiry."
            )
            return False
        except Exception:
            self._slots.release()
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
        self._slots = threading.Semaphore(self._max_workers)
        self._threads_unavailable = False


# Process-wide singleton.
_background_refresh_manager = _BackgroundRefreshManager()


def get_background_refresh_manager() -> _BackgroundRefreshManager:
    """Return the process-wide background refresh manager."""
    return _background_refresh_manager


def reset() -> None:
    """Reset the process-wide manager. Intended for use in tests."""
    _background_refresh_manager.shutdown()
