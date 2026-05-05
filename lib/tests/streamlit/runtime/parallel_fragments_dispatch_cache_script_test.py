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

"""U16/U21/U22 plus ScriptRunner integrations U25/U26."""

from __future__ import annotations

import threading
import time
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.delta_generator_singletons import (
    context_dg_stack,
    get_dg_singleton_instance,
)
from streamlit.runtime import Runtime
from streamlit.runtime.fragment import (
    ParallelFragmentCoordinator,
    _dispatch_parallel_fragment,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.scriptrunner import ScriptRunnerEvent, add_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_requests import RerunData
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    FragmentThreadState,
    _thread_state,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit.runtime.scriptrunner.script_runner_test import TestScriptRunner

if TYPE_CHECKING:
    from collections.abc import Iterator


@pytest.fixture
def patched_runtime() -> Iterator[None]:
    """ScriptRunner clears media refs via ``runtime.get_instance()``."""
    mock_runtime = MagicMock(spec=Runtime)
    media_mgr = MediaFileManager(MemoryMediaFileStorage("/mock/media"))
    media_mgr.clear_session_refs = MagicMock()
    mock_runtime.media_file_mgr = media_mgr

    previous = Runtime._instance
    Runtime._instance = mock_runtime
    try:
        yield
    finally:
        Runtime._instance = previous


class NestedParallelFragmentTests(DeltaGeneratorTestCase):
    """U23/U24 — nested fragment scenarios inside parallel workers."""

    def test_u23_nested_parallel_fragment_inner_thread(self) -> None:
        """U23: A parallel fragment nested inside another parallel fragment
        dispatches on the coordinator and runs in a separate thread."""
        coordinator = ParallelFragmentCoordinator(
            yield_check=lambda: None, poll_interval=0.01
        )
        self.script_run_ctx.parallel_coordinator = coordinator

        outer_ident: list[int] = []
        inner_ident: list[int] = []

        def inner_wrapped() -> None:
            inner_ident.append(threading.get_ident())

        def outer_wrapped() -> None:
            outer_ident.append(threading.get_ident())
            _dispatch_parallel_fragment(
                ctx=self.script_run_ctx,
                fragment_id="u23-inner",
                wrapped_fragment=inner_wrapped,
            )

        _dispatch_parallel_fragment(
            ctx=self.script_run_ctx,
            fragment_id="u23-outer",
            wrapped_fragment=outer_wrapped,
        )
        coordinator.join()

        assert len(outer_ident) == 1
        assert len(inner_ident) == 1
        assert outer_ident[0] != threading.get_ident(), "outer ran on a worker thread"
        assert inner_ident[0] != threading.get_ident(), "inner ran on a worker thread"
        assert outer_ident[0] != inner_ident[0], (
            "inner ran on a different thread than outer"
        )

    def test_u24_nested_regular_fragment_shares_outer_worker_thread(self) -> None:
        """U24: A regular (non-parallel) fragment nested inside a parallel
        fragment runs on the same thread as the outer parallel worker."""
        coordinator = ParallelFragmentCoordinator(
            yield_check=lambda: None, poll_interval=0.01
        )
        self.script_run_ctx.parallel_coordinator = coordinator

        outer_ident: list[int] = []
        inner_ident: list[int] = []

        def inner_wrapped() -> None:
            inner_ident.append(threading.get_ident())

        def outer_wrapped() -> None:
            outer_ident.append(threading.get_ident())
            inner_wrapped()

        _dispatch_parallel_fragment(
            ctx=self.script_run_ctx,
            fragment_id="u24-outer",
            wrapped_fragment=outer_wrapped,
        )
        coordinator.join()

        assert len(outer_ident) == 1
        assert len(inner_ident) == 1
        assert outer_ident[0] != threading.get_ident(), "outer ran on a worker thread"
        assert outer_ident[0] == inner_ident[0], "inner ran on same thread as outer"


class ParallelFragmentsDispatchAndCacheTests(DeltaGeneratorTestCase):
    """U16/U21/U22 — exercised inside the DG sandbox."""

    def tearDown(self) -> None:
        st.cache_data.clear()
        super().tearDown()

    def test_u16_dispatch_parallel_fragment_restores_main_stack_and_prepares_worker(
        self,
    ) -> None:
        """U16: main thread pops the fragment container DG; worker inherits it."""
        coordinator = ParallelFragmentCoordinator(
            yield_check=lambda: None, poll_interval=0.01
        )
        self.script_run_ctx.parallel_coordinator = coordinator
        baseline = len(context_dg_stack.get())
        worker_lens: list[int] = []

        def wrapped_fragment() -> None:
            worker_lens.append(len(context_dg_stack.get()))

        _dispatch_parallel_fragment(
            ctx=self.script_run_ctx,
            fragment_id="u16-test-frag",
            wrapped_fragment=wrapped_fragment,
        )
        coordinator.join()
        assert len(context_dg_stack.get()) == baseline
        assert worker_lens == [baseline + 1]

    def test_u21_cache_data_survives_concurrent_reads(self) -> None:
        """U21: concurrent callers read the cached value without exceptions."""
        call_count = {"n": 0}

        @st.cache_data
        def triple(x: int) -> int:
            call_count["n"] += 1
            return x * 3

        barrier = threading.Barrier(6)
        errors: list[BaseException] = []

        def runner() -> None:
            try:
                add_script_run_ctx(threading.current_thread(), self.script_run_ctx)
                barrier.wait()
                assert triple(5) == 15
            except BaseException as e:
                errors.append(e)

        assert triple(5) == 15

        threads = [threading.Thread(target=runner) for _ in range(5)]
        for t in threads:
            t.start()
        barrier.wait()
        for t in threads:
            t.join(timeout=60.0)
            assert not t.is_alive()

        assert not errors
        assert call_count["n"] == 1

    def test_u22_parallel_worker_cache_miss_skips_spinner_cm(self) -> None:
        """U22: cache miss computation must not allocate a spinner on parallel workers."""
        main_dg = get_dg_singleton_instance().main_dg

        outer_token = _thread_state.set(FragmentThreadState(is_parallel_worker=True))
        try:
            with patch.object(main_dg, "spinner") as spinner_patch:

                @st.cache_data(show_spinner=True)
                def heavy() -> int:
                    return 123

                assert heavy() == 123
                spinner_patch.assert_not_called()
        finally:
            _thread_state.reset(outer_token)


@pytest.mark.usefixtures("patched_runtime")
def test_u25_parallel_fragment_script_runner_writes_expected_delta() -> None:
    """U25: a full-app run with parallel fragments emits worker content."""
    runner = TestScriptRunner("parallel_fragment_smoke_script.py")
    runner.start()
    runner.join()

    haystack = "".join(runner.text_deltas())
    assert "pf_parallel_marker" in haystack


@pytest.mark.usefixtures("patched_runtime")
def test_u26_rerun_requested_during_parallel_join_emits_finished_for_rerun() -> None:
    """U26: pending rerun during coordinator join bubbles out as SCRIPT_STOPPED_FOR_RERUN."""
    runner = TestScriptRunner("parallel_slow_fragment_barrier_script.py")

    def ask_rerun() -> None:
        time.sleep(0.08)
        assert runner.request_rerun(RerunData())

    threading.Thread(target=ask_rerun, daemon=True).start()
    runner.start()
    runner.join()

    assert runner.events.count(ScriptRunnerEvent.SCRIPT_STOPPED_FOR_RERUN) >= 1
