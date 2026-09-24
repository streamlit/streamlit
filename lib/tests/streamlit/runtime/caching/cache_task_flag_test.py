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

"""Unit tests for the `st.cache_data(task=True)` flag."""

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


def _wait_until_done(call: Any) -> Any:
    """Poll a task-mode cached function until it reports a settled handle."""
    tick = threading.Event()
    for _ in range(500):
        task = call()
        if not task.running:
            return task
        tick.wait(0.01)
    pytest.fail("Task did not settle in time")


def test_calling_a_task_function_returns_a_handle() -> None:
    calls: list[int] = []

    @st.cache_data(task=True, show_spinner=False)
    def double(value: int) -> int:
        calls.append(value)
        return value * 2

    first = double(3)
    assert isinstance(first, cache_task.Task)

    settled = _wait_until_done(lambda: double(3))
    assert settled.done is True
    assert settled.result == 6
    assert calls == [3]


def test_task_false_keeps_the_blocking_call() -> None:
    @st.cache_data(show_spinner=False)
    def double(value: int) -> int:
        return value * 2

    assert double(4) == 8


def test_task_function_reports_a_failure_through_the_handle() -> None:
    @st.cache_data(task=True, show_spinner=False)
    def explode(value: int) -> int:
        raise ValueError("boom")

    task = _wait_until_done(lambda: explode(1))
    assert task.done is False
    assert isinstance(task.error, ValueError)


def test_task_flag_rejects_coroutine_functions() -> None:
    with pytest.raises(StreamlitValueError):

        @st.cache_data(task=True, show_spinner=False)
        async def fetch(value: int) -> int:
            return value
