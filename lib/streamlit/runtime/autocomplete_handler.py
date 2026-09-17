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

"""Backend operation handler for ``st.text_input`` autocomplete suggestions."""

from __future__ import annotations

import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from typing import TYPE_CHECKING, Final, TypeAlias

from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import (
    AutocompleteResponsePayload,
    BackendOperationResponse,
)
from streamlit.runtime.autocomplete_source_manager import AutocompleteSourceError
from streamlit.runtime.backend_operation_handler import BackendOperationHandler
from streamlit.runtime.state.session_state_proxy import _WORKER_SESSION_STATE_BLOCKED

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.autocomplete_source_manager import AutocompleteSourceManager

_LOGGER: Final = get_logger(__name__)

_AUTOCOMPLETE_TIMEOUT_S: Final = 5.0
_AUTOCOMPLETE_POOL_WORKERS: Final = 8
_AUTOCOMPLETE_GLOBAL_PERMITS: Final = 8
_AUTOCOMPLETE_SESSION_PERMITS: Final = 4
_AUTOCOMPLETE_SOURCE_PERMITS: Final = 1
_AUTOCOMPLETE_RATE_BURST: Final = 20
_AUTOCOMPLETE_RATE_REFILL_PER_S: Final = 4.0

_EXECUTOR: Final = ThreadPoolExecutor(
    max_workers=_AUTOCOMPLETE_POOL_WORKERS,
    thread_name_prefix="Autocomplete",
)
_GLOBAL_PERMITS: Final = threading.BoundedSemaphore(_AUTOCOMPLETE_GLOBAL_PERMITS)

_SourceKey: TypeAlias = tuple[str, str]
_LookupKey: TypeAlias = tuple[str, str, str]


class _NoCapacityError(Exception):
    """Raised when admission or the per-session rate budget is exhausted."""


class _TokenBucket:
    """Thread-safe token bucket used as a per-session rate budget."""

    def __init__(self, *, burst: int, refill_per_s: float) -> None:
        self._burst = float(burst)
        self._refill_per_s = refill_per_s
        self._tokens = float(burst)
        self._last = time.monotonic()
        self._lock = threading.Lock()

    def try_consume(self) -> bool:
        """Return True if a token was consumed, False if the bucket is empty."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last
            self._last = now
            self._tokens = min(self._burst, self._tokens + elapsed * self._refill_per_s)
            if self._tokens < 1:
                return False
            self._tokens -= 1
            return True


class AutocompleteHandler(BackendOperationHandler):
    """Handles ``autocomplete`` backend operation requests.

    User callables run on a dedicated thread pool so a hung source cannot
    starve other backend operations. Permits are ``threading.BoundedSemaphore``
    values released in the worker's ``finally``, not when the waiting
    coroutine times out.
    """

    def __init__(self, get_source_mgr: Callable[[], AutocompleteSourceManager]) -> None:
        self._get_source_mgr = get_source_mgr
        self._session_semaphores: dict[str, threading.BoundedSemaphore] = {}
        self._source_semaphores: dict[_SourceKey, threading.BoundedSemaphore] = {}
        self._rate_buckets: dict[str, _TokenBucket] = {}
        self._in_flight: dict[_LookupKey, asyncio.Task[list[str]]] = {}
        self._logged_failures: set[tuple[str, type[BaseException]]] = set()
        self._semaphore_lock = threading.Lock()

    def _session_semaphore(self, session_id: str) -> threading.BoundedSemaphore:
        with self._semaphore_lock:
            return self._session_semaphores.setdefault(
                session_id,
                threading.BoundedSemaphore(_AUTOCOMPLETE_SESSION_PERMITS),
            )

    def _source_semaphore(self, source_key: _SourceKey) -> threading.BoundedSemaphore:
        with self._semaphore_lock:
            return self._source_semaphores.setdefault(
                source_key,
                threading.BoundedSemaphore(_AUTOCOMPLETE_SOURCE_PERMITS),
            )

    def _rate_bucket(self, session_id: str) -> _TokenBucket:
        with self._semaphore_lock:
            return self._rate_buckets.setdefault(
                session_id,
                _TokenBucket(
                    burst=_AUTOCOMPLETE_RATE_BURST,
                    refill_per_s=_AUTOCOMPLETE_RATE_REFILL_PER_S,
                ),
            )

    def _try_admit(
        self, session_id: str, source_id: str
    ) -> list[threading.BoundedSemaphore] | None:
        """Acquire global, session, and source permits, or release any taken.

        Returns the acquired semaphores on success so the worker can release
        them, or ``None`` if admission failed.
        """
        acquired: list[threading.BoundedSemaphore] = []
        for sem in (
            _GLOBAL_PERMITS,
            self._session_semaphore(session_id),
            self._source_semaphore((session_id, source_id)),
        ):
            if not sem.acquire(blocking=False):
                for taken in reversed(acquired):
                    taken.release()
                return None
            acquired.append(sem)
        return acquired

    def _run_on_worker(
        self,
        acquired: list[threading.BoundedSemaphore],
        session_id: str,
        source_id: str,
        text: str,
    ) -> list[str]:
        """Invoke the source on this worker thread and always release permits."""
        try:
            token = _WORKER_SESSION_STATE_BLOCKED.set(True)
            try:
                return self._get_source_mgr().get_suggestions(
                    session_id, source_id, text
                )
            finally:
                _WORKER_SESSION_STATE_BLOCKED.reset(token)
        finally:
            for sem in reversed(acquired):
                sem.release()

    async def _execute_lookup(
        self, session_id: str, source_id: str, text: str
    ) -> list[str]:
        """Start one coalesced lookup: rate-limit, admit, then run on the pool."""
        if not self._rate_bucket(session_id).try_consume():
            _LOGGER.warning(
                "Autocomplete request rate limited for session %s", session_id
            )
            raise _NoCapacityError

        acquired = self._try_admit(session_id, source_id)
        if acquired is None:
            raise _NoCapacityError

        try:
            future = _EXECUTOR.submit(
                self._run_on_worker, acquired, session_id, source_id, text
            )
        except Exception:
            for sem in reversed(acquired):
                sem.release()
            raise _NoCapacityError from None

        return await asyncio.wrap_future(future)

    def _remove_completed_task(
        self, lookup_key: _LookupKey, task: asyncio.Task[list[str]]
    ) -> None:
        """Remove completed request state while preserving any replacement task."""
        if self._in_flight.get(lookup_key) is task:
            del self._in_flight[lookup_key]
        # A waiter may have timed out while the shared task kept running.
        # Retrieve the outcome so asyncio does not log an unhandled task
        # exception after the last waiter is gone.
        if task.done() and not task.cancelled():
            task.exception()

    def _log_source_failure_once(self, source_id: str, exc: BaseException) -> None:
        """Log a broken source once per (source_id, exception type)."""
        key = (source_id, type(exc))
        if key in self._logged_failures:
            return
        self._logged_failures.add(key)

        error_id = getattr(exc, "error_id", None)
        extra = f" (error_id={error_id})" if error_id else ""
        _LOGGER.warning(
            "Error computing suggestions for source %s%s",
            source_id,
            extra,
            exc_info=exc,
        )

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        payload = request.autocomplete
        lookup_key: _LookupKey = (session_id, payload.source_id, payload.text)

        task = self._in_flight.get(lookup_key)
        if task is None:
            task = asyncio.create_task(
                self._execute_lookup(session_id, payload.source_id, payload.text)
            )
            self._in_flight[lookup_key] = task
            task.add_done_callback(partial(self._remove_completed_task, lookup_key))

        try:
            # Shield the shared operation so cancellation of one waiter does not
            # cancel the request for every other waiter using the same task.
            suggestions = await asyncio.wait_for(
                asyncio.shield(task), timeout=_AUTOCOMPLETE_TIMEOUT_S
            )
        except AutocompleteSourceError as err:
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg=str(err),
            )
        except (TimeoutError, asyncio.TimeoutError, _NoCapacityError):
            # ``asyncio.TimeoutError`` is not builtin ``TimeoutError`` on
            # Python 3.10 (they were unified in 3.11).
            suggestions = []
        except Exception as exc:
            self._log_source_failure_once(payload.source_id, exc)
            suggestions = []

        response = BackendOperationResponse(request_id=request.request_id)
        response.autocomplete.CopyFrom(
            AutocompleteResponsePayload(
                source_id=payload.source_id,
                text=payload.text,
                suggestions=suggestions,
            )
        )
        return response
