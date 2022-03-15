# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Tests ScriptRunner functionality"""

import os
import sys
import time
from typing import List, Any, Optional
from unittest.mock import MagicMock, patch

import pytest
from parameterized import parameterized
from tornado.testing import AsyncTestCase

from streamlit.legacy_caching import caching
from streamlit.elements.exception import _GENERIC_UNCAUGHT_EXCEPTION_TEXT
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.Element_pb2 import Element
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.WidgetStates_pb2 import WidgetStates, WidgetState
from streamlit.session_data import SessionData
from streamlit.forward_msg_queue import ForwardMsgQueue
from streamlit.scriptrunner import (
    ScriptRunner,
    ScriptRunnerEvent,
    ScriptRequestQueue,
    ScriptRequest,
    RerunData,
)
from streamlit.state.session_state import SessionState
from streamlit.uploaded_file_manager import UploadedFileManager
from tests import testutil

text_utf = "complete! 👨‍🎤"
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


class ScriptRunnerTest(AsyncTestCase):
    def test_startup_shutdown(self):
        """Test that we can create and shut down a ScriptRunner."""
        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner.start()
        scriptrunner.join()

        self._assert_no_exceptions(scriptrunner)
        self._assert_control_events(scriptrunner, [ScriptRunnerEvent.SHUTDOWN])
        self._assert_text_deltas(scriptrunner, [])

    @parameterized.expand(
        [
            ("installTracer=False", False),
            ("installTracer=True", True),
        ]
    )
    def test_enqueue(self, _, install_tracer: bool):
        """Make sure we try to handle execution control requests whenever
        our _enqueue_forward_msg function is called, unless "runner.installTracer" is set.
        """
        with testutil.patch_config_options({"runner.installTracer": install_tracer}):
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

            # If "install_tracer" is true, maybe_handle_execution_control_request
            # should not be called by the enqueue function. (In reality, it will
            # still be called once in the tracing callback But in this test
            # we're not actually installing a tracer - the script is not being
            # run.) If "install_tracer" is false, the function should be called
            # once.
            expected_call_count = 0 if install_tracer else 1
            self.assertEqual(
                expected_call_count,
                maybe_handle_execution_control_request_mock.call_count,
            )

    def test_maybe_handle_execution_control_request_from_other_thread(self):
        """maybe_handle_execution_control_request should no-op if called
        from another thread.
        """
        runner = TestScriptRunner("not_a_script.py")
        runner._execing = True

        # Mock ScriptRunner._request_queue.dequeue
        request_queue_mock = MagicMock()
        runner._request_queue = request_queue_mock

        # If _is_in_script_thread is True, our _request_queue should get popped.
        runner._is_in_script_thread = MagicMock(return_value=True)
        request_queue_mock.dequeue = MagicMock(return_value=(None, None))
        runner._maybe_handle_execution_control_request()
        request_queue_mock.dequeue.assert_called_once()

        # If _is_in_script_thread is False, it shouldn't get popped.
        runner._is_in_script_thread = MagicMock(return_value=False)
        request_queue_mock.dequeue = MagicMock(return_value=(None, None))
        runner._maybe_handle_execution_control_request()
        request_queue_mock.dequeue.assert_not_called()

    @parameterized.expand(
        [
            ("good_script.py", text_utf),
            # These files are .txt to avoid being broken by "make headers".
            ("good_script_no_encoding.py.txt", text_no_encoding),
            ("good_script_latin_encoding.py.txt", text_latin),
        ]
    )
    def test_run_script(self, filename, text):
        """Tests that we can run a script to completion."""
        scriptrunner = TestScriptRunner(filename)
        scriptrunner.enqueue_rerun()
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
        # The following check is a requirement for the CodeHasher to
        # work correctly. The CodeHasher is scoped to
        # files contained in the directory of __main__.__file__, which we
        # assume is the main script directory.
        self.assertEqual(
            scriptrunner._session_data.main_script_path,
            sys.modules["__main__"].__file__,
            (" ScriptRunner should set the __main__.__file__" "attribute correctly"),
        )

    def test_compile_error(self):
        """Tests that we get an exception event when a script can't compile."""
        scriptrunner = TestScriptRunner("compile_error.py.txt")
        scriptrunner.enqueue_rerun()
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

    @patch("streamlit.state.session_state.SessionState.call_callbacks")
    def test_calls_widget_callbacks(self, patched_call_callbacks):
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.enqueue_rerun()
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
        _create_widget(w3_id, states).int_value = 2
        w4_id = scriptrunner.get_widget_id("button", "button")
        _create_widget(w4_id, states).trigger_value = True

        # Explicitly clear deltas before re-running, to prevent a race
        # condition. (The ScriptRunner will clear the deltas when it
        # starts the re-run, but if that doesn't happen before
        # require_widgets_deltas() starts polling the ScriptRunner's deltas,
        # it will see stale deltas from the last run.)
        scriptrunner.clear_forward_msgs()
        scriptrunner.enqueue_rerun(widget_states=states)

        require_widgets_deltas([scriptrunner])
        self._assert_text_deltas(
            scriptrunner, ["True", "matey!", "2", "True", "loop_forever"]
        )

        patched_call_callbacks.assert_called_once()

        scriptrunner.enqueue_shutdown()
        scriptrunner.join()

    @patch("streamlit.exception")
    @patch("streamlit.state.session_state.SessionState.call_callbacks")
    def test_calls_widget_callbacks_error(
        self, patched_call_callbacks, patched_st_exception
    ):
        patched_call_callbacks.side_effect = RuntimeError("Random Error")
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.enqueue_rerun()
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
        _create_widget(w3_id, states).int_value = 2
        w4_id = scriptrunner.get_widget_id("button", "button")
        _create_widget(w4_id, states).trigger_value = True

        # Explicitly clear deltas before re-running, to prevent a race
        # condition. (The ScriptRunner will clear the deltas when it
        # starts the re-run, but if that doesn't happen before
        # require_widgets_deltas() starts polling the ScriptRunner's deltas,
        # it will see stale deltas from the last run.)
        scriptrunner.clear_forward_msgs()
        scriptrunner.enqueue_rerun(widget_states=states)

        scriptrunner.join()

        patched_call_callbacks.assert_called_once()

        self._assert_control_events(
            scriptrunner,
            [
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
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
        scriptrunner.enqueue_rerun()
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

    @parameterized.expand([(True,), (False,)])
    def test_runtime_error(self, show_error_details: bool):
        """Tests that we correctly handle scripts with runtime errors."""
        with testutil.patch_config_options(
            {"client.showErrorDetails": show_error_details}
        ):
            scriptrunner = TestScriptRunner("runtime_error.py")
            scriptrunner.enqueue_rerun()
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
            self.assertEqual(elts[0].WhichOneof("type"), "text")

            if show_error_details:
                self._assert_num_deltas(scriptrunner, 2)
                self.assertEqual(elts[1].WhichOneof("type"), "exception")
            else:
                self._assert_num_deltas(scriptrunner, 2)
                self.assertEqual(elts[1].WhichOneof("type"), "exception")
                exc_msg = elts[1].exception.message
                self.assertTrue(_GENERIC_UNCAUGHT_EXCEPTION_TEXT == exc_msg)

    @pytest.mark.slow
    def test_stop_script(self):
        """Tests that we can stop a script while it's running."""
        scriptrunner = TestScriptRunner("infinite_loop.py")
        scriptrunner.enqueue_rerun()
        scriptrunner.start()

        time.sleep(0.1)
        scriptrunner.enqueue_rerun()

        # This test will fail if the script runner does not execute the infinite
        # script's write call at least once during the final script run.
        # The script runs forever, and when we enqueue a rerun it forcibly
        # stops execution and runs some cleanup. If we do not wait for the
        # forced GC to finish, the script won't start running before we stop
        # the script runner, so the expected delta is never created.
        time.sleep(1)
        scriptrunner.enqueue_stop()
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
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SCRIPT_STARTED,
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS,
                ScriptRunnerEvent.SHUTDOWN,
            ],
        )
        self._assert_text_deltas(scriptrunner, ["loop_forever"])

    def test_shutdown(self):
        """Test that we can shutdown while a script is running."""
        scriptrunner = TestScriptRunner("infinite_loop.py")
        scriptrunner.enqueue_rerun()
        scriptrunner.start()

        time.sleep(0.1)
        scriptrunner.enqueue_shutdown()
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
        scriptrunner.enqueue_rerun()
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
        _create_widget(w3_id, states).int_value = 2
        w4_id = scriptrunner.get_widget_id("button", "button")
        _create_widget(w4_id, states).trigger_value = True

        # Explicitly clear deltas before re-running, to prevent a race
        # condition. (The ScriptRunner will clear the deltas when it
        # starts the re-run, but if that doesn't happen before
        # require_widgets_deltas() starts polling the ScriptRunner's deltas,
        # it will see stale deltas from the last run.)
        scriptrunner.clear_forward_msgs()
        scriptrunner.enqueue_rerun(widget_states=states)

        require_widgets_deltas([scriptrunner])
        self._assert_text_deltas(
            scriptrunner, ["True", "matey!", "2", "True", "loop_forever"]
        )

        # Rerun with previous values. Our button should be reset;
        # everything else should be the same.
        scriptrunner.clear_forward_msgs()
        scriptrunner.enqueue_rerun()

        require_widgets_deltas([scriptrunner])
        self._assert_text_deltas(
            scriptrunner, ["True", "matey!", "2", "False", "loop_forever"]
        )

        scriptrunner.enqueue_shutdown()
        scriptrunner.join()
        self._assert_no_exceptions(scriptrunner)

    def test_query_string_saved(self):
        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner.enqueue_rerun(query_string="foo=bar")
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
        self.assertEqual(shutdown_data["client_state"].query_string, "foo=bar")

    def test_coalesce_rerun(self):
        """Tests that multiple pending rerun requests get coalesced."""
        scriptrunner = TestScriptRunner("good_script.py")
        scriptrunner.enqueue_rerun()
        scriptrunner.enqueue_rerun()
        scriptrunner.enqueue_rerun()
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
        """Tests that nonexistent elements are removed from widget cache after script run."""

        widget_id = "nonexistent_widget_id"

        # Run script, sending in a WidgetStates containing our fake widget ID.
        scriptrunner = TestScriptRunner("good_script.py")
        states = WidgetStates()
        _create_widget(widget_id, states).string_value = "streamlit"
        scriptrunner.enqueue_rerun(widget_states=states)
        scriptrunner.start()

        # At this point, scriptrunner should have finished running, detected
        # that our widget_id wasn't in the list of widgets found this run, and
        # culled it. Ensure widget cache no longer holds our widget ID.
        self.assertIsNone(scriptrunner._session_state.get(widget_id, None))

    # TODO re-enable after flakyness is fixed
    def off_test_multiple_scriptrunners(self):
        """Tests that multiple scriptrunners can run simultaneously."""
        # This scriptrunner will run before the other 3. It's used to retrieve
        # the widget id before initializing deltas on other runners.
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.enqueue_rerun()
        scriptrunner.start()

        # Get the widget ID of a radio button and shut down the first runner.
        require_widgets_deltas([scriptrunner])
        radio_widget_id = scriptrunner.get_widget_id("radio", "radio")
        scriptrunner.enqueue_shutdown()
        scriptrunner.join()
        self._assert_no_exceptions(scriptrunner)

        # Build several runners. Each will set a different int value for
        # its radio button.
        runners = []
        for ii in range(3):
            runner = TestScriptRunner("widgets_script.py")
            runners.append(runner)

            states = WidgetStates()
            _create_widget(radio_widget_id, states).int_value = ii
            runner.enqueue_rerun(widget_state=states)

        # Start the runners and wait a beat.
        for runner in runners:
            runner.start()

        require_widgets_deltas(runners)

        # Ensure that each runner's radio value is as expected.
        for ii, runner in enumerate(runners):
            self._assert_text_deltas(
                runner, ["False", "ahoy!", "%s" % ii, "False", "loop_forever"]
            )
            runner.enqueue_shutdown()

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

    def test_rerun_caching(self):
        """Test that st.caches are maintained across script runs."""
        # Make sure there are no caches from other tests.
        caching._mem_caches.clear()

        # Run st_cache_script.
        runner = TestScriptRunner("st_cache_script.py")
        runner.enqueue_rerun()
        runner.start()
        runner.join()

        # The script has 5 cached functions, each of which writes out
        # some text.
        self._assert_text_deltas(
            runner,
            [
                "cached function called",
                "cached function called",
                "cached function called",
                "cached function called",
                "cached_depending_on_not_yet_defined called",
            ],
        )

        # Re-run the script on a second runner.
        runner = TestScriptRunner("st_cache_script.py")
        runner.enqueue_rerun()
        runner.start()
        runner.join()

        # The cached functions should not have been called on this second run
        self._assert_text_deltas(runner, [])

    def test_invalidating_cache(self):
        """Test that st.caches are cleared when a dependency changes."""
        # Make sure there are no caches from other tests.
        caching._mem_caches.clear()

        # Run st_cache_script.
        runner = TestScriptRunner("st_cache_script.py")
        runner.enqueue_rerun()
        runner.start()
        runner.join()

        # The script has 5 cached functions, each of which writes out
        # som text.
        self._assert_text_deltas(
            runner,
            [
                "cached function called",
                "cached function called",
                "cached function called",
                "cached function called",
                "cached_depending_on_not_yet_defined called",
            ],
        )

        # Run a slightly different script on a second runner.
        runner = TestScriptRunner("st_cache_script_changed.py")
        runner.enqueue_rerun()
        runner.start()
        runner.join()

        # The cached functions should not have been called on this second run,
        # except for the one that has actually changed.
        self._assert_text_deltas(
            runner,
            [
                "cached_depending_on_not_yet_defined called",
            ],
        )

    def _assert_no_exceptions(self, scriptrunner: "TestScriptRunner") -> None:
        """Assert that no uncaught exceptions were thrown in the
        scriptrunner's run thread.
        """
        self.assertEqual([], scriptrunner.script_thread_exceptions)

    def _assert_events(
        self, scriptrunner: "TestScriptRunner", expected_events: List[ScriptRunnerEvent]
    ) -> None:
        """Assert that the ScriptRunnerEvents emitted by a TestScriptRunner
        are what we expect."""
        self.assertEqual(expected_events, scriptrunner.events)

    def _assert_control_events(
        self, scriptrunner: "TestScriptRunner", expected_events: List[ScriptRunnerEvent]
    ) -> None:
        """Assert the non-data ScriptRunnerEvents emitted by a TestScriptRunner
        are what we expect. ("Non-data" refers to all events except
        ENQUEUE_FORWARD_MSG.)
        """
        control_events = [
            event for event in scriptrunner.events if _is_control_event(event)
        ]
        self.assertEqual(expected_events, control_events)

    def _assert_forward_msgs(
        self, scriptrunner: "TestScriptRunner", messages: List[ForwardMsg]
    ) -> None:
        """Assert that the ScriptRunner's ForwardMsgQueue contains the
        given list of ForwardMsgs.
        """
        self.assertEqual(messages, scriptrunner.forward_msgs())

    def _assert_num_deltas(
        self, scriptrunner: "TestScriptRunner", num_deltas: int
    ) -> None:
        """Assert that the given number of delta ForwardMsgs were enqueued
        during script execution.

        Parameters
        ----------
        scriptrunner : TestScriptRunner
        num_deltas : int

        """
        self.assertEqual(num_deltas, len(scriptrunner.deltas()))

    def _assert_text_deltas(
        self, scriptrunner: "TestScriptRunner", text_deltas: List[str]
    ) -> None:
        """Assert that the scriptrunner's ForwardMsgQueue contains text deltas
        with the given contents.
        """
        self.assertEqual(text_deltas, scriptrunner.text_deltas())


class TestScriptRunner(ScriptRunner):
    """Subclasses ScriptRunner to provide some testing features."""

    def __init__(self, script_name: str):
        """Initializes the ScriptRunner for the given script_name"""
        # DeltaGenerator deltas will be enqueued into self.forward_msg_queue.
        self.forward_msg_queue = ForwardMsgQueue()

        self.script_request_queue = ScriptRequestQueue()
        main_script_path = os.path.join(
            os.path.dirname(__file__), "test_data", script_name
        )

        super(TestScriptRunner, self).__init__(
            session_id="test session id",
            session_data=SessionData(main_script_path, "test command line"),
            client_state=ClientState(),
            session_state=SessionState(),
            request_queue=self.script_request_queue,
            uploaded_file_mgr=UploadedFileManager(),
        )

        # Accumulates uncaught exceptions thrown by our run thread.
        self.script_thread_exceptions: List[BaseException] = []

        # Accumulates all ScriptRunnerEvents emitted by us.
        self.events: List[ScriptRunnerEvent] = []
        self.event_data: List[Any] = []

        def record_event(
            sender: Optional[ScriptRunner], event: ScriptRunnerEvent, **kwargs
        ) -> None:
            # Assert that we're not getting unexpected `sender` params
            # from ScriptRunner.on_event
            assert (
                sender is None or sender == self
            ), "Unexpected ScriptRunnerEvent sender!"

            self.events.append(event)
            self.event_data.append(kwargs)

            # Send ENQUEUE_FORWARD_MSGs to our queue
            if event == ScriptRunnerEvent.ENQUEUE_FORWARD_MSG:
                forward_msg = kwargs["forward_msg"]
                self.forward_msg_queue.enqueue(forward_msg)

        self.on_event.connect(record_event, weak=False)

    def enqueue_rerun(
        self,
        argv=None,
        widget_states: Optional[WidgetStates] = None,
        query_string: str = "",
    ) -> None:
        self.script_request_queue.enqueue(
            ScriptRequest.RERUN,
            RerunData(widget_states=widget_states, query_string=query_string),
        )

    def enqueue_stop(self) -> None:
        self.script_request_queue.enqueue(ScriptRequest.STOP)

    def enqueue_shutdown(self) -> None:
        self.script_request_queue.enqueue(ScriptRequest.SHUTDOWN)

    def _run_script_thread(self) -> None:
        try:
            super()._run_script_thread()
        except BaseException as e:
            self.script_thread_exceptions.append(e)

    def _run_script(self, rerun_data: RerunData) -> None:
        self.forward_msg_queue.clear()
        super()._run_script(rerun_data)

    def join(self) -> None:
        """Join the script_thread if it's running."""
        if self._script_thread is not None:
            self._script_thread.join()

    def clear_forward_msgs(self) -> None:
        """Clear all messages from our ForwardMsgQueue."""
        self.forward_msg_queue.clear()

    def forward_msgs(self) -> List[ForwardMsg]:
        """Return all messages in our ForwardMsgQueue."""
        return self.forward_msg_queue._queue

    def deltas(self) -> List[Delta]:
        """Return the delta messages in our ForwardMsgQueue."""
        return [
            msg.delta for msg in self.forward_msg_queue._queue if msg.HasField("delta")
        ]

    def elements(self) -> List[Element]:
        """Return the delta.new_element messages in our ForwardMsgQueue."""
        return [delta.new_element for delta in self.deltas()]

    def text_deltas(self) -> List[str]:
        """Return the string contents of text deltas in our ForwardMsgQueue"""
        return [
            element.text.body
            for element in self.elements()
            if element.WhichOneof("type") == "text"
        ]

    def get_widget_id(self, widget_type: str, label: str) -> Optional[str]:
        """Returns the id of the widget with the specified type and label"""
        for delta in self.deltas():
            new_element = getattr(delta, "new_element", None)
            widget = getattr(new_element, widget_type, None)
            widget_label = getattr(widget, "label", None)
            if widget_label == label:
                return widget.id
        return None


def require_widgets_deltas(
    runners: List[TestScriptRunner], timeout: float = 15
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
        runner.enqueue_shutdown()
    for runner in runners:
        runner.join()

    raise RuntimeError(err_string)
