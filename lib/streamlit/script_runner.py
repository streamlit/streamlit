# Copyright 2018-2021 Streamlit Inc.
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

import sys
import threading
import gc
from contextlib import contextmanager
from enum import Enum

from blinker import Signal

from streamlit import config
from streamlit import magic
from streamlit import source_util
from streamlit import util
from streamlit.error_util import handle_uncaught_app_exception
from streamlit.media_file_manager import media_file_manager
from streamlit.report_thread import ReportThread, ReportContext
from streamlit.report_thread import get_report_ctx
from streamlit.script_request_queue import ScriptRequest
from streamlit.state.session_state import SessionState
from streamlit.logger import get_logger
from streamlit.proto.ClientState_pb2 import ClientState

LOGGER = get_logger(__name__)


class ScriptRunnerEvent(Enum):
    # The script started running.
    SCRIPT_STARTED = "SCRIPT_STARTED"

    # The script run stopped because of a compile error.
    SCRIPT_STOPPED_WITH_COMPILE_ERROR = "SCRIPT_STOPPED_WITH_COMPILE_ERROR"

    # The script run stopped because it ran to completion, or was
    # interrupted by the user.
    SCRIPT_STOPPED_WITH_SUCCESS = "SCRIPT_STOPPED_WITH_SUCCESS"

    # The ScriptRunner is done processing the ScriptEventQueue and
    # is shut down.
    SHUTDOWN = "SHUTDOWN"


class ScriptRunner(object):
    def __init__(
        self,
        session_id,
        report,
        enqueue_forward_msg,
        client_state,
        request_queue,
        session_state,
        uploaded_file_mgr=None,
    ):
        """Initialize the ScriptRunner.

        (The ScriptRunner won't start executing until start() is called.)

        Parameters
        ----------
        session_id : str
            The ReportSession's id.

        report : Report
            The ReportSession's report.

        client_state : streamlit.proto.ClientState_pb2.ClientState
            The current state from the client (widgets and query params).

        request_queue : ScriptRequestQueue
            The queue that the ReportSession is publishing ScriptRequests to.
            ScriptRunner will continue running until the queue is empty,
            and then shut down.

        widget_mgr : WidgetManager
            The ReportSession's WidgetManager.

        uploaded_file_mgr : UploadedFileManager
            The File manager to store the data uploaded by the file_uploader widget.

        """
        self._session_id = session_id
        self._report = report
        self._enqueue_forward_msg = enqueue_forward_msg
        self._request_queue = request_queue
        self._uploaded_file_mgr = uploaded_file_mgr

        self._client_state = client_state
        self._session_state: SessionState = session_state
        self._session_state.set_from_proto(client_state.widget_states)

        self.on_event = Signal(
            doc="""Emitted when a ScriptRunnerEvent occurs.

            This signal is *not* emitted on the same thread that the
            ScriptRunner was created on.

            Parameters
            ----------
            event : ScriptRunnerEvent

            exception : BaseException | None
                Our compile error. Set only for the
                SCRIPT_STOPPED_WITH_COMPILE_ERROR event.

            widget_states : streamlit.proto.WidgetStates_pb2.WidgetStates | None
                The ScriptRunner's final WidgetStates. Set only for the
                SHUTDOWN event.
            """
        )

        # Set to true when we process a SHUTDOWN request
        self._shutdown_requested = False

        # Set to true while we're executing. Used by
        # maybe_handle_execution_control_request.
        self._execing = False

        # This is initialized in start()
        self._script_thread = None

    def __repr__(self) -> str:
        return util.repr_(self)

    def start(self):
        """Start a new thread to process the ScriptEventQueue.

        This must be called only once.

        """
        if self._script_thread is not None:
            raise Exception("ScriptRunner was already started")

        self._script_thread = ReportThread(
            session_id=self._session_id,
            enqueue=self._enqueue_forward_msg,
            query_string=self._client_state.query_string,
            session_state=self._session_state,
            uploaded_file_mgr=self._uploaded_file_mgr,
            target=self._process_request_queue,
            name="ScriptRunner.scriptThread",
        )
        self._script_thread.start()

    def _process_request_queue(self):
        """Process the ScriptRequestQueue and then exits.

        This is run in a separate thread.

        """
        LOGGER.debug("Beginning script thread")

        while not self._shutdown_requested and self._request_queue.has_request:
            request, data = self._request_queue.dequeue()
            if request == ScriptRequest.STOP:
                LOGGER.debug("Ignoring STOP request while not running")
            elif request == ScriptRequest.SHUTDOWN:
                LOGGER.debug("Shutting down")
                self._shutdown_requested = True
            elif request == ScriptRequest.RERUN:
                self._run_script(data)
            else:
                raise RuntimeError("Unrecognized ScriptRequest: %s" % request)

        # Send a SHUTDOWN event before exiting. This includes the widget values
        # as they existed after our last successful script run, which the
        # ReportSession will pass on to the next ScriptRunner that gets
        # created.
        client_state = ClientState()
        client_state.query_string = self._client_state.query_string
        widget_states = self._session_state.as_widget_states()
        client_state.widget_states.widgets.extend(widget_states)
        self.on_event.send(ScriptRunnerEvent.SHUTDOWN, client_state=client_state)

    def _is_in_script_thread(self):
        """True if the calling function is running in the script thread"""
        return self._script_thread == threading.current_thread()

    def maybe_handle_execution_control_request(self):
        if not self._is_in_script_thread():
            # We can only handle execution_control_request if we're on the
            # script execution thread. However, it's possible for deltas to
            # be enqueued (and, therefore, for this function to be called)
            # in separate threads, so we check for that here.
            return

        if not self._execing:
            # If the _execing flag is not set, we're not actually inside
            # an exec() call. This happens when our script exec() completes,
            # we change our state to STOPPED, and a statechange-listener
            # enqueues a new ForwardEvent
            return

        # Pop the next request from our queue.
        request, data = self._request_queue.dequeue()
        if request is None:
            return

        LOGGER.debug("Received ScriptRequest: %s", request)
        if request == ScriptRequest.STOP:
            raise StopException()
        elif request == ScriptRequest.SHUTDOWN:
            self._shutdown_requested = True
            raise StopException()
        elif request == ScriptRequest.RERUN:
            raise RerunException(data)
        else:
            raise RuntimeError("Unrecognized ScriptRequest: %s" % request)

    def _install_tracer(self):
        """Install function that runs before each line of the script."""

        def trace_calls(frame, event, arg):
            self.maybe_handle_execution_control_request()
            return trace_calls

        # Python interpreters are not required to implement sys.settrace.
        if hasattr(sys, "settrace"):
            sys.settrace(trace_calls)

    @contextmanager
    def _set_execing_flag(self):
        """A context for setting the ScriptRunner._execing flag.

        Used by maybe_handle_execution_control_request to ensure that
        we only handle requests while we're inside an exec() call
        """
        if self._execing:
            raise RuntimeError("Nested set_execing_flag call")
        self._execing = True
        try:
            yield
        finally:
            self._execing = False

    def _run_script(self, rerun_data):
        """Run our script.

        Parameters
        ----------
        rerun_data: RerunData
            The RerunData to use.

        """
        assert self._is_in_script_thread()

        LOGGER.debug("Running script %s", rerun_data)

        # Reset DeltaGenerators, widgets, media files.
        media_file_manager.clear_session_files()

        ctx = get_report_ctx()
        if ctx is None:
            # This should never be possible on the script_runner thread.
            raise RuntimeError(
                "ScriptRunner thread has a null ReportContext. Something has gone very wrong!"
            )

        ctx.reset(query_string=rerun_data.query_string)

        self.on_event.send(ScriptRunnerEvent.SCRIPT_STARTED)

        # Compile the script. Any errors thrown here will be surfaced
        # to the user via a modal dialog in the frontend, and won't result
        # in their previous report disappearing.

        try:
            with source_util.open_python_file(self._report.script_path) as f:
                filebody = f.read()

            if config.get_option("runner.magicEnabled"):
                filebody = magic.add_magic(filebody, self._report.script_path)

            code = compile(
                filebody,
                # Pass in the file path so it can show up in exceptions.
                self._report.script_path,
                # We're compiling entire blocks of Python, so we need "exec"
                # mode (as opposed to "eval" or "single").
                mode="exec",
                # Don't inherit any flags or "future" statements.
                flags=0,
                dont_inherit=1,
                # Use the default optimization options.
                optimize=-1,
            )

        except BaseException as e:
            # We got a compile error. Send an error event and bail immediately.
            LOGGER.debug("Fatal script error: %s" % e)
            self.on_event.send(
                ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR, exception=e
            )
            return

        # If we get here, we've successfully compiled our script. The next step
        # is to run it. Errors thrown during execution will be shown to the
        # user as ExceptionElements.

        if config.get_option("runner.installTracer"):
            self._install_tracer()

        # This will be set to a RerunData instance if our execution
        # is interrupted by a RerunException.
        rerun_with_data = None

        try:
            # Create fake module. This gives us a name global namespace to
            # execute the code in.
            module = _new_module("__main__")

            # Install the fake module as the __main__ module. This allows
            # the pickle module to work inside the user's code, since it now
            # can know the module where the pickled objects stem from.
            # IMPORTANT: This means we can't use "if __name__ == '__main__'" in
            # our code, as it will point to the wrong module!!!
            sys.modules["__main__"] = module

            # Add special variables to the module's globals dict.
            # Note: The following is a requirement for the CodeHasher to
            # work correctly. The CodeHasher is scoped to
            # files contained in the directory of __main__.__file__, which we
            # assume is the main script directory.
            module.__dict__["__file__"] = self._report.script_path

            with modified_sys_path(self._report), self._set_execing_flag():
                # Run callbacks for widgets whose values have changed.
                if rerun_data.widget_states is not None:
                    # Update the WidgetManager with the new widget_states.
                    # The old states, used to skip callbacks if values
                    # haven't changed, are also preserved in the
                    # WidgetManager.
                    self._session_state.compact_state()
                    self._session_state.set_from_proto(rerun_data.widget_states)

                    self._session_state.call_callbacks()

                ctx.on_script_start()
                exec(code, module.__dict__)

        except RerunException as e:
            rerun_with_data = e.rerun_data

        except StopException:
            pass

        except BaseException as e:
            handle_uncaught_app_exception(e)

        finally:
            self._on_script_finished(ctx)

        # Use _log_if_error() to make sure we never ever ever stop running the
        # script without meaning to.
        _log_if_error(_clean_problem_modules)

        if rerun_with_data is not None:
            self._run_script(rerun_with_data)

    def _on_script_finished(self, ctx: ReportContext) -> None:
        """Called when our script finishes executing, even if it finished
        early with an exception. We perform post-run cleanup here.
        """
        self._session_state.reset_triggers()
        self._session_state.cull_nonexistent(ctx.widget_ids_this_run.items())
        # Signal that the script has finished. (We use SCRIPT_STOPPED_WITH_SUCCESS
        # even if we were stopped with an exception.)
        self.on_event.send(ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS)
        # Delete expired files now that the script has run and files in use
        # are marked as active.
        media_file_manager.del_expired_files()

        # Force garbage collection to run, to help avoid memory use building up
        # This is usually not an issue, but sometimes GC takes time to kick in and
        # causes apps to go over resource limits, and forcing it to run between
        # script runs is low cost, since we aren't doing much work anyway.
        if config.get_option("runner.postScriptGC"):
            gc.collect(2)


class ScriptControlException(BaseException):
    """Base exception for ScriptRunner."""

    pass


class StopException(ScriptControlException):
    """Silently stop the execution of the user's script."""

    pass


class RerunException(ScriptControlException):
    """Silently stop and rerun the user's script."""

    def __init__(self, rerun_data):
        """Construct a RerunException

        Parameters
        ----------
        rerun_data : RerunData
            The RerunData that should be used to rerun the report
        """
        self.rerun_data = rerun_data

    def __repr__(self) -> str:
        return util.repr_(self)


def _clean_problem_modules():
    """Some modules are stateful, so we have to clear their state."""

    if "keras" in sys.modules:
        try:
            keras = sys.modules["keras"]
            keras.backend.clear_session()  # type: ignore[attr-defined]
        except:
            pass

    if "matplotlib.pyplot" in sys.modules:
        try:
            plt = sys.modules["matplotlib.pyplot"]
            plt.close("all")  # type: ignore[attr-defined]
        except:
            pass


def _new_module(name):
    """Create a new module with the given name."""

    import types

    return types.ModuleType(name)


# Code modified from IPython (BSD license)
# Source: https://github.com/ipython/ipython/blob/master/IPython/utils/syspathcontext.py#L42
class modified_sys_path(object):
    """A context for prepending a directory to sys.path for a second."""

    def __init__(self, report):
        self._report = report
        self._added_path = False

    def __repr__(self) -> str:
        return util.repr_(self)

    def __enter__(self):
        if self._report.script_path not in sys.path:
            sys.path.insert(0, self._report.script_path)
            self._added_path = True

    def __exit__(self, type, value, traceback):
        if self._added_path:
            try:
                sys.path.remove(self._report.script_path)
            except ValueError:
                pass

        # Returning False causes any exceptions to be re-raised.
        return False


# The reason this is not a decorator is because we want to make it clear at the
# calling location that this function is being used.
def _log_if_error(fn):
    try:
        fn()
    except Exception as e:
        LOGGER.warning(e)
