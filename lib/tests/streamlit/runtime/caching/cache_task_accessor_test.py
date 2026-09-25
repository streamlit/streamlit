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

"""Unit tests for the `CachedFunc.task()` accessor."""

from __future__ import annotations

import threading
from typing import Any

import pytest

import streamlit as st
from streamlit.runtime.caching import cache_task


@pytest.fixture(autouse=True)
def _reset_task_manager() -> Any:
    cache_task.reset()
    yield
    cache_task.reset()


def _wait_until_done(task_of: Any) -> Any:
    """Poll a task accessor until it reports a settled handle."""
    tick = threading.Event()
    for _ in range(500):
        task = task_of()
        if not task.running:
            return task
        tick.wait(0.01)
    pytest.fail("Task did not settle in time")


def test_task_runs_off_the_script_thread_and_caches_its_value() -> None:
    calls: list[int] = []

    @st.cache_data(show_spinner=False)
    def double(value: int) -> int:
        calls.append(value)
        return value * 2

    task = _wait_until_done(lambda: double.task(3))
    assert task.done is True
    assert task.result == 6

    # The value is now in the cache, so a plain call does not recompute.
    assert double(3) == 6
    assert calls == [3]


def test_plain_call_is_unchanged_by_the_accessor() -> None:
    @st.cache_data(show_spinner=False)
    def double(value: int) -> int:
        return value * 2

    assert double(4) == 8
    # A cached value makes the task resolve without a worker.
    assert double.task(4).done is True


def test_task_reports_a_failure_through_the_handle() -> None:
    @st.cache_data(show_spinner=False)
    def explode(value: int) -> int:
        raise ValueError("boom")

    task = _wait_until_done(lambda: explode.task(1))
    assert task.done is False
    assert isinstance(task.error, ValueError)


def test_task_on_a_cached_method_binds_the_instance() -> None:
    class Repository:
        def __init__(self, factor: int) -> None:
            self.factor = factor

        @st.cache_data(show_spinner=False)
        def scale(_self, value: int) -> int:
            return value * _self.factor

    repository = Repository(3)
    task = _wait_until_done(lambda: repository.scale.task(2))
    assert task.result == 6


def test_task_rejects_coroutine_functions() -> None:
    @st.cache_data(show_spinner=False)
    async def fetch(value: int) -> int:
        return value

    with pytest.raises(st.errors.StreamlitAPIException):
        fetch.task(1)
