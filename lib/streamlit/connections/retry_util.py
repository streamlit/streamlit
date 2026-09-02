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

Replaces the tiny subset of ``tenacity`` that ``SQLConnection.query`` and
``SnowflakeConnection.query`` used, so ``tenacity`` is no longer a required
runtime dependency.
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
    retry_on_exception: Callable[[Exception], bool],
    after: Callable[[], None] | None = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Callable[[Callable[_P, _R]], Callable[_P, _R]]:
    """Retry a function on retryable exceptions.

    Only ``Exception`` subclasses are considered; other ``BaseException``s
    (e.g. ``KeyboardInterrupt``) propagate immediately.

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

    Raises
    ------
    ValueError
        If ``max_attempts`` is less than ``1`` or ``wait_seconds`` is negative.
    """
    if max_attempts < 1:
        raise ValueError(f"max_attempts must be at least 1, got {max_attempts!r}.")
    if wait_seconds < 0:
        raise ValueError(f"wait_seconds must be non-negative, got {wait_seconds!r}.")

    def decorator(func: Callable[_P, _R]) -> Callable[_P, _R]:
        @functools.wraps(func)
        def wrapper(*args: _P.args, **kwargs: _P.kwargs) -> _R:
            attempt = 1
            while True:
                try:
                    return func(*args, **kwargs)
                except Exception as exc:  # noqa: PERF203 — retry loop must catch per-iteration
                    # The predicate rejected this exception: re-raise it
                    # immediately with no wait or `after` callback.
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
