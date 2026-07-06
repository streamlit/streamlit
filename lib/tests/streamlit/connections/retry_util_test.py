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

from __future__ import annotations

import pytest

from streamlit.connections.retry_util import (
    RetryError,
    retry,
    retry_if_exception,
    retry_if_exception_type,
    stop_after_attempt,
    wait_fixed,
)


def _no_sleep(_seconds: float) -> None:
    """A sleep replacement that records nothing and never blocks."""


def test_retryable_failure_exhausts_and_reraises_last_exception():
    """A retryable error is attempted up to the stop limit, then re-raised."""
    attempts = 0
    afters = 0

    def after(_state: object) -> None:
        nonlocal afters
        afters += 1

    @retry(
        after=after,
        stop=stop_after_attempt(3),
        reraise=True,
        retry=retry_if_exception_type((ValueError,)),
        wait=wait_fixed(0),
        sleep=_no_sleep,
    )
    def always_fails() -> None:
        nonlocal attempts
        attempts += 1
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        always_fails()

    # Three attempts, and `after` runs after each retryable attempt (incl. the last).
    assert attempts == 3
    assert afters == 3


def test_non_retryable_exception_raised_immediately_without_after():
    """A non-matching exception is raised on the first attempt; `after` is skipped."""
    attempts = 0
    afters = 0

    def after(_state: object) -> None:
        nonlocal afters
        afters += 1

    @retry(
        after=after,
        stop=stop_after_attempt(3),
        reraise=True,
        retry=retry_if_exception_type((ValueError,)),
        wait=wait_fixed(0),
        sleep=_no_sleep,
    )
    def wrong_error() -> None:
        nonlocal attempts
        attempts += 1
        raise KeyError("nope")

    with pytest.raises(KeyError):
        wrong_error()

    assert attempts == 1
    assert afters == 0


def test_eventual_success_returns_value():
    """Retrying stops and returns as soon as the call succeeds."""
    attempts = 0

    @retry(
        stop=stop_after_attempt(5),
        reraise=True,
        retry=retry_if_exception_type((ValueError,)),
        wait=wait_fixed(0),
        sleep=_no_sleep,
    )
    def succeeds_on_third() -> str:
        nonlocal attempts
        attempts += 1
        if attempts < 3:
            raise ValueError("retry me")
        return "ok"

    assert succeeds_on_third() == "ok"
    assert attempts == 3


def test_success_first_try_does_not_sleep():
    """A call that succeeds immediately never sleeps or waits."""
    sleeps: list[float] = []

    @retry(
        stop=stop_after_attempt(3),
        reraise=True,
        retry=retry_if_exception_type((ValueError,)),
        wait=wait_fixed(1),
        sleep=sleeps.append,
    )
    def ok() -> int:
        return 5

    assert ok() == 5
    assert sleeps == []


def test_sleeps_between_attempts():
    """The wait strategy determines the sleep duration between attempts."""
    sleeps: list[float] = []

    @retry(
        stop=stop_after_attempt(3),
        reraise=True,
        retry=retry_if_exception_type((ValueError,)),
        wait=wait_fixed(2),
        sleep=sleeps.append,
    )
    def always_fails() -> None:
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        always_fails()

    # Two sleeps of 2s between the three attempts (no sleep after the final attempt).
    assert sleeps == [2, 2]


def test_reraise_false_raises_retry_error():
    """With reraise=False, exhausted retries raise RetryError wrapping the last error."""

    @retry(
        stop=stop_after_attempt(2),
        reraise=False,
        retry=retry_if_exception_type((ValueError,)),
        wait=wait_fixed(0),
        sleep=_no_sleep,
    )
    def always_fails() -> None:
        raise ValueError("boom")

    with pytest.raises(RetryError) as exc_info:
        always_fails()

    assert isinstance(exc_info.value.last_exception, ValueError)


def test_retry_if_exception_predicate():
    """retry_if_exception only retries when the predicate matches the exception."""
    attempts = 0

    @retry(
        stop=stop_after_attempt(3),
        reraise=True,
        retry=retry_if_exception(lambda e: getattr(e, "code", None) == 1),
        wait=wait_fixed(0),
        sleep=_no_sleep,
    )
    def fails_with_code() -> None:
        nonlocal attempts
        attempts += 1
        err = RuntimeError("retryable")
        err.code = 1  # type: ignore[attr-defined]
        raise err

    with pytest.raises(RuntimeError):
        fails_with_code()
    assert attempts == 3


def test_retry_if_exception_predicate_no_match_fails_fast():
    """retry_if_exception does not retry when the predicate rejects the exception."""
    attempts = 0

    @retry(
        stop=stop_after_attempt(3),
        reraise=True,
        retry=retry_if_exception(lambda e: getattr(e, "code", None) == 1),
        wait=wait_fixed(0),
        sleep=_no_sleep,
    )
    def fails_with_other_code() -> None:
        nonlocal attempts
        attempts += 1
        err = RuntimeError("not retryable")
        err.code = 2  # type: ignore[attr-defined]
        raise err

    with pytest.raises(RuntimeError):
        fails_with_other_code()
    assert attempts == 1


def test_stop_after_attempt_and_wait_fixed_helpers():
    """The stop/wait strategy factories evaluate against the retry state."""
    from streamlit.connections.retry_util import RetryCallState

    state = RetryCallState()
    stop = stop_after_attempt(3)
    wait = wait_fixed(1.5)

    state.attempt_number = 2
    assert stop(state) is False
    state.attempt_number = 3
    assert stop(state) is True
    assert wait(state) == 1.5
