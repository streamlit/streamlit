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

"""Unit tests for `st.cache_data(task=True)` and its placeholder values."""

from __future__ import annotations

import threading
from typing import Any

import pytest

import streamlit as st
from streamlit.errors import StreamlitValueError
from streamlit.runtime.caching import cache_task


@pytest.fixture(autouse=True)
def _reset_task_manager() -> Any:
    cache_task.reset()
    yield
    cache_task.reset()


def _wait_until_settled(call: Any) -> Any:
    """Poll a task-mode cached function until it stops returning ``st.RUNNING``."""
    tick = threading.Event()
    for _ in range(500):
        value = call()
        if value is not st.RUNNING:
            return value
        tick.wait(0.01)
    pytest.fail("Task did not settle in time")


def test_running_is_a_distinct_non_none_placeholder() -> None:
    assert st.RUNNING is not None
    assert isinstance(st.RUNNING, cache_task.Running)
    assert repr(st.RUNNING) == "RUNNING"


def test_calling_a_task_function_returns_running_then_the_value() -> None:
    calls: list[int] = []
    release = threading.Event()

    @st.cache_data(task=True, show_spinner=False)
    def double(value: int) -> int:
        calls.append(value)
        release.wait(timeout=5)
        return value * 2

    assert double(3) is st.RUNNING
    release.set()
    assert _wait_until_settled(lambda: double(3)) == 6
    assert calls == [3]


def test_task_false_keeps_the_blocking_call() -> None:
    @st.cache_data(show_spinner=False)
    def double(value: int) -> int:
        return value * 2

    assert double(4) == 8


def test_task_function_reports_a_failure_as_a_task_error() -> None:
    @st.cache_data(task=True, show_spinner=False)
    def explode(value: int) -> int:
        raise ValueError("boom")

    value = _wait_until_settled(lambda: explode(1))
    assert isinstance(value, st.TaskError)
    assert isinstance(value.exception, ValueError)


def test_task_flag_rejects_coroutine_functions() -> None:
    with pytest.raises(StreamlitValueError):

        @st.cache_data(task=True, show_spinner=False)
        async def fetch(value: int) -> int:
            return value
