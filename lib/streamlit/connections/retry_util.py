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

"""A minimal retry helper for connection queries.

This is a small, dependency-free replacement for the tiny subset of the
``tenacity`` library that Streamlit's connection implementations rely on. The
public names (``retry``, ``stop_after_attempt``, ``wait_fixed``,
``retry_if_exception`` and ``retry_if_exception_type``) mirror ``tenacity`` so
call sites remain unchanged apart from the import.

The behavior deliberately matches ``tenacity`` for the options we use:

- The wrapped function is attempted until ``stop`` returns ``True`` (based on
  the attempt number) or a non-retryable exception is raised.
- ``retry`` decides, based on the raised exception, whether another attempt
  should be made. A raised exception for which ``retry`` returns ``False`` is
  re-raised immediately without any further waiting.
- ``after`` runs after every *retryable* failed attempt, including the final
  attempt right before the error is re-raised. This matches ``tenacity``, where
  the ``after`` callback is scheduled before the ``stop`` check.
- ``wait`` determines how long to sleep between attempts.
- With ``reraise=True`` (the only mode we use), the last exception is re-raised
  once ``stop`` triggers. Otherwise a :class:`RetryError` is raised.
"""

from __future__ import annotations

import functools
import time
from typing import TYPE_CHECKING, Any, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable

_T = TypeVar("_T")


class RetryCallState:
    """State passed to the ``stop``/``wait``/``retry``/``after`` callbacks.

    Only the attributes used by Streamlit's connections are provided:
    ``attempt_number`` (1-based) and ``exception`` (the exception raised by the
    most recent attempt, or ``None`` on success).
    """

    def __init__(self) -> None:
        self.attempt_number: int = 1
        self.exception: BaseException | None = None


class RetryError(Exception):
    """Raised when retries are exhausted and ``reraise`` is ``False``."""

    def __init__(self, last_exception: BaseException | None) -> None:
        self.last_exception = last_exception
        super().__init__(last_exception)


def stop_after_attempt(max_attempt_number: int) -> Callable[[RetryCallState], bool]:
    """Stop once ``max_attempt_number`` attempts have been made."""

    def _stop(retry_state: RetryCallState) -> bool:
        return retry_state.attempt_number >= max_attempt_number

    return _stop


def wait_fixed(wait: float) -> Callable[[RetryCallState], float]:
    """Wait a fixed number of seconds between attempts."""

    def _wait(_retry_state: RetryCallState) -> float:
        return wait

    return _wait


def retry_if_exception(
    predicate: Callable[[BaseException], bool],
) -> Callable[[RetryCallState], bool]:
    """Retry only if the raised exception satisfies ``predicate``."""

    def _retry(retry_state: RetryCallState) -> bool:
        exception = retry_state.exception
        if exception is None:
            return False
        return predicate(exception)

    return _retry


def retry_if_exception_type(
    exception_types: type[BaseException] | tuple[type[BaseException], ...] = Exception,
) -> Callable[[RetryCallState], bool]:
    """Retry only if the raised exception is one of ``exception_types``."""
    return retry_if_exception(lambda e: isinstance(e, exception_types))


def retry(
    *,
    stop: Callable[[RetryCallState], bool],
    wait: Callable[[RetryCallState], float],
    retry: Callable[[RetryCallState], bool],
    after: Callable[[RetryCallState], Any] | None = None,
    reraise: bool = False,
    sleep: Callable[[float], None] = time.sleep,
) -> Callable[[Callable[..., _T]], Callable[..., _T]]:
    """Return a decorator that retries the wrapped function.

    The parameters mirror the ``tenacity.retry`` keyword arguments that
    Streamlit uses.
    """

    def decorator(fn: Callable[..., _T]) -> Callable[..., _T]:
        @functools.wraps(fn)
        def wrapped(*args: Any, **kwargs: Any) -> _T:
            retry_state = RetryCallState()
            while True:
                try:
                    result = fn(*args, **kwargs)
                except BaseException as exc:
                    retry_state.exception = exc
                    if not retry(retry_state):
                        # The exception is not retryable: re-raise immediately.
                        raise
                else:
                    retry_state.exception = None
                    if not retry(retry_state):
                        # The call succeeded and should not be retried.
                        return result

                # A retryable outcome occurred. Run the `after` hook (e.g. to
                # reset the connection) before deciding whether to stop.
                if after is not None:
                    after(retry_state)

                sleep_seconds = wait(retry_state)

                if stop(retry_state):
                    if reraise and retry_state.exception is not None:
                        raise retry_state.exception
                    raise RetryError(retry_state.exception) from retry_state.exception

                sleep(sleep_seconds)
                retry_state.attempt_number += 1

        return wrapped

    return decorator
