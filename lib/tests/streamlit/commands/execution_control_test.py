# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from streamlit.commands.execution_control import _new_fragment_id_queue, rerun
from streamlit.errors import StreamlitAPIException
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

        with pytest.raises(AssertionError):
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
def test_st_rerun_is_fragment_scoped_rerun_flag_False(patched_get_script_run_ctx):
    ctx = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    rerun(scope="app")

    ctx.script_requests.request_rerun.assert_called_with(
        RerunData(
            query_string=ctx.query_string,
            page_script_hash=ctx.page_script_hash,
            fragment_id_queue=[],
            is_fragment_scoped_rerun=False,
        )
    )


@patch(
    "streamlit.commands.execution_control._new_fragment_id_queue",
    MagicMock(return_value=["some_fragment_ids"]),
)
@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_rerun_is_fragment_scoped_rerun_flag_True(patched_get_script_run_ctx):
    ctx = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    rerun(scope="fragment")

    ctx.script_requests.request_rerun.assert_called_with(
        RerunData(
            query_string=ctx.query_string,
            page_script_hash=ctx.page_script_hash,
            fragment_id_queue=["some_fragment_ids"],
            is_fragment_scoped_rerun=True,
        )
    )
