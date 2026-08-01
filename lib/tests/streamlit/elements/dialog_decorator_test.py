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

"""Tests for dialog decorator."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from streamlit.testing.v1 import AppTest


def test_dialog_raises_from_parallel_worker() -> None:
    """@st.dialog raises StreamlitAPIException when called from a parallel worker."""
    ThreadState.initialize(is_parallel_worker=True)
    try:

        @st.dialog("Test")
        def my_dialog() -> None:
            st.write("Hello")

        with pytest.raises(StreamlitAPIException) as exc_info:
            my_dialog()

        assert "@st.dialog" in str(exc_info.value)
        assert "parallel fragment" in str(exc_info.value)
    finally:
        ThreadState.initialize(is_parallel_worker=False)


def test_dialog_allowed_when_not_parallel_worker() -> None:
    """@st.dialog calls _check_not_parallel_worker and does not raise when is_parallel_worker=False."""
    ThreadState.initialize(is_parallel_worker=False)
    try:
        with patch(
            "streamlit.elements.dialog_decorator._check_not_parallel_worker"
        ) as mock_check:
            # Decorator applies at definition time, so the check should be called
            # when my_dialog() is invoked

            # We still need to mock the dialog machinery to avoid errors from
            # incomplete setup, but we're specifically testing that:
            # 1. _check_not_parallel_worker is called
            # 2. It doesn't raise (because is_parallel_worker=False)
            with (
                patch("streamlit.elements.dialog_decorator.get_dg_singleton_instance"),
                patch(
                    "streamlit.elements.dialog_decorator.get_last_dg_added_to_context_stack",
                    return_value=None,
                ),
                patch("streamlit.runtime.fragment.get_script_run_ctx") as mock_ctx,
            ):
                mock_ctx.return_value = MagicMock()
                mock_ctx.return_value.fragment_storage = MagicMock()

                @st.dialog("Test")
                def my_dialog() -> None:
                    st.write("Hello")

                my_dialog()

            mock_check.assert_called_once_with("@st.dialog")
    finally:
        ThreadState.initialize(is_parallel_worker=False)


# ---------------------------------------------------------------------------
# Regression tests for https://github.com/streamlit/streamlit/issues/13009
# Dialog re-executed when st.rerun() is called inside an if-button block.
# ---------------------------------------------------------------------------


def _dialog_rerun_script() -> None:
    """Script for testing dialog + st.rerun() inside a button conditional."""
    import streamlit as st

    if "dialog_run_count" not in st.session_state:
        st.session_state.dialog_run_count = 0

    @st.dialog("Expensive operation")
    def work_dialog():
        # Track each time the dialog body executes.
        st.session_state.dialog_run_count += 1
        st.write("Work done!")
        # Bug scenario: st.rerun() behind a button conditional.
        if st.button("Done", key="done_btn"):
            st.rerun()

    if st.button("Open", key="open_btn"):
        work_dialog()


def test_dialog_body_does_not_reexecute_after_rerun_from_button_conditional() -> None:
    """Regression test: dialog body must run exactly once after the user clicks
    'Done' inside the dialog.  Before the fix, calling st.rerun() behind an
    st.button conditional caused the outer button's trigger to survive into the
    following full-app run, re-opening the dialog and repeating the work.

    Covers issue #13009.
    """
    at = AppTest.from_function(_dialog_rerun_script).run()
    assert at.session_state["dialog_run_count"] == 0

    # Open the dialog — body runs once.
    at = at.button(key="open_btn").click().run()
    assert at.session_state["dialog_run_count"] == 1
    assert any(b.key == "done_btn" for b in at.button), "dialog should be visible"

    # Click 'Done' inside the dialog — dialog must close, body must NOT re-run.
    at = at.button(key="done_btn").click().run()
    assert at.session_state["dialog_run_count"] == 1, (
        "Dialog body re-executed after st.rerun() in button conditional (issue #13009)"
    )
    assert not any(b.key == "done_btn" for b in at.button), (
        "Dialog should be closed after st.rerun()"
    )


def test_dialog_without_button_conditional_also_closes() -> None:
    """Control case: a dialog that calls st.rerun() unconditionally (via session
    state sentinel) must also close after one interaction.  This ensures the fix
    does not regress the non-buggy pattern.
    """

    def script() -> None:
        import streamlit as st

        if "dialog_run_count" not in st.session_state:
            st.session_state.dialog_run_count = 0
        if "should_close" not in st.session_state:
            st.session_state.should_close = False

        @st.dialog("Dialog")
        def dialog() -> None:
            st.session_state.dialog_run_count += 1
            st.button("Done", key="done_btn")
            if st.session_state.should_close:
                st.session_state.should_close = False
                st.rerun()

        if st.button("Open", key="open_btn"):
            dialog()

    at = AppTest.from_function(script).run()
    assert at.session_state["dialog_run_count"] == 0

    at = at.button(key="open_btn").click().run()
    assert at.session_state["dialog_run_count"] == 1

    # Trigger close via session state sentinel (workaround pattern).
    at.session_state["should_close"] = True
    at = at.button(key="done_btn").click().run()
    assert at.session_state["dialog_run_count"] == 1, (
        "Dialog body re-executed using session-state sentinel close pattern"
    )
    assert not any(b.key == "done_btn" for b in at.button)
