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


def test_dialog_raises_from_parallel_worker() -> None:
    """@st.dialog raises StreamlitAPIException when called from a parallel worker."""
    ThreadState.initialize(is_parallel_worker=True)

    @st.dialog("Test")
    def my_dialog() -> None:
        st.write("Hello")

    with pytest.raises(StreamlitAPIException) as exc_info:
        my_dialog()

    assert "@st.dialog" in str(exc_info.value)
    assert "parallel fragment" in str(exc_info.value)


def test_dialog_allowed_when_not_parallel_worker() -> None:
    """@st.dialog does not raise when is_parallel_worker=False."""
    ThreadState.initialize(is_parallel_worker=False)

    # We need to mock out various parts of the dialog machinery
    # to test that the parallel worker check passes without setting up
    # the full Streamlit context
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

        # The dialog should not raise a parallel worker exception.
        # Other exceptions may occur due to incomplete mocking, but those
        # are not what we're testing.
        raised_parallel_error = False
        try:
            my_dialog()
        except StreamlitAPIException as exc:
            if "parallel fragment" in str(exc):
                raised_parallel_error = True
        except Exception:
            pass

        assert not raised_parallel_error, "Dialog raised parallel worker error unexpectedly"
