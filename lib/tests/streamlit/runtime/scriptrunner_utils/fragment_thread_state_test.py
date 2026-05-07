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

import contextvars
import dataclasses
import threading
import unittest

import pytest

from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ScriptRunContext,
    ThreadState,
)
from streamlit.runtime.state import SafeSessionState, SessionState


class ThreadStateUnitTest(unittest.TestCase):
    def setUp(self):
        ThreadState.initialize()

    def test_default_values(self):
        ts = ThreadState.get()
        assert ts.fragment_id is None
        assert ts.delta_path is None
        assert ts.in_fragment_callback is False
        assert ts.active_script_hash == ""

    def test_initialize_with_kwargs(self):
        ThreadState.initialize(
            fragment_id="frag-1",
            delta_path=(0, 1, 2),
            in_fragment_callback=True,
            active_script_hash="hash123",
        )
        ts = ThreadState.get()
        assert ts.fragment_id == "frag-1"
        assert ts.delta_path == (0, 1, 2)
        assert ts.in_fragment_callback is True
        assert ts.active_script_hash == "hash123"

    def test_update_fields(self):
        ThreadState.update(fragment_id="updated", active_script_hash="new_hash")
        ts = ThreadState.get()
        assert ts.fragment_id == "updated"
        assert ts.active_script_hash == "new_hash"
        assert ts.in_fragment_callback is False
        assert ts.delta_path is None

    def test_frozen_prevents_mutation(self):
        ts = ThreadState.get()
        with pytest.raises(dataclasses.FrozenInstanceError):
            ts.fragment_id = "oops"

    def test_isolation_via_copy_context(self):
        ThreadState.initialize(
            fragment_id="parent",
            active_script_hash="parent_hash",
        )

        child_ctx = contextvars.copy_context()

        def run_in_child():
            ThreadState.initialize(
                fragment_id="child",
                active_script_hash="child_hash",
            )
            child_ts = ThreadState.get()
            assert child_ts.fragment_id == "child"
            assert child_ts.active_script_hash == "child_hash"

        child_ctx.run(run_in_child)

        parent_ts = ThreadState.get()
        assert parent_ts.fragment_id == "parent"
        assert parent_ts.active_script_hash == "parent_hash"

    def test_scoped_overrides_and_restores(self):
        ThreadState.initialize(fragment_id="outer", active_script_hash="hash1")

        with ThreadState.scoped(fragment_id="inner"):
            ts = ThreadState.get()
            assert ts.fragment_id == "inner"
            assert ts.active_script_hash == "hash1"

        ts = ThreadState.get()
        assert ts.fragment_id == "outer"
        assert ts.active_script_hash == "hash1"

    def test_scoped_restores_on_exception(self):
        ThreadState.initialize(fragment_id="original")

        with pytest.raises(ValueError, match="boom"):
            with ThreadState.scoped(fragment_id="temporary"):
                assert ThreadState.get().fragment_id == "temporary"
                raise ValueError("boom")

        assert ThreadState.get().fragment_id == "original"

    def test_scoped_nested(self):
        ThreadState.initialize(fragment_id="level0")

        with ThreadState.scoped(fragment_id="level1"):
            assert ThreadState.get().fragment_id == "level1"
            with ThreadState.scoped(fragment_id="level2"):
                assert ThreadState.get().fragment_id == "level2"
            assert ThreadState.get().fragment_id == "level1"

        assert ThreadState.get().fragment_id == "level0"

    def test_run_with_active_hash_uses_scoped(self):
        pages_manager = PagesManager("")
        ctx = ScriptRunContext(
            session_id="TestSessionID",
            _enqueue=lambda _msg: None,
            query_string="",
            session_state=SafeSessionState(SessionState(), lambda: None),
            uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
            main_script_path="",
            user_info={"email": "test@example.com"},
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=pages_manager,
        )
        ctx.reset(page_script_hash="main")

        original_hash = ThreadState.get().active_script_hash

        with ctx.run_with_active_hash("new_hash"):
            assert ThreadState.get().active_script_hash == "new_hash"

        assert ThreadState.get().active_script_hash == original_hash


class ThreadStateUninitializedTest(unittest.TestCase):
    """Tests that run without a pre-initialized ContextVar."""

    def test_raises_runtime_error_without_initialization(self):
        """Verify ThreadState.get() raises when the ContextVar has no value."""
        error: BaseException | None = None

        def check_in_fresh_thread():
            nonlocal error
            try:
                ThreadState.get()
                error = AssertionError("Expected RuntimeError was not raised")
            except RuntimeError as e:
                if "FragmentThreadState not initialized" not in str(e):
                    error = AssertionError(f"Wrong error message: {e}")
            except BaseException as e:
                error = e

        t = threading.Thread(target=check_in_fresh_thread)
        t.start()
        t.join()
        if error is not None:
            raise error


class ThreadStateResetIntegrationTest(unittest.TestCase):
    def test_reset_sets_thread_state(self):
        pages_manager = PagesManager("")
        ctx = ScriptRunContext(
            session_id="TestSessionID",
            _enqueue=lambda _msg: None,
            query_string="",
            session_state=SafeSessionState(SessionState(), lambda: None),
            uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
            main_script_path="",
            user_info={"email": "test@example.com"},
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=pages_manager,
        )

        ctx.reset(page_script_hash="abc")

        ts = ThreadState.get()
        assert ts.active_script_hash == pages_manager.main_script_hash
        assert ts.fragment_id is None
        assert ts.in_fragment_callback is False
        assert ts.delta_path is None
