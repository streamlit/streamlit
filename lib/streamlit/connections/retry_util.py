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

"""A small retry helper for Streamlit's database connections.

This replaces the tiny subset of the ``tenacity`` library that
``SQLConnection.query`` and ``SnowflakeConnection.query`` relied on, so that
``tenacity`` is no longer a required runtime dependency.

The single :func:`retry` decorator retries a function a fixed number of times,
sleeping a fixed number of seconds between attempts, and only retries
exceptions for which a caller-supplied predicate returns ``True``. This mirrors
tenacity's behavior for the specific options the connections use (``stop=
stop_after_attempt``, ``wait=wait_fixed``, ``retry=retry_if_exception[_type]``,
``after``, and ``reraise=True``):

- On success, the result is returned immediately.
- After every failed *retryable* attempt, the optional ``after`` callback runs
  (including the final attempt, right before the exception is re-raised).
- When all attempts are exhausted, the exception from the final attempt is
  re-raised unchanged (tenacity's ``reraise=True``).
- An exception the predicate rejects is re-raised immediately, without any
  retry, wait, or ``after`` callback.

This is not a fully general tenacity drop-in: only ``Exception`` subclasses are
considered for retrying, so non-``Exception`` ``BaseException``s (e.g.
``KeyboardInterrupt``) always propagate immediately. This matches the observable
behavior at both call sites, whose predicates only ever match ``Exception``s.
"""

from __future__ import annotations

import functools
import time
from typing import TYPE_CHECKING, TypeVar

from typing_extensions import ParamSpec

if TYPE_CHECKING:
    from collections.abc import Callable

_P = ParamSpec("_P")
_R = TypeVar("_R")


def retry(
    *,
    max_attempts: int,
    wait_seconds: float,
    retry_on_exception: Callable[[BaseException], bool],
    after: Callable[[], None] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Callable[[Callable[_P, _R]], Callable[_P, _R]]:
    """Retry a function on retryable exceptions.

    Parameters
    ----------
    max_attempts
        The maximum number of times the wrapped function is called (must be at
        least ``1``).
    wait_seconds
        The number of seconds to sleep between attempts.
    retry_on_exception
        A predicate called with the raised exception. If it returns ``True``,
        the function is retried until ``max_attempts`` is reached; if it returns
        ``False``, the exception is re-raised immediately.
    after
        An optional callback invoked after every failed, retryable attempt,
        including the final one before the exception is re-raised. The
        connections use this to reset the connection between attempts.
    sleep
        The function used to sleep between attempts. Injectable for testing;
        defaults to :func:`time.sleep`.

    Returns
    -------
    Callable
        A decorator that wraps a function with the configured retry behavior.
    """

    def decorator(func: Callable[_P, _R]) -> Callable[_P, _R]:
        @functools.wraps(func)
        def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _R:
            attempt = 1
            while True:
                try:
                    return func(*args, **kwargs)
                except Exception as exc:  # noqa: PERF203
                    # Exceptions the predicate rejects (and non-Exception
                    # BaseExceptions like KeyboardInterrupt) propagate
                    # immediately without any retry or `after` callback.
                    if not retry_on_exception(exc):
                        raise

                    if after is not None:
                        after()

                    if attempt >= max_attempts:
                        # Out of attempts: re-raise the final exception.
                        raise

                    sleep(wait_seconds)
                    attempt += 1

        return wrapper

    return decorator
