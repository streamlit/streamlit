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

import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from streamlit.commands.execution_control import (
    _new_fragment_id_queue,
    rerun,
    switch_page,
)
from streamlit.errors import NoSessionContext, StreamlitAPIException
from streamlit.navigation.page import StreamlitPage
from streamlit.runtime.scriptrunner import RerunData
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState


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
        ThreadState.initialize(fragment_id="some_other_fragment_id")

        with pytest.raises(
            RuntimeError,
            match=r"Could not find current_fragment_id in fragment_id_queue. This should never happen.",
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
        ThreadState.initialize(fragment_id="curr_id")

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
    ctx.script_requests = MagicMock()
    ctx.main_script_path = "/some/path/your_app.py"
    ctx.query_string = ""
    ctx.page_script_hash = "some_hash"  # This is for the current page, not the target
    ctx.cached_message_hashes = MagicMock()
    ctx.context_info = {"test_key": "test_value"}  # Set a specific context_info
    ctx.session_state = MagicMock()

    query_params_cm = MagicMock()
    mock_query_params = MagicMock()
    query_params_cm.__enter__.return_value = mock_query_params
    query_params_cm.__exit__.return_value = False
    ctx.session_state.query_params.return_value = query_params_cm

    patched_get_script_run_ctx.return_value = ctx

    # Mock the StreamlitPage object and its _script_hash attribute
    mock_page = MagicMock(spec=StreamlitPage)
    mock_page._script_hash = "target_page_hash"
    mock_page.is_external = False

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
    mock_query_params.clear.assert_called_once_with()
    mock_query_params.from_dict.assert_not_called()


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_applies_query_params(patched_get_script_run_ctx):
    """Test that providing query_params sets them before rerunning."""
    ctx = MagicMock()
    ctx.query_string = ""
    ctx.cached_message_hashes = frozenset()
    ctx.context_info = {"foo": "bar"}
    ctx.script_requests = MagicMock()
    ctx.session_state = MagicMock()

    query_params_cm = MagicMock()
    mock_query_params = MagicMock()
    query_params_cm.__enter__.return_value = mock_query_params
    query_params_cm.__exit__.return_value = False
    ctx.session_state.query_params.return_value = query_params_cm

    def _from_dict_side_effect(value):
        assert value == {"team": "streamlit"}
        ctx.query_string = "team=streamlit"

    mock_query_params.from_dict.side_effect = _from_dict_side_effect

    mocked_page = MagicMock(spec=StreamlitPage)
    mocked_page._script_hash = "target_page_hash"
    mocked_page.is_external = False

    patched_get_script_run_ctx.return_value = ctx

    switch_page(mocked_page, query_params={"team": "streamlit"})

    mock_query_params.from_dict.assert_called_once_with({"team": "streamlit"})
    mock_query_params.clear.assert_not_called()

    ctx.script_requests.request_rerun.assert_called_once()
    rerun_arg = ctx.script_requests.request_rerun.call_args[0][0]
    assert isinstance(rerun_arg, RerunData)
    assert rerun_arg.query_string == "team=streamlit"
    assert rerun_arg.page_script_hash == "target_page_hash"


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_applies_iterable_query_params(patched_get_script_run_ctx):
    """Test that tuple-based query_params are accepted."""
    ctx = MagicMock()
    ctx.query_string = ""
    ctx.cached_message_hashes = frozenset()
    ctx.context_info = {}
    ctx.script_requests = MagicMock()
    ctx.session_state = MagicMock()

    query_params_cm = MagicMock()
    mock_query_params = MagicMock()
    query_params_cm.__enter__.return_value = mock_query_params
    query_params_cm.__exit__.return_value = False
    ctx.session_state.query_params.return_value = query_params_cm

    query_param_items = [
        ("foo", "bar"),
        ("stream", ["lit", "rocks"]),
    ]

    def _from_dict_side_effect(value):
        assert value == query_param_items
        ctx.query_string = "foo=bar&stream=lit&stream=rocks"

    mock_query_params.from_dict.side_effect = _from_dict_side_effect

    mocked_page = MagicMock(spec=StreamlitPage)
    mocked_page._script_hash = "target_page_hash"
    mocked_page.is_external = False

    patched_get_script_run_ctx.return_value = ctx

    switch_page(mocked_page, query_params=query_param_items)

    mock_query_params.from_dict.assert_called_once_with(query_param_items)
    mock_query_params.clear.assert_not_called()

    ctx.script_requests.request_rerun.assert_called_once()
    rerun_arg = ctx.script_requests.request_rerun.call_args[0][0]
    assert isinstance(rerun_arg, RerunData)
    assert rerun_arg.query_string == "foo=bar&stream=lit&stream=rocks"
    assert rerun_arg.page_script_hash == "target_page_hash"


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_rejects_invalid_query_params(patched_get_script_run_ctx):
    """Test that invalid query_params types raise a StreamlitAPIException."""
    ctx = MagicMock()
    ctx.session_state = MagicMock()
    ctx.script_requests = MagicMock()
    ctx.query_string = ""
    ctx.cached_message_hashes = frozenset()
    ctx.context_info = {}

    query_params_cm = MagicMock()
    mock_query_params = MagicMock()
    query_params_cm.__enter__.return_value = mock_query_params
    query_params_cm.__exit__.return_value = False
    ctx.session_state.query_params.return_value = query_params_cm

    patched_get_script_run_ctx.return_value = ctx

    mocked_page = MagicMock(spec=StreamlitPage)
    mocked_page._script_hash = "target_page_hash"
    mocked_page.is_external = False

    with pytest.raises(StreamlitAPIException, match=r"`query_params` must be"):
        switch_page(mocked_page, query_params="not valid")  # type: ignore[arg-type]

    ctx.script_requests.request_rerun.assert_not_called()
    mock_query_params.clear.assert_not_called()
    mock_query_params.from_dict.assert_not_called()


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_raises_for_external_page(patched_get_script_run_ctx):
    """Test that st.switch_page raises an error for external URL pages."""
    ctx = MagicMock()
    ctx.script_requests = MagicMock()
    patched_get_script_run_ctx.return_value = ctx

    mock_page = MagicMock(spec=StreamlitPage)
    mock_page.is_external = True

    with pytest.raises(
        StreamlitAPIException,
        match=r"Cannot use st\.switch_page with external URL pages",
    ):
        switch_page(mock_page)

    ctx.script_requests.request_rerun.assert_not_called()


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_raises_no_session_context_when_no_ctx(
    patched_get_script_run_ctx,
):
    """``switch_page`` raises ``NoSessionContext`` when called without a session."""
    patched_get_script_run_ctx.return_value = None

    with pytest.raises(NoSessionContext):
        switch_page("any_page.py")


@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_raises_no_session_context_when_ctx_has_no_requests(
    patched_get_script_run_ctx,
):
    """``switch_page`` raises ``NoSessionContext`` if ``ctx`` lacks script requests."""
    ctx = MagicMock()
    ctx.script_requests = None
    patched_get_script_run_ctx.return_value = ctx

    with pytest.raises(NoSessionContext):
        switch_page("any_page.py")


def test_switch_page_raises_from_parallel_worker() -> None:
    """st.switch_page raises StreamlitAPIException when called from a parallel worker."""
    ThreadState.initialize(is_parallel_worker=True)
    try:
        with pytest.raises(StreamlitAPIException) as exc_info:
            switch_page("pages/test.py")

        assert "st.switch_page" in str(exc_info.value)
        assert "parallel fragment" in str(exc_info.value)
    finally:
        ThreadState.initialize(is_parallel_worker=False)


def _make_pages_lookup_ctx(resolved_script_path: str) -> MagicMock:
    """Return a mocked ``ScriptRunContext`` with a single registered page."""
    ctx = MagicMock()
    ctx.script_requests = MagicMock()
    ctx.session_state = MagicMock()
    ctx.query_string = ""
    ctx.cached_message_hashes = MagicMock()
    ctx.context_info = {}
    ctx.main_script_path = "/some/path/your_app.py"
    ctx.pages_manager.get_pages.return_value = {
        "hash_1": {
            "script_path": resolved_script_path,
            "page_script_hash": "page_1_hash",
        },
    }

    query_params_cm = MagicMock()
    query_params_cm.__enter__.return_value = MagicMock()
    query_params_cm.__exit__.return_value = False
    ctx.session_state.query_params.return_value = query_params_cm

    return ctx


@pytest.mark.parametrize(
    "page_arg",
    [
        pytest.param("pages/page_1.py", id="string_path"),
        pytest.param(Path("pages/page_1.py"), id="path_object"),
    ],
)
@patch("streamlit.commands.execution_control.normalize_path_join")
@patch(
    "streamlit.commands.execution_control.get_main_script_directory",
    return_value="/some/path",
)
@patch("os.path.realpath", side_effect=lambda p: p)
@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_with_path_argument(
    patched_get_script_run_ctx,
    _patched_realpath,
    _patched_get_main_script_directory,
    patched_normalize_path_join,
    page_arg,
):
    """``switch_page`` resolves both ``str`` and ``pathlib.Path`` arguments via the pages manager."""
    patched_normalize_path_join.return_value = "/some/path/pages/page_1.py"
    ctx = _make_pages_lookup_ctx("/some/path/pages/page_1.py")
    patched_get_script_run_ctx.return_value = ctx

    switch_page(page_arg)

    ctx.script_requests.request_rerun.assert_called_once()
    rerun_arg = ctx.script_requests.request_rerun.call_args[0][0]
    assert rerun_arg.page_script_hash == "page_1_hash"


@patch("streamlit.commands.execution_control.normalize_path_join")
@patch(
    "streamlit.commands.execution_control.get_main_script_directory",
    return_value="/some/path",
)
@patch("os.path.realpath", side_effect=lambda p: p)
@patch("streamlit.commands.execution_control.get_script_run_ctx")
def test_st_switch_page_string_path_unknown_page_raises(
    patched_get_script_run_ctx,
    _patched_realpath,
    _patched_get_main_script_directory,
    patched_normalize_path_join,
):
    """``switch_page`` raises ``StreamlitAPIException`` if the resolved path is unknown."""
    patched_normalize_path_join.return_value = "/some/path/missing.py"
    ctx = _make_pages_lookup_ctx("/some/path/pages/page_1.py")
    patched_get_script_run_ctx.return_value = ctx

    with pytest.raises(StreamlitAPIException, match=r"Could not find page"):
        switch_page("missing.py")

    ctx.script_requests.request_rerun.assert_not_called()
