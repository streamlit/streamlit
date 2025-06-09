# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.commands.execution_control import (
    _new_fragment_id_queue,
    rerun,
    switch_page,
)
from streamlit.errors import StreamlitAPIException
from streamlit.navigation.page import StreamlitPage
from streamlit.runtime.scriptrunner import RerunData


class NewFragmentIdQueueTest(unittest.TestCase):
    def test_returns_empty_list_if_scope_is_app(self):
        assert _new_fragment_id_queue(None, scope="app") == []

    def test_raises_exception_if_no_fragment_id_queue(self):
        ctx = MagicMock()
        ctx.fragment_ids_this_run = []

        with pytest.raises(StreamlitAPIException):
            _new_fragment_id_queue(ctx, scope="fragment")

    def test_asserts_if_curr_id_not_in_queue(self):
        ctx = MagicMock()
        ctx.fragment_ids_this_run = ["some_fragment_id"]
        ctx.current_fragment_id = "some_other_fragment_id"

        with pytest.raises(
            RuntimeError,
            match="Could not find current_fragment_id in fragment_id_queue. This should never happen.",
        ):
            _new_fragment_id_queue(ctx, scope="fragment")

    def test_drops_items_in_queue_until_curr_id(self):
        ctx = MagicMock()
        ctx.fragment_ids_this_run = [
            "id1",
            "id2",
            "id3",
            "curr_id",
            "id4",
            "id5",
        ]
        ctx.current_fragment_id = "curr_id"

        assert _new_fragment_id_queue(ctx, scope="fragment") == [
            "curr_id",
            "id4",
            "id5",
        ]


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_rerun_is_fragment_scoped_rerun_flag_false(patched_get_script_run_ctx):
    ctx = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    rerun(scope="app")

    ctx.script_requests.request_rerun.assert_called_with(
        RerunData(
            query_string=ctx.query_string,
            page_script_hash=ctx.page_script_hash,
            fragment_id_queue=[],
            is_fragment_scoped_rerun=False,
            cached_message_hashes=ctx.cached_message_hashes,
            context_info=ctx.context_info,
        )
    )


@patch(
    "streamlit.commands.execution_control._new_fragment_id_queue",
    MagicMock(return_value=["some_fragment_ids"]),
)
@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_rerun_is_fragment_scoped_rerun_flag_true(patched_get_script_run_ctx):
    ctx = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    rerun(scope="fragment")

    ctx.script_requests.request_rerun.assert_called_with(
        RerunData(
            query_string=ctx.query_string,
            page_script_hash=ctx.page_script_hash,
            fragment_id_queue=["some_fragment_ids"],
            is_fragment_scoped_rerun=True,
            cached_message_hashes=ctx.cached_message_hashes,
            context_info=ctx.context_info,
        )
    )


def test_st_rerun_invalid_scope_throws_error():
    with pytest.raises(StreamlitAPIException):
        rerun(scope="foo")


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_context_info(patched_get_script_run_ctx):
    """Test that context_info is passed to RerunData in st.switch_page."""
    ctx = MagicMock()
    ctx.pages_manager = MagicMock()  # Ensure pages_manager is present
    ctx.main_script_path = "/some/path/your_app.py"
    ctx.query_string = ""
    ctx.page_script_hash = "some_hash"  # This is for the current page, not the target
    ctx.cached_message_hashes = MagicMock()
    ctx.context_info = {"test_key": "test_value"}  # Set a specific context_info

    patched_get_script_run_ctx.return_value = ctx

    # Mock the StreamlitPage object and its _script_hash attribute
    mock_page = MagicMock(spec=StreamlitPage)
    mock_page._script_hash = "target_page_hash"

    with patch(
        "streamlit.commands.execution_control.get_main_script_directory",
        return_value="/some/path",
    ):
        switch_page(mock_page)

    ctx.script_requests.request_rerun.assert_called_once()
    call_args = ctx.script_requests.request_rerun.call_args[0][0]
    assert isinstance(call_args, RerunData)
    assert call_args.page_script_hash == "target_page_hash"
    assert call_args.context_info == {"test_key": "test_value"}
    # check that query_params.clear() was called
    ctx.session_state.query_params.assert_called_once()
