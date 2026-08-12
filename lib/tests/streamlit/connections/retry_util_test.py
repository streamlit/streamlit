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

"""Unit tests for the internal retry helper (tenacity replacement)."""

from __future__ import annotations

from unittest.mock import Mock

import pytest

from streamlit.connections import retry_util


class _RetryableError(Exception):
    """An exception the retry predicate treats as retryable."""


class _NonRetryableError(Exception):
    """An exception the retry predicate treats as non-retryable."""


def _retry_only_retryable(exc: BaseException) -> bool:
    """Retry predicate that only retries ``_RetryableError`` instances."""
    return isinstance(exc, _RetryableError)


def test_returns_result_without_retrying_on_success() -> None:
    """A function that succeeds is called once and its result is returned."""
    sleep = Mock()
    after = Mock()
    inner = Mock(return_value="result")

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        after=after,
        sleep=sleep,
    )(inner)

    assert wrapped() == "result"
    assert inner.call_count == 1
    # No failure occurred, so neither the sleep nor the `after` hook should run.
    sleep.assert_not_called()
    after.assert_not_called()


def test_reraises_final_exception_after_exhausting_attempts() -> None:
    """When every attempt fails, the final exception is re-raised unchanged."""
    sleep = Mock()
    after = Mock()
    final_error = _RetryableError("kaboom")
    inner = Mock(
        side_effect=[_RetryableError("first"), _RetryableError("second"), final_error]
    )

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        after=after,
        sleep=sleep,
    )(inner)

    with pytest.raises(_RetryableError) as exc_info:
        wrapped()

    # The exception from the last attempt is propagated (tenacity reraise=True).
    assert exc_info.value is final_error
    assert inner.call_count == 3
    # `after` runs after every failed attempt, including the final one.
    assert after.call_count == 3
    # We sleep between attempts, i.e. one fewer time than the number of attempts.
    assert sleep.call_count == 2


def test_succeeds_after_transient_failures() -> None:
    """A function that fails then succeeds returns its eventual result."""
    sleep = Mock()
    after = Mock()
    inner = Mock(side_effect=[_RetryableError("boom"), "recovered"])

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        after=after,
        sleep=sleep,
    )(inner)

    assert wrapped() == "recovered"
    assert inner.call_count == 2
    assert after.call_count == 1
    assert sleep.call_count == 1


def test_non_retryable_exception_is_reraised_immediately() -> None:
    """An exception the predicate rejects is raised without any retry."""
    sleep = Mock()
    after = Mock()
    inner = Mock(side_effect=_NonRetryableError("nope"))

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        after=after,
        sleep=sleep,
    )(inner)

    with pytest.raises(_NonRetryableError):
        wrapped()

    # Non-retryable failures fail fast: a single call, no wait, no `after` hook.
    assert inner.call_count == 1
    sleep.assert_not_called()
    after.assert_not_called()


def test_base_exception_propagates_without_after() -> None:
    """A non-``Exception`` ``BaseException`` propagates immediately without retry."""
    sleep = Mock()
    after = Mock()
    inner = Mock(side_effect=KeyboardInterrupt())

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=lambda _exc: True,
        after=after,
        sleep=sleep,
    )(inner)

    with pytest.raises(KeyboardInterrupt):
        wrapped()

    assert inner.call_count == 1
    sleep.assert_not_called()
    after.assert_not_called()


def test_after_hook_is_optional() -> None:
    """The retry logic works when no ``after`` callback is provided."""
    sleep = Mock()
    inner = Mock(side_effect=_RetryableError("boom"))

    wrapped = retry_util.retry(
        max_attempts=2,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        sleep=sleep,
    )(inner)

    with pytest.raises(_RetryableError):
        wrapped()

    assert inner.call_count == 2
    assert sleep.call_count == 1


def test_single_attempt_does_not_sleep() -> None:
    """With ``max_attempts=1`` the function is tried once and never waits."""
    sleep = Mock()
    after = Mock()
    inner = Mock(side_effect=_RetryableError("boom"))

    wrapped = retry_util.retry(
        max_attempts=1,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        after=after,
        sleep=sleep,
    )(inner)

    with pytest.raises(_RetryableError):
        wrapped()

    assert inner.call_count == 1
    # `after` still runs for the failed attempt, but there is nothing to wait for.
    assert after.call_count == 1
    sleep.assert_not_called()


def test_sleeps_configured_wait_seconds_between_attempts() -> None:
    """The wait strategy sleeps for exactly ``wait_seconds`` between attempts."""
    sleep = Mock()
    inner = Mock(side_effect=[_RetryableError("boom"), "done"])

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=2.5,
        retry_on_exception=_retry_only_retryable,
        sleep=sleep,
    )(inner)

    assert wrapped() == "done"
    sleep.assert_called_once_with(2.5)


def test_forwards_args_and_kwargs() -> None:
    """Positional and keyword arguments are passed through to the function."""
    sleep = Mock()
    inner = Mock(return_value="ok")

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
        sleep=sleep,
    )(inner)

    assert wrapped("a", 2, key="value") == "ok"
    inner.assert_called_once_with("a", 2, key="value")


def test_preserves_wrapped_function_metadata() -> None:
    """The decorator preserves the wrapped function's identity metadata."""

    def original(x: int) -> int:
        """Original docstring."""
        return x

    wrapped = retry_util.retry(
        max_attempts=3,
        wait_seconds=1,
        retry_on_exception=_retry_only_retryable,
    )(original)

    assert wrapped.__name__ == "original"
    assert wrapped.__doc__ == "Original docstring."
    # `functools.wraps` exposes the original function so `inspect.signature`
    # (used by `st.cache_data` to build cache keys) resolves the true params.
    assert wrapped.__wrapped__ is original


@pytest.mark.parametrize("max_attempts", [0, -1])
def test_rejects_max_attempts_below_one(max_attempts: int) -> None:
    """Constructing the decorator with fewer than one attempt fails fast."""
    with pytest.raises(ValueError, match="max_attempts must be at least 1"):
        retry_util.retry(
            max_attempts=max_attempts,
            wait_seconds=1,
            retry_on_exception=_retry_only_retryable,
        )


def test_rejects_negative_wait_seconds() -> None:
    """Constructing the decorator with a negative wait time fails fast."""
    with pytest.raises(ValueError, match="wait_seconds must be non-negative"):
        retry_util.retry(
            max_attempts=3,
            wait_seconds=-1,
            retry_on_exception=_retry_only_retryable,
        )
