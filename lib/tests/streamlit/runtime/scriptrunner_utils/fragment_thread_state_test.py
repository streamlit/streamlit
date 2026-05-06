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
import threading
import unittest

from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    FragmentThreadState,
    ScriptRunContext,
    _thread_state,
    get_fragment_thread_state,
)
from streamlit.runtime.state import SafeSessionState, SessionState


class FragmentThreadStateUnitTest(unittest.TestCase):
    def setUp(self):
        _thread_state.set(FragmentThreadState())

    def test_default_values(self):
        ts = get_fragment_thread_state()
        assert ts.fragment_id is None
        assert ts.delta_path is None
        assert ts.in_fragment_callback is False
        assert ts.active_script_hash == ""

    def test_set_and_get_fields(self):
        _thread_state.set(
            FragmentThreadState(
                fragment_id="frag-1",
                delta_path=(0, 1, 2),
                in_fragment_callback=True,
                active_script_hash="hash123",
            )
        )
        ts = get_fragment_thread_state()
        assert ts.fragment_id == "frag-1"
        assert ts.delta_path == (0, 1, 2)
        assert ts.in_fragment_callback is True
        assert ts.active_script_hash == "hash123"

    def test_isolation_via_copy_context(self):
        _thread_state.set(
            FragmentThreadState(
                fragment_id="parent",
                active_script_hash="parent_hash",
            )
        )

        child_ctx = contextvars.copy_context()

        def run_in_child():
            _thread_state.set(
                FragmentThreadState(
                    fragment_id="child",
                    active_script_hash="child_hash",
                )
            )
            child_ts = get_fragment_thread_state()
            assert child_ts.fragment_id == "child"
            assert child_ts.active_script_hash == "child_hash"

        child_ctx.run(run_in_child)

        parent_ts = get_fragment_thread_state()
        assert parent_ts.fragment_id == "parent"
        assert parent_ts.active_script_hash == "parent_hash"

    def test_run_with_active_hash_uses_thread_state(self):
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

        original_hash = get_fragment_thread_state().active_script_hash

        with ctx.run_with_active_hash("new_hash"):
            assert get_fragment_thread_state().active_script_hash == "new_hash"

        assert get_fragment_thread_state().active_script_hash == original_hash


class FragmentThreadStateUninitializedTest(unittest.TestCase):
    """Tests that run without a pre-initialized ContextVar."""

    def test_raises_runtime_error_without_initialization(self):
        """Verify get_fragment_thread_state() raises when the ContextVar has no value."""
        error: BaseException | None = None

        def check_in_fresh_thread():
            nonlocal error
            try:
                get_fragment_thread_state()
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


class FragmentThreadStateResetIntegrationTest(unittest.TestCase):
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

        ts = get_fragment_thread_state()
        assert ts.active_script_hash == pages_manager.main_script_hash
        assert ts.fragment_id is None
        assert ts.in_fragment_callback is False
        assert ts.delta_path is None
