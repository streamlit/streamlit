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

"""Tests ScriptRunner functionality"""

from __future__ import annotations

import os
import sys
import time
import unittest
from typing import TYPE_CHECKING, Any
from unittest.mock import MagicMock, call, patch

import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.delta_generator import DeltaGenerator
from streamlit.delta_generator_singletons import context_dg_stack
from streamlit.elements.exception import _GENERIC_UNCAUGHT_EXCEPTION_TEXT
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.fragment import (
    MemoryFragmentStorage,
    _fragment,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.parallel_coordinator import ParallelFragmentCoordinator
from streamlit.runtime.scriptrunner import (
    RerunData,
    RerunException,
    ScriptRunner,
    ScriptRunnerEvent,
    StopException,
)
from streamlit.runtime.scriptrunner import script_runner as script_runner_module
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.scriptrunner.script_runner import (
    _clean_problem_modules,
    _log_if_error,
)
from streamlit.runtime.scriptrunner_utils.script_requests import (
    ScriptRequest,
    ScriptRequests,
    ScriptRequestType,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ThreadState,
    get_script_run_ctx,
)
from streamlit.runtime.state.session_state import SessionState
from tests import testutil

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.Delta_pb2 import Delta
    from streamlit.proto.Element_pb2 import Element
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

text_utf = "complete! 👨‍🎤"
text_utf2 = "complete2! 👨‍🎤"
text_no_encoding = text_utf
text_latin = "complete! ð\x9f\x91¨â\x80\x8dð\x9f\x8e¤"


def _create_widget(id: str, states: WidgetStates) -> WidgetState:
    """
    Returns
    -------
    streamlit.proto.WidgetStates_pb2.WidgetState

    """
    states.widgets.add().id = id
    return states.widgets[-1]


def _is_control_event(event: ScriptRunnerEvent) -> bool:
    """True if the given ScriptRunnerEvent is a 'control' event, as opposed
    to a 'data' event.
    """
    # There's only one data event type.
    return event != ScriptRunnerEvent.ENQUEUE_FORWARD_MSG


class ScriptRunnerTest(unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.media_file_mgr = MediaFileManager(
            MemoryMediaFileStorage("/mock/media")
        )
        mock_runtime.media_file_mgr.clear_session_refs = MagicMock()
        Runtime._instance = mock_runtime

    def tearDown(self) -> None:
        super().tearDown()
        Runtime._instance = None

    def test_startup_shutdown(self):
        """Test that we can create and shut down a ScriptRunner."""
        scriptrunner = TestScriptRunner("good_script.py")

        # Request that the ScriptRunner stop before it even starts, so that
        # it doesn't start the script at all.
        scriptrunner.request_stop()

        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_control_events(scriptrunner, [ScriptRunnerEvent.SHUTDOWN])
        self._assert_text_deltas(scriptrunner, [])

    def test_yield_on_enqueue(self):
        """Make sure we try to handle execution control requests whenever
        our _enqueue_forward_msg function is called.
        """
        # Create a TestScriptRunner. We won't actually be starting its
        # script thread - instead, we'll manually call _enqueue_forward_msg on it, and
        # pretend we're in the script thread.
        runner = TestScriptRunner("not_a_script.py")
        runner._is_in_script_thread = MagicMock(return_value=True)

        # Mock the call to _maybe_handle_execution_control_request.
        # This is what we're testing gets called or not.
        maybe_handle_execution_control_request_mock = MagicMock()
        runner._maybe_handle_execution_control_request = (
            maybe_handle_execution_control_request_mock
        )

        # Enqueue a ForwardMsg on the runner
        mock_msg = MagicMock()
        runner._enqueue_forward_msg(mock_msg)

        # Ensure the ForwardMsg was delivered to event listeners.
        self._assert_forward_msgs(runner, [mock_msg])

        # maybe_handle_execution_control_request should be called by the
        # enqueue function.
        assert maybe_handle_execution_control_request_mock.call_count == 1

    def test_dont_enqueue_with_pending_script_request(self):
        """No ForwardMsgs are enqueued when the ScriptRunner has
        a STOP or RERUN request.
        """
        # Create a ScriptRunner and pretend that we've already started
        # executing.
        runner = TestScriptRunner("not_a_script.py")
        runner._is_in_script_thread = MagicMock(return_value=True)
        runner._execing = True
        runner._requests._state = ScriptRequestType.CONTINUE

        # Enqueue a ForwardMsg on the runner, and ensure it's delivered
        # to event listeners. (We're not stopped yet.)
        mock_msg = MagicMock()
        runner._enqueue_forward_msg(mock_msg)
        self._assert_forward_msgs(runner, [mock_msg])

        runner.clear_forward_msgs()

        # Now, "stop" our ScriptRunner. Enqueuing should result in
        # a StopException being raised, and no message enqueued.
        runner._requests.request_stop()
        with pytest.raises(StopException):
            runner._enqueue_forward_msg(MagicMock())
        self._assert_forward_msgs(runner, [])

        # And finally, request a rerun. Enqueuing should result in
        # a RerunException being raised and no message enqueued.
        runner._requests = ScriptRequests()
        runner.request_rerun(RerunData())
        with pytest.raises(RerunException):
            runner._enqueue_forward_msg(MagicMock())
        self._assert_forward_msgs(runner, [])

    def test_maybe_handle_execution_control_request(self):
        """maybe_handle_execution_control_request should no-op if called
        from another thread.
        """
        runner = TestScriptRunner("not_a_script.py")
        runner._execing = True

        # Mock ScriptRequests.on_scriptrunner_yield(). It will return a fake
        # rerun request.
        requests_mock = MagicMock()
        requests_mock.on_scriptrunner_yield = MagicMock(
            return_value=ScriptRequest(ScriptRequestType.RERUN, RerunData())
        )
        runner._requests = requests_mock

        # If _is_in_script_thread is False, our request shouldn't get popped
        runner._is_in_script_thread = MagicMock(return_value=False)
        runner._maybe_handle_execution_control_request()
        requests_mock.on_scriptrunner_yield.assert_not_called()

        # If _is_in_script_thread is True, our rerun request should get
        # popped (and this will result in a RerunException being raised).
        runner._is_in_script_thread = MagicMock(return_value=True)
        with pytest.raises(RerunException):
            runner._maybe_handle_execution_control_request()
        requests_mock.on_scriptrunner_yield.assert_called_once()

    def test_run_script_in_loop(self):
        """_run_script_thread should continue re-running its script
        while it has pending rerun requests."""
        scriptrunner = TestScriptRunner("not_a_script.py")

        # ScriptRequests.on_scriptrunner_ready will return 3 rerun requests,
        # and then stop.
        on_scriptrunner_ready_mock = MagicMock()
        on_scriptrunner_ready_mock.side_effect = [
            ScriptRequest(ScriptRequestType.RERUN, RerunData()),
            ScriptRequest(ScriptRequestType.RERUN, RerunData()),
            ScriptRequest(ScriptRequestType.RERUN, RerunData()),
            ScriptRequest(ScriptRequestType.STOP),
        ]

        scriptrunner._requests.on_scriptrunner_ready = on_scriptrunner_ready_mock

        run_script_mock = MagicMock()
        scriptrunner._run_script = run_script_mock

        scriptrunner.start()
        scriptrunner.join()

        # _run_script should have been called 3 times, once for each
        # RERUN request.
        self._assert_no_exceptions(scriptrunner)
        assert run_script_mock.call_count == 3

    @parameterized.expand(
        [
            ("good_script.py", text_utf),
            # These files are .txt to avoid being broken by "make update-headers".
            ("good_script_no_encoding.py.txt", text_no_encoding),
            ("good_script_latin_encoding.py.txt", text_latin),
        ]
    )
    def test_run_script(self, filename, text):
        """Tests that we can run a script to completion."""
        scriptrunner = TestScriptRunner(filename)
        scriptrunner._fragment_storage = MagicMock()

        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, [text])
        scriptrunner._fragment_storage.clear.assert_called_once()
        # The following check is a requirement for the CodeHasher to
        # work correctly. The CodeHasher is scoped to
        # files contained in the directory of __main__.__file__, which we
        # assume is the main script directory.
        assert os.path.realpath(scriptrunner._main_script_path) == os.path.realpath(
            sys.modules["__main__"].__file__
        ), " ScriptRunner should set the __main__.__file__ attribute correctly"

        Runtime._instance.media_file_mgr.clear_session_refs.assert_called_once()

    def test_run_one_fragment(self):
        """Tests that we can run one fragment."""
        fragment = MagicMock()

        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner._fragment_storage.register("my_fragment", fragment)

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["my_fragment"]))
        scriptrunner.start()
        scriptrunner.join()

        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.FRAGMENT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        script_started_event_data = scriptrunner.event_data[0]
        script_started_event_data["fragment_ids_this_run"] = ["my_fragment"]

        fragment.assert_called_once()

    def test_run_multiple_fragments(self):
        """Tests that we can run fragments."""
        fragment = MagicMock()

        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner._fragment_storage.register("my_fragment1", fragment)
        scriptrunner._fragment_storage.register("my_fragment2", fragment)
        scriptrunner._fragment_storage.register("my_fragment3", fragment)

        scriptrunner.request_rerun(
            RerunData(
                fragment_id_queue=[
                    "my_fragment1",
                    "my_fragment2",
                    "my_fragment3",
                ]
            )
        )
        scriptrunner.start()
        scriptrunner.join()

        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.FRAGMENT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        script_started_event_data = scriptrunner.event_data[0]
        script_started_event_data["fragment_ids_this_run"] = [
            "my_fragment1",
            "my_fragment2",
            "my_fragment3",
        ]

        fragment.assert_has_calls([call(), call(), call()])
        Runtime._instance.media_file_mgr.clear_session_refs.assert_not_called()

    def test_run_multiple_fragments_even_if_one_raised_an_exception(self):
        """Tests that fragments continue to run when previous fragment raised an error."""
        fragment = MagicMock()
        scriptrunner = TestScriptRunner("good_script.py")

        raised_exception = {"called": False}

        def raise_exception():
            raised_exception["called"] = True
            raise RuntimeError("this fragment errored out")

        scriptrunner._fragment_storage.register("my_fragment1", raise_exception)
        scriptrunner._fragment_storage.register("my_fragment2", fragment)
        scriptrunner._fragment_storage.register("my_fragment3", fragment)

        scriptrunner.request_rerun(
            RerunData(
                fragment_id_queue=[
                    "my_fragment1",
                    "my_fragment2",
                    "my_fragment3",
                ]
            )
        )
        scriptrunner.start()
        scriptrunner.join()
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.FRAGMENT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )

        assert raised_exception["called"]
        fragment.assert_has_calls([call(), call()])
        Runtime._instance.media_file_mgr.clear_session_refs.assert_not_called()

    @parameterized.expand(
        [
            ("outer_only", ["outer"]),
            ("outer_then_inner", ["outer", "inner"]),
            ("inner_then_outer", ["inner", "outer"]),
        ]
    )
    def test_fragment_queue_skips_stale_inner_after_parent_rerun(
        self,
        _: str,
        fragment_id_queue: list[str],
    ) -> None:
        """A parent rerun removes queued stale descendants before they execute."""
        outer = MagicMock()
        inner = MagicMock()

        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner._fragment_storage.register("outer", outer, parent_fragment_id=None)
        scriptrunner._fragment_storage.register(
            "inner", inner, parent_fragment_id="outer"
        )

        scriptrunner.request_rerun(RerunData(fragment_id_queue=fragment_id_queue))
        scriptrunner.start()
        scriptrunner.join()

        outer.assert_called_once()
        inner.assert_not_called()
        assert not scriptrunner._fragment_storage.contains("inner")
        assert scriptrunner._fragment_storage.contains("outer")

    def test_fragment_queue_preserves_fifo_for_unrelated_fragments(self):
        """Unrelated queued fragments keep FIFO ordering across fragment trees."""
        execution_order = []
        outer_a = MagicMock()
        inner_a = MagicMock(side_effect=lambda: execution_order.append("inner_a"))
        outer_b = MagicMock(side_effect=lambda: execution_order.append("outer_b"))

        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner._fragment_storage.register(
            "outer_a", outer_a, parent_fragment_id=None
        )
        scriptrunner._fragment_storage.register(
            "inner_a", inner_a, parent_fragment_id="outer_a"
        )
        scriptrunner._fragment_storage.register(
            "outer_b", outer_b, parent_fragment_id=None
        )

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["inner_a", "outer_b"]))
        scriptrunner.start()
        scriptrunner.join()

        assert execution_order == ["inner_a", "outer_b"]
        outer_a.assert_not_called()
        inner_a.assert_called_once()
        outer_b.assert_called_once()

    def test_fragment_queue_child_first_keeps_reregistered_inner(self):
        """Parent reruns before a queued child and preserves its re-registration."""
        scriptrunner = TestScriptRunner("good_script.py")

        def run_inner() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.shared.new_fragment_ids.check_and_add("inner")

        inner = MagicMock(side_effect=run_inner)

        def rerender_outer() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.shared.new_fragment_ids.check_and_add("inner")
            scriptrunner._fragment_storage.register(
                "inner", inner, parent_fragment_id="outer"
            )

        outer = MagicMock(side_effect=rerender_outer)
        scriptrunner._fragment_storage.register("outer", outer, parent_fragment_id=None)
        scriptrunner._fragment_storage.register(
            "inner", inner, parent_fragment_id="outer"
        )

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["inner", "outer"]))
        scriptrunner.start()
        scriptrunner.join()

        outer.assert_called_once()
        inner.assert_called_once()
        assert scriptrunner._fragment_storage.contains("inner")

    def test_fragment_queue_keeps_live_grandchild_for_later_queued_run(self):
        """A queued child rerun must not prune a live grandchild fragment."""
        scriptrunner = TestScriptRunner("good_script.py")

        grandchild = MagicMock()

        def rerender_middle() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.shared.new_fragment_ids.check_and_add("grandchild")
            scriptrunner._fragment_storage.register(
                "grandchild", grandchild, parent_fragment_id="middle"
            )
            grandchild()

        middle = MagicMock(side_effect=rerender_middle)

        def rerender_outer() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.shared.new_fragment_ids.check_and_add("middle")
            scriptrunner._fragment_storage.register(
                "middle", middle, parent_fragment_id="outer"
            )
            middle()

        outer = MagicMock(side_effect=rerender_outer)
        scriptrunner._fragment_storage.register("outer", outer, parent_fragment_id=None)
        scriptrunner._fragment_storage.register(
            "middle", middle, parent_fragment_id="outer"
        )
        scriptrunner._fragment_storage.register(
            "grandchild", grandchild, parent_fragment_id="middle"
        )

        scriptrunner.request_rerun(
            RerunData(fragment_id_queue=["grandchild", "middle", "outer"])
        )
        scriptrunner.start()
        scriptrunner.join()

        outer.assert_called_once()
        assert middle.call_count == 2
        assert grandchild.call_count == 3
        assert scriptrunner._fragment_storage.contains("grandchild")

    def test_fragment_scoped_rerun_child_first_does_not_rerun_parent(self):
        """A child-scoped rerun must not requeue an already-run parent."""
        scriptrunner = TestScriptRunner("good_script.py")

        def rerun_inner() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None

            with ThreadState.scoped(fragment_id="inner"):
                if inner.call_count == 1:
                    st.rerun(scope="fragment")

        inner = MagicMock(side_effect=rerun_inner)

        def rerender_outer() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.shared.new_fragment_ids.check_and_add("inner")
            scriptrunner._fragment_storage.register(
                "inner", inner, parent_fragment_id="outer"
            )

        outer = MagicMock(side_effect=rerender_outer)
        scriptrunner._fragment_storage.register("outer", outer, parent_fragment_id=None)
        scriptrunner._fragment_storage.register(
            "inner", inner, parent_fragment_id="outer"
        )

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["inner", "outer"]))
        scriptrunner.start()
        scriptrunner.join()

        outer.assert_called_once()
        assert inner.call_count == 2
        self._assert_no_exceptions(scriptrunner)

    def test_fragment_scoped_rerun_child_first_keeps_pending_child(self):
        """A parent-scoped rerun must preserve children that have not run yet."""
        scriptrunner = TestScriptRunner("good_script.py")
        inner = MagicMock()

        def rerun_outer() -> None:
            ctx = get_script_run_ctx()
            assert ctx is not None
            ctx.shared.new_fragment_ids.check_and_add("inner")
            scriptrunner._fragment_storage.register(
                "inner", inner, parent_fragment_id="outer"
            )

            with ThreadState.scoped(fragment_id="outer"):
                if outer.call_count == 1:
                    st.rerun(scope="fragment")

        outer = MagicMock(side_effect=rerun_outer)
        scriptrunner._fragment_storage.register("outer", outer, parent_fragment_id=None)
        scriptrunner._fragment_storage.register(
            "inner", inner, parent_fragment_id="outer"
        )

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["inner", "outer"]))
        scriptrunner.start()
        scriptrunner.join()

        assert outer.call_count == 2
        inner.assert_called_once()
        self._assert_no_exceptions(scriptrunner)

    def test_fragment_queue_inner_only_preserves_outer_registration(self):
        """Running only a child fragment must not delete the parent from storage."""
        outer = MagicMock()
        inner = MagicMock()

        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner._fragment_storage.register("outer", outer, parent_fragment_id=None)
        scriptrunner._fragment_storage.register(
            "inner", inner, parent_fragment_id="outer"
        )

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["inner"]))
        scriptrunner.start()
        scriptrunner.join()

        inner.assert_called_once()
        outer.assert_not_called()
        assert scriptrunner._fragment_storage.contains("outer")
        assert scriptrunner._fragment_storage.contains("inner")

    @patch("streamlit.runtime.scriptrunner.script_runner.get_script_run_ctx")
    @patch("streamlit.runtime.fragment.handle_user_script_exception")
    def test_regular_KeyError_is_rethrown(
        self, patched_handle_exception, patched_get_script_run_ctx
    ):
        """Test that regular key-errors within a fragment are surfaced
        as such and not caught by the FragmentStorageKeyError.
        """

        ctx = MagicMock()
        # Set to None to prevent MagicMock being returned, which would
        # cause the test to fail with TypeError instead of KeyError.
        ctx.parallel_coordinator.worker_exception = None
        patched_get_script_run_ctx.return_value = ctx

        def non_optional_func():
            raise KeyError("kaboom")

        def fragment():
            # Preserve the active_script_hash that ctx.reset() seeded; we only
            # need to override fragment_id for this test.
            ThreadState.update(fragment_id="my_fragment_id")
            _fragment(non_optional_func)()

        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner._fragment_storage.register("my_fragment", fragment)

        scriptrunner.request_rerun(RerunData(fragment_id_queue=["my_fragment"]))
        scriptrunner.start()
        scriptrunner.join()

        ex = patched_handle_exception.call_args[0][0]
        assert isinstance(ex, KeyError)

    @patch("streamlit.runtime.scriptrunner.script_runner._LOGGER.exception")
    def test_compile_error(self, patched_logger_exception):
        """Tests that we get an exception event when a script can't compile."""
        scriptrunner = TestScriptRunner("compile_error.py.txt")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, [])

        # Verify that the exception was logged
        patched_logger_exception.assert_called_once()
        # Verify the logger was called with the correct message
        assert patched_logger_exception.call_args[0][0] == "Script compilation error"
        # Ensure that exc_info parameter was passed (contains the actual exception)
        assert "exc_info" in patched_logger_exception.call_args[1]

    @patch("streamlit.runtime.state.session_state.SessionState._call_callbacks")
    def test_calls_widget_callbacks(self, patched_call_callbacks):
        """Before a script is rerun, we call callbacks for any widgets
        whose value has changed.
        """
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()

        # Default widget values
        require_widgets_deltas([scriptrunner])
        self._assert_text_deltas(
            scriptrunner, ["False", "ahoy!", "0", "False", "loop_forever"]
        )

        patched_call_callbacks.assert_not_called()

        # Update widgets
        states = WidgetStates()
        w1_id = scriptrunner.get_widget_id("checkbox", "checkbox")
        _create_widget(w1_id, states).bool_value = True
        w2_id = scriptrunner.get_widget_id("text_area", "text_area")
        _create_widget(w2_id, states).string_value = "matey!"
        w3_id = scriptrunner.get_widget_id("radio", "radio")
        _create_widget(w3_id, states).string_value = "2"
        w4_id = scriptrunner.get_widget_id("button", "button")
        _create_widget(w4_id, states).trigger_value = True

        # Explicitly clear deltas before re-running, to prevent a race
        # condition. (The ScriptRunner will clear the deltas when it
        # starts the re-run, but if that doesn't happen before
        # require_widgets_deltas() starts polling the ScriptRunner's deltas,
        # it will see stale deltas from the last run.)
        scriptrunner.clear_forward_msgs()
        scriptrunner.request_rerun(RerunData(widget_states=states))
        require_widgets_deltas([scriptrunner])

        patched_call_callbacks.assert_called_once()
        self._assert_text_deltas(
            scriptrunner, ["True", "matey!", "2", "True", "loop_forever"]
        )

        scriptrunner.request_stop()
        scriptrunner.join()

    @patch("streamlit.runtime.state.session_state.SessionState._call_callbacks")
    def test_calls_widget_callbacks_on_new_scriptrunner_instance(
        self, patched_call_callbacks
    ):
        """A new ScriptRunner instance will call widget callbacks
        if widget values have changed. (This differs slightly from
        `test_calls_widget_callbacks`, which tests that an *already-running*
        ScriptRunner calls its callbacks on rerun).
        """
        # Create a ScriptRunner and run it once so we can grab its widgets.
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()
        require_widgets_deltas([scriptrunner])
        scriptrunner.request_stop()
        scriptrunner.join()

        patched_call_callbacks.assert_not_called()

        # Set our checkbox's value to True
        states = WidgetStates()
        checkbox_id = scriptrunner.get_widget_id("checkbox", "checkbox")
        _create_widget(checkbox_id, states).bool_value = True

        # Create a *new* ScriptRunner with our new RerunData. Our callbacks
        # should be called this time.
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.request_rerun(RerunData(widget_states=states))
        scriptrunner.start()
        require_widgets_deltas([scriptrunner])
        scriptrunner.request_stop()
        scriptrunner.join()

        patched_call_callbacks.assert_called_once()

    @patch("streamlit.elements.exception._exception")
    @patch("streamlit.runtime.state.session_state.SessionState._call_callbacks")
    def test_calls_widget_callbacks_error(
        self, patched_call_callbacks, patched_st_exception
    ):
        """If an exception is raised from a callback function,
        it should result in a call to `streamlit.exception`.
        """
        patched_call_callbacks.side_effect = RuntimeError("Random Error")

        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()

        # Default widget values
        require_widgets_deltas([scriptrunner])
        self._assert_text_deltas(
            scriptrunner, ["False", "ahoy!", "0", "False", "loop_forever"]
        )

        patched_call_callbacks.assert_not_called()

        # Update widgets
        states = WidgetStates()
        w1_id = scriptrunner.get_widget_id("checkbox", "checkbox")
        _create_widget(w1_id, states).bool_value = True
        w2_id = scriptrunner.get_widget_id("text_area", "text_area")
        _create_widget(w2_id, states).string_value = "matey!"
        w3_id = scriptrunner.get_widget_id("radio", "radio")
        _create_widget(w3_id, states).string_value = "2"
        w4_id = scriptrunner.get_widget_id("button", "button")
        _create_widget(w4_id, states).trigger_value = True

        # Explicitly clear deltas before re-running, to prevent a race
        # condition. (The ScriptRunner will clear the deltas when it
        # starts the re-run, but if that doesn't happen before
        # require_widgets_deltas() starts polling the ScriptRunner's deltas,
        # it will see stale deltas from the last run.)
        scriptrunner.clear_forward_msgs()
        scriptrunner.request_rerun(RerunData(widget_states=states))

        scriptrunner.join()

        patched_call_callbacks.assert_called_once()

        self._assert_control_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_FOR_RERUN,
                ScriptRunnerEvent.SCRIPT_STARTED,
                # We use the SCRIPT_STOPPED_WITH_SUCCESS event even if the
                # script runs into an error during execution. The user is
                # informed of the error by an `st.exception` box that we check
                # for below.
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )

        patched_st_exception.assert_called_once()

    def test_missing_script(self):
        """Tests that we get an exception event when a script doesn't exist."""
        scriptrunner = TestScriptRunner("i_do_not_exist.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, [])

    @patch("streamlit.runtime.scriptrunner.script_runner.create_page_profile_message")
    def test_uncaught_exception_gets_tracked(self, patched_create_page_profile_message):
        """Tests that we track uncaught exceptions."""
        with testutil.patch_config_options({"browser.gatherUsageStats": True}):
            scriptrunner = TestScriptRunner("runtime_error.py")
            scriptrunner.request_rerun(RerunData())
            scriptrunner.start()
            scriptrunner.join()

            patched_create_page_profile_message.assert_called_once()
            call_kwargs = patched_create_page_profile_message.call_args_list[0].kwargs

            # Check the
            assert len(call_kwargs["commands"]) == 2  # text & exception command
            assert call_kwargs["exec_time"] > 0
            assert call_kwargs["prep_time"] > 0
            assert call_kwargs["uncaught_exception"] == "AttributeError"

    @parameterized.expand([(True,), (False,)])
    @patch("streamlit.runtime.runtime.Runtime.exists", MagicMock(return_value=True))
    def test_runtime_error(self, show_error_details: bool):
        """Tests that we correctly handle scripts with runtime errors."""
        with testutil.patch_config_options(
            {"client.showErrorDetails": show_error_details}
        ):
            scriptrunner = TestScriptRunner("runtime_error.py")
            scriptrunner.request_rerun(RerunData())
            scriptrunner.start()
            scriptrunner.join()

            self._assert_no_exceptions(scriptrunner)
            self._assert_events(
                scriptrunner,
                [
                    ScriptRunnerEvent.SCRIPT_STARTED,
                    ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,  # text delta
                    ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,  # exception delta
                    ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                    ScriptRunnerEvent.SHUTDOWN,
                ],
            )

            # We'll get two deltas: one for st.text(), and one for the
            # exception that gets thrown afterwards.
            elts = scriptrunner.elements()
            assert elts[0].WhichOneof("type") == "text"

            if show_error_details:
                self._assert_num_deltas(scriptrunner, 2)
                assert elts[1].WhichOneof("type") == "exception"
            else:
                self._assert_num_deltas(scriptrunner, 2)
                assert elts[1].WhichOneof("type") == "exception"
                exc_msg = elts[1].exception.message
                assert exc_msg == _GENERIC_UNCAUGHT_EXCEPTION_TEXT

    @pytest.mark.slow
    def test_stop_script(self):
        """Tests that we can stop a script while it's running."""
        scriptrunner = TestScriptRunner("infinite_loop.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()

        time.sleep(0.1)
        scriptrunner.request_rerun(RerunData())

        # This test will fail if the script runner does not execute the infinite
        # script's write call at least once during the final script run.
        # The script runs forever, and when we enqueue a rerun it forcibly
        # stops execution and runs some cleanup. If we do not wait for the
        # forced GC to finish, the script won't start running before we stop
        # the script runner, so the expected delta is never created.
        time.sleep(1)
        scriptrunner.request_stop()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)

        # We use _assert_control_events, and not _assert_events,
        # because the infinite loop will fire an indeterminate number of
        # ForwardMsg enqueue requests. Those ForwardMsgs will all be ultimately
        # coalesced down to a single message by the ForwardMsgQueue, which is
        # why the "_assert_text_deltas" call, below, just asserts the existence
        # of a single ForwardMsg.
        self._assert_control_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_FOR_RERUN,
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, ["loop_forever"])

    def test_shutdown(self):
        """Test that we can shutdown while a script is running."""
        scriptrunner = TestScriptRunner("infinite_loop.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()

        time.sleep(0.1)
        scriptrunner.request_stop()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_control_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, ["loop_forever"])

    def test_widgets(self):
        """Tests that widget values behave as expected."""
        scriptrunner = TestScriptRunner("widgets_script.py")
        try:
            scriptrunner.request_rerun(RerunData())
            scriptrunner.start()

            # Default widget values
            require_widgets_deltas([scriptrunner])
            self._assert_text_deltas(
                scriptrunner, ["False", "ahoy!", "0", "False", "loop_forever"]
            )

            # Update widgets
            states = WidgetStates()
            w1_id = scriptrunner.get_widget_id("checkbox", "checkbox")
            _create_widget(w1_id, states).bool_value = True
            w2_id = scriptrunner.get_widget_id("text_area", "text_area")
            _create_widget(w2_id, states).string_value = "matey!"
            w3_id = scriptrunner.get_widget_id("radio", "radio")
            _create_widget(w3_id, states).string_value = "2"
            w4_id = scriptrunner.get_widget_id("button", "button")
            _create_widget(w4_id, states).trigger_value = True

            # Explicitly clear deltas before re-running, to prevent a race
            # condition. (The ScriptRunner will clear the deltas when it
            # starts the re-run, but if that doesn't happen before
            # require_widgets_deltas() starts polling the ScriptRunner's deltas,
            # it will see stale deltas from the last run.)
            scriptrunner.clear_forward_msgs()
            scriptrunner.request_rerun(RerunData(widget_states=states))

            require_widgets_deltas([scriptrunner])
            self._assert_text_deltas(
                scriptrunner, ["True", "matey!", "2", "True", "loop_forever"]
            )

            # Rerun with previous values. The button should be reset;
            # everything else should be the same.
            scriptrunner.clear_forward_msgs()
            scriptrunner.request_rerun(RerunData())

            require_widgets_deltas([scriptrunner])
            self._assert_text_deltas(
                scriptrunner, ["True", "matey!", "2", "False", "loop_forever"]
            )

        finally:
            scriptrunner.request_stop()
            scriptrunner.join()

            self._assert_no_exceptions(scriptrunner)

    def test_query_string_and_page_script_hash_saved(self):
        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner.request_rerun(
            RerunData(query_string="foo=bar", page_script_hash="hash1")
        )
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )

        shutdown_data = scriptrunner.event_data[-1]
        assert shutdown_data["client_state"].query_string == "foo=bar"
        assert shutdown_data["client_state"].page_script_hash == "hash1"

    def test_context_info_saved_in_shutdown(self):
        """Test that context_info is preserved in the SHUTDOWN event."""
        from streamlit.proto.ClientState_pb2 import ContextInfo

        scriptrunner = TestScriptRunner("good_script.py")

        # Create context info
        context_info = ContextInfo()
        context_info.timezone = "Europe/Berlin"
        context_info.locale = "de-DE"
        context_info.url = "http://localhost:8501"
        context_info.is_embedded = False

        scriptrunner.request_rerun(
            RerunData(
                query_string="foo=bar",
                page_script_hash="hash1",
                context_info=context_info,
            )
        )
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )

        shutdown_data = scriptrunner.event_data[-1]
        client_state = shutdown_data["client_state"]
        assert client_state.query_string == "foo=bar"
        assert client_state.page_script_hash == "hash1"

        # Verify context_info is preserved
        assert client_state.HasField("context_info")
        assert client_state.context_info.timezone == "Europe/Berlin"
        assert client_state.context_info.locale == "de-DE"
        assert client_state.context_info.url == "http://localhost:8501"
        assert client_state.context_info.is_embedded is False

    def test_coalesce_rerun(self):
        """Tests that multiple pending rerun requests get coalesced."""
        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.request_rerun(RerunData())
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, [text_utf])

    def test_remove_nonexistent_elements(self):
        """Tests that nonexistent elements are removed from widget cache after
        script run.
        """

        widget_id = "nonexistent_widget_id"

        # Run script, sending in a WidgetStates containing our fake widget ID.
        scriptrunner = TestScriptRunner("good_script.py")
        states = WidgetStates()
        _create_widget(widget_id, states).string_value = "streamlit"
        scriptrunner.request_rerun(RerunData(widget_states=states))
        scriptrunner.start()

        # At this point, scriptrunner should have finished running, detected
        # that our widget_id wasn't in the list of widgets found this run, and
        # culled it. Ensure widget cache no longer holds our widget ID.
        with pytest.raises(KeyError):
            scriptrunner._session_state[widget_id]

    def test_dg_stack_preserved_for_fragment_rerun(self):
        """Tests that the dg_stack and cursor are preserved for a fragment rerun.

        Having a fragment rerun that is interrupted by a RerunException triggered by
        another fragment run simulates what we have seen in the issue where the main app
        was rendered inside of a dialog when two fragment-related reruns were handled
        in the same ScriptRunner thread.
        """
        scriptrunner = TestScriptRunner("good_script.py")

        # set the dg_stack from the fragment to simulate a populated dg_stack of
        # a real app
        dg_stack_set_by_fragment = (
            DeltaGenerator(),
            DeltaGenerator(),
            DeltaGenerator(),
            DeltaGenerator(),
        )
        scriptrunner._fragment_storage.register(
            "my_fragment1",
            lambda: context_dg_stack.set(dg_stack_set_by_fragment),
        )

        # trigger a run with fragment_id to avoid clearing the fragment_storage in the
        # script runner
        scriptrunner.request_rerun(RerunData(fragment_id_queue=["my_fragment1"]))

        # yielding a rerun request will raise a RerunException in the script runner
        # with the provided RerunData
        on_scriptrunner_yield_mock = MagicMock()
        on_scriptrunner_yield_mock.side_effect = [
            # the original_dg_stack will be set to the dg_stack populated by the first
            # requested_rerun of the fragment
            ScriptRequest(
                ScriptRequestType.RERUN, RerunData(fragment_id_queue=["my_fragment1"])
            ),
            ScriptRequest(ScriptRequestType.STOP),
        ]
        scriptrunner._requests.on_scriptrunner_yield = on_scriptrunner_yield_mock

        scriptrunner.start()
        scriptrunner.join()

        assert len(scriptrunner.get_runner_thread_dg_stack()) == len(
            dg_stack_set_by_fragment
        )
        assert scriptrunner.get_runner_thread_dg_stack() == dg_stack_set_by_fragment

    def test_dg_stack_reset_for_full_app_rerun(self):
        """Tests that the dg_stack and cursor are reset for a full app rerun."""

        scriptrunner = TestScriptRunner("good_script.py")
        # simulate a dg_stack populated by the fragment
        dg_stack_set_by_fragment = (
            DeltaGenerator(),
            DeltaGenerator(),
            DeltaGenerator(),
            DeltaGenerator(),
        )
        scriptrunner._fragment_storage.register(
            "my_fragment1",
            lambda: context_dg_stack.set(dg_stack_set_by_fragment),
        )

        # trigger a run with fragment_id to avoid clearing the fragment_storage
        # in the script runner
        scriptrunner.request_rerun(RerunData(fragment_id_queue=["my_fragment1"]))

        # yielding a rerun request will raise a RerunException in the script runner
        # with the provided RerunData
        on_scriptrunner_yield_mock = MagicMock()
        on_scriptrunner_yield_mock.side_effect = [
            # raise RerunException for full app run
            ScriptRequest(ScriptRequestType.RERUN, RerunData()),
            ScriptRequest(ScriptRequestType.STOP),
        ]
        scriptrunner._requests.on_scriptrunner_yield = on_scriptrunner_yield_mock

        scriptrunner.start()
        scriptrunner.join()

        # for full app run, the dg_stack should have been reset
        assert len(scriptrunner.get_runner_thread_dg_stack()) == 1

    # TODO: re-enable after flakiness is fixed
    def off_test_multiple_scriptrunners(self):
        """Tests that multiple scriptrunners can run simultaneously."""
        # This scriptrunner will run before the other 3. It's used to retrieve
        # the widget id before initializing deltas on other runners.
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()

        # Get the widget ID of a radio button and shut down the first runner.
        require_widgets_deltas([scriptrunner])
        radio_widget_id = scriptrunner.get_widget_id("radio", "radio")
        scriptrunner.request_stop()
        scriptrunner.join()
        self._assert_no_exceptions(scriptrunner)

        # Build several runners. Each will set a different string value for
        # its radio button.
        runners = []
        for ii in range(3):
            runner = TestScriptRunner("widgets_script.py")
            runners.append(runner)

            states = WidgetStates()
            _create_widget(radio_widget_id, states).string_value = str(ii)
            runner.request_rerun(RerunData(widget_states=states))

        # Start the runners and wait a beat.
        for runner in runners:
            runner.start()

        require_widgets_deltas(runners)

        # Ensure that each runner's radio value is as expected.
        for ii, runner in enumerate(runners):
            self._assert_text_deltas(
                runner, ["False", "ahoy!", str(ii), "False", "loop_forever"]
            )
            runner.request_stop()

        time.sleep(0.1)

        # Shut 'em all down!
        for runner in runners:
            runner.join()

        for runner in runners:
            self._assert_no_exceptions(runner)
            self._assert_control_events(
                runner,
                [
                    ScriptRunnerEvent.SCRIPT_STARTED,
                    ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                    ScriptRunnerEvent.SHUTDOWN,
                ],
            )

    def test_parallel_coordinator_is_fresh_per_run(self):
        """Each script run constructs a brand new
        ParallelFragmentCoordinator. A leaked instance would carry the
        previous run's stop event / worker exception into the next run.

        ``coordinator_id_capture.py`` calls ``st.rerun()`` once so the
        runner does two full runs in a single start/join cycle —
        back-to-back ``request_rerun`` calls coalesce.
        """
        scriptrunner = TestScriptRunner("coordinator_id_capture.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        ids = scriptrunner._session_state["coordinator_ids"]
        assert len(ids) == 2
        assert ids[0] != ids[1]

    def test_parallel_coordinator_join_called_after_exec(self):
        """The script runner must call ``coordinator.join()`` exactly once
        after a successful full-app run, before clearing fragment storage."""
        join_calls: list[int] = []
        original_join = ParallelFragmentCoordinator.join

        def recording_join(self):
            join_calls.append(1)
            return original_join(self)

        with patch.object(ParallelFragmentCoordinator, "join", recording_join):
            scriptrunner = TestScriptRunner("good_script.py")
            scriptrunner.request_rerun(RerunData())
            scriptrunner.start()
            scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        assert len(join_calls) == 1

    def test_parallel_coordinator_drain_on_rerun_exception(self):
        """When ``exec()`` raises RerunException (e.g. user code calls
        ``st.rerun()``), the script runner's try/except must call
        ``coordinator.drain()`` and re-raise so the rerun loop sees the
        exception and runs the script again."""
        drain_calls: list[int] = []
        original_drain = ParallelFragmentCoordinator.drain

        def recording_drain(self):
            drain_calls.append(1)
            return original_drain(self)

        with patch.object(ParallelFragmentCoordinator, "drain", recording_drain):
            scriptrunner = TestScriptRunner("rerun_once_then_finish.py")
            scriptrunner.request_rerun(RerunData())
            scriptrunner.start()
            scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        # The first run's st.rerun() raises RerunException -> drain() runs once.
        # The second run completes normally -> no drain call.
        assert len(drain_calls) == 1
        # Two SCRIPT_STARTED events confirm the rerun was honored.
        started_events = [
            e for e in scriptrunner.events if e == ScriptRunnerEvent.SCRIPT_STARTED
        ]
        assert len(started_events) == 2

    @patch("streamlit.runtime.scriptrunner.script_runner.get_script_run_ctx")
    def test_script_thread_yield_check_worker_exception_wins_over_request(
        self, patched_get_script_run_ctx
    ):
        """On the script-thread branch, a stored worker exception is
        re-raised before any external RERUN/STOP request from
        ``ScriptRequests`` is dequeued. The worker's RerunData is preserved
        so the rerun loop honors the worker's intent, not the external
        request that arrived concurrently.
        """
        worker_rerun_data = RerunData(query_string="from_worker")
        worker_exc = RerunException(worker_rerun_data)

        ctx = MagicMock()
        ctx.parallel_coordinator.worker_exception = worker_exc
        patched_get_script_run_ctx.return_value = ctx

        scriptrunner = TestScriptRunner("good_script.py")
        # Queue an external rerun request that should NOT win over the
        # worker's stored exception.
        external_rerun_data = RerunData(query_string="external")
        scriptrunner._requests.request_rerun(external_rerun_data)

        with patch.object(scriptrunner, "_is_in_script_thread", return_value=True):
            scriptrunner._execing = True
            with pytest.raises(RerunException) as excinfo:
                scriptrunner._maybe_handle_execution_control_request()

        assert excinfo.value.rerun_data is worker_rerun_data

    def test_page_script_hash_to_script_path(self):
        scriptrunner = TestScriptRunner("good_navigation_script.py")
        scriptrunner.request_rerun(RerunData(page_name="good_script2"))
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,  # Navigation call
                ScriptRunnerEvent.ENQUEUE_FORWARD_MSG,  # text delta
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, [text_utf2])
        assert (
            os.path.join(
                os.path.dirname(__file__), "test_data", "good_navigation_script.py"
            )
            == sys.modules["__main__"].__file__
        ), " ScriptRunner should set the __main__.__file__ attribute correctly"

        shutdown_data = scriptrunner.event_data[-1]
        assert (
            shutdown_data["client_state"].page_script_hash
            == "74c2683ab3d8427292ef911e1e05a630"
        )

    def _assert_no_exceptions(self, scriptrunner: TestScriptRunner) -> None:
        """Assert that no uncaught exceptions were thrown in the
        scriptrunner's run thread.
        """
        assert scriptrunner.script_thread_exceptions == []

    def _assert_events(
        self, scriptrunner: TestScriptRunner, expected_events: list[ScriptRunnerEvent]
    ) -> None:
        """Assert that the ScriptRunnerEvents emitted by a TestScriptRunner
        are what we expect."""
        assert expected_events == scriptrunner.events

    def _assert_control_events(
        self, scriptrunner: TestScriptRunner, expected_events: list[ScriptRunnerEvent]
    ) -> None:
        """Assert the non-data ScriptRunnerEvents emitted by a TestScriptRunner
        are what we expect. ("Non-data" refers to all events except
        ENQUEUE_FORWARD_MSG.)
        """
        control_events = [
            event for event in scriptrunner.events if _is_control_event(event)
        ]
        assert expected_events == control_events

    def _assert_forward_msgs(
        self, scriptrunner: TestScriptRunner, messages: list[ForwardMsg]
    ) -> None:
        """Assert that the ScriptRunner's ForwardMsgQueue contains the
        given list of ForwardMsgs.
        """
        assert messages == scriptrunner.forward_msgs()

    def _assert_num_deltas(
        self, scriptrunner: TestScriptRunner, num_deltas: int
    ) -> None:
        """Assert that the given number of delta ForwardMsgs were enqueued
        during script execution.

        Parameters
        ----------
        scriptrunner : TestScriptRunner
        num_deltas : int

        """
        assert num_deltas == len(scriptrunner.deltas())

    def _assert_text_deltas(
        self, scriptrunner: TestScriptRunner, text_deltas: list[str]
    ) -> None:
        """Assert that the scriptrunner's ForwardMsgQueue contains text deltas
        with the given contents.
        """
        assert text_deltas == scriptrunner.text_deltas()


class TestScriptRunner(ScriptRunner):
    """Subclasses ScriptRunner to provide some testing features."""

    # PyTest is unable to collect Test classes with __init__,
    # and issues PytestCollectionWarning: cannot collect test class
    # Since class TestScriptRunner is a helper class,
    # there is no need for class TestScriptRunner to be collected by PyTest
    # To prevent PytestCollectionWarning we set __test__ property to False
    __test__ = False

    def __init__(self, script_name: str):
        """Initializes the ScriptRunner for the given script_name"""
        # DeltaGenerator deltas will be enqueued into self.forward_msg_queue.
        self.forward_msg_queue = ForwardMsgQueue()

        main_script_path = os.path.join(
            os.path.dirname(__file__), "test_data", script_name
        )

        script_cache = ScriptCache()
        super().__init__(
            session_id="test session id",
            main_script_path=main_script_path,
            session_state=SessionState(),
            uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
            script_cache=script_cache,
            initial_rerun_data=RerunData(),
            user_info={"email": "test@example.com"},
            fragment_storage=MemoryFragmentStorage(),
            pages_manager=PagesManager(main_script_path, script_cache),
        )

        # Accumulates uncaught exceptions thrown by our run thread.
        self.script_thread_exceptions: list[Exception] = []

        # Accumulates all ScriptRunnerEvents emitted by us.
        self.events: list[ScriptRunnerEvent] = []
        self.event_data: list[Any] = []

        def record_event(
            sender: ScriptRunner | None, event: ScriptRunnerEvent, **kwargs
        ) -> None:
            # Assert that we're not getting unexpected `sender` params
            # from ScriptRunner.on_event
            assert sender is None or sender == self, (
                "Unexpected ScriptRunnerEvent sender!"
            )

            self.events.append(event)
            self.event_data.append(kwargs)

            # Send ENQUEUE_FORWARD_MSGs to our queue
            if event == ScriptRunnerEvent.ENQUEUE_FORWARD_MSG:
                forward_msg = kwargs["forward_msg"]
                self.forward_msg_queue.enqueue(forward_msg)

        self.on_event.connect(record_event, weak=False)

    def _run_script_thread(self) -> None:
        try:
            super()._run_script_thread()
        except Exception as e:
            self.script_thread_exceptions.append(e)

    def _run_script(self, rerun_data: RerunData) -> None:
        self.clear_forward_msgs()
        super()._run_script(rerun_data)

        # Set the _dg_stack here to the one belonging to the thread context
        self._dg_stack = context_dg_stack.get()

    def join(self) -> None:
        """Join the script_thread if it's running."""
        if self._script_thread is not None:
            self._script_thread.join()

    def clear_forward_msgs(self) -> None:
        """Clear all messages from our ForwardMsgQueue."""
        self.forward_msg_queue.clear()

    def forward_msgs(self) -> list[ForwardMsg]:
        """Return all messages in our ForwardMsgQueue."""
        return self.forward_msg_queue._queue

    def deltas(self) -> list[Delta]:
        """Return the delta messages in our ForwardMsgQueue."""
        return [
            msg.delta for msg in self.forward_msg_queue._queue if msg.HasField("delta")
        ]

    def elements(self) -> list[Element]:
        """Return the delta.new_element messages in our ForwardMsgQueue."""
        return [delta.new_element for delta in self.deltas()]

    def text_deltas(self) -> list[str]:
        """Return the string contents of text deltas in our ForwardMsgQueue"""
        return [
            element.text.body
            for element in self.elements()
            if element.WhichOneof("type") == "text"
        ]

    def get_widget_id(self, widget_type: str, label: str) -> str | None:
        """Returns the id of the widget with the specified type and label"""
        for delta in self.deltas():
            new_element = getattr(delta, "new_element", None)
            widget = getattr(new_element, widget_type, None)
            widget_label = getattr(widget, "label", None)
            if widget_label == label:
                return widget.id
        return None

    def get_runner_thread_dg_stack(self) -> tuple[DeltaGenerator, ...]:
        """The returned stack was set by the ScriptRunner thread and, thus, has its context."""
        return self._dg_stack


def require_widgets_deltas(
    runners: list[TestScriptRunner], timeout: float = 15
) -> None:
    """Wait for the given ScriptRunners to each produce the appropriate
    number of deltas for widgets_script.py before a timeout. If the timeout
    is reached, the runners will all be shutdown and an error will be thrown.
    """
    # widgets_script.py has 8 deltas, then a 1-delta loop. If 9
    # have been emitted, we can proceed with the test..
    NUM_DELTAS = 9

    t0 = time.time()
    num_complete = 0
    while time.time() - t0 < timeout:
        time.sleep(0.1)
        num_complete = sum(
            1 for runner in runners if len(runner.deltas()) >= NUM_DELTAS
        )
        if num_complete == len(runners):
            return

    # If we get here, at least 1 runner hasn't yet completed before our
    # timeout. Create an error string for debugging.
    err_string = f"require_widgets_deltas() timed out after {timeout}s ({num_complete}/{len(runners)} runners complete)"
    for runner in runners:
        if len(runner.deltas()) < NUM_DELTAS:
            err_string += f"\n- incomplete deltas: {runner.text_deltas()}"

    # Shutdown all runners before throwing an error, so that the script
    # doesn't hang forever.
    for runner in runners:
        runner.request_stop()
    for runner in runners:
        runner.join()

    raise RuntimeError(err_string)


def test_scriptrunner_repr_uses_util_repr_format() -> None:
    """ScriptRunner.__repr__ delegates to util.repr_ and exposes its concrete class name."""
    runner = TestScriptRunner("not_a_script.py")
    rendered = repr(runner)
    # util.repr_ formats instances as "<ClassName(field=value, ...)>".
    assert rendered.startswith(f"{type(runner).__name__}(")


@pytest.mark.parametrize(
    "invoke",
    [
        pytest.param(lambda r: r._get_script_run_ctx(), id="get_script_run_ctx"),
        # Call the base implementation directly: TestScriptRunner swallows the
        # exception into script_thread_exceptions, hiding the guard's RuntimeError.
        pytest.param(
            lambda r: ScriptRunner._run_script_thread(r), id="run_script_thread"
        ),
        pytest.param(lambda r: r._run_script(RerunData()), id="run_script"),
    ],
)
def test_script_thread_methods_raise_when_called_off_thread(
    invoke: Callable[[TestScriptRunner], object],
) -> None:
    """Script-thread-only methods must raise when called from another thread."""
    runner = TestScriptRunner("not_a_script.py")
    with pytest.raises(RuntimeError, match="must be called from the script thread"):
        invoke(runner)


def test_set_execing_flag_disallows_nested_calls() -> None:
    """_set_execing_flag raises when nested while already execing."""
    runner = TestScriptRunner("not_a_script.py")
    with runner._set_execing_flag():
        with pytest.raises(RuntimeError, match="Nested set_execing_flag call"):
            with runner._set_execing_flag():
                pass


@pytest.mark.parametrize(
    "side_effect",
    [
        pytest.param(None, id="happy_path"),
        # Failures in optional cleanup must never propagate.
        pytest.param(RuntimeError("boom"), id="swallows_exceptions"),
    ],
)
def test_clean_problem_modules_handles_keras_and_matplotlib(
    side_effect: Exception | None,
) -> None:
    """_clean_problem_modules clears Keras + closes matplotlib, swallowing errors."""
    fake_keras = MagicMock()
    fake_keras.backend.clear_session.side_effect = side_effect
    fake_plt = MagicMock()
    fake_plt.close.side_effect = side_effect

    with patch.dict(
        sys.modules, {"keras": fake_keras, "matplotlib.pyplot": fake_plt}, clear=False
    ):
        _clean_problem_modules()

    fake_keras.backend.clear_session.assert_called_once()
    fake_plt.close.assert_called_once_with("all")


def test_log_if_error_logs_exception_and_does_not_raise() -> None:
    """_log_if_error must catch exceptions and log them instead of propagating."""

    def raises() -> None:
        raise ValueError("kaboom")

    with patch.object(script_runner_module, "_LOGGER") as mock_logger:
        _log_if_error(raises)

    mock_logger.warning.assert_called_once()
