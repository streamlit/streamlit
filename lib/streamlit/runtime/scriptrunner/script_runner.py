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

from __future__ import annotations

import gc
import sys
import threading
import types
from contextlib import contextmanager
from enum import Enum
from timeit import default_timer as timer
from typing import TYPE_CHECKING, Callable, Final

from blinker import Signal

from streamlit import config, runtime, util
from streamlit.errors import FragmentStorageKeyError
from streamlit.logger import get_logger
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner.exceptions import RerunException, StopException
from streamlit.runtime.scriptrunner.exec_code import exec_func_with_error_handling
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.scriptrunner.script_requests import (
    RerunData,
    ScriptRequests,
    ScriptRequestType,
)
from streamlit.runtime.scriptrunner.script_run_context import (
    ScriptRunContext,
    add_script_run_ctx,
    get_script_run_ctx,
)
from streamlit.runtime.state import (
    SCRIPT_RUN_WITHOUT_ERRORS_KEY,
    SafeSessionState,
    SessionState,
)
from streamlit.vendor.ipython.modified_sys_path import modified_sys_path

if TYPE_CHECKING:
    from streamlit.runtime.fragment import FragmentStorage
    from streamlit.runtime.pages_manager import PagesManager
    from streamlit.runtime.scriptrunner.script_cache import ScriptCache
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager

_LOGGER: Final = get_logger(__name__)


class ScriptRunnerEvent(Enum):
    # "Control" events. These are emitted when the ScriptRunner's state changes.

    # The script started running.
    SCRIPT_STARTED = "SCRIPT_STARTED"

    # The script run stopped because of a compile error.
    SCRIPT_STOPPED_WITH_COMPILE_ERROR = "SCRIPT_STOPPED_WITH_COMPILE_ERROR"

    # The script run stopped because it ran to completion, or was
    # interrupted by the user.
    SCRIPT_STOPPED_WITH_SUCCESS = "SCRIPT_STOPPED_WITH_SUCCESS"

    # The script run stopped in order to start a script run with newer widget state.
    SCRIPT_STOPPED_FOR_RERUN = "SCRIPT_STOPPED_FOR_RERUN"

    # The script run corresponding to a fragment ran to completion, or was interrupted
    # by the user.
    FRAGMENT_STOPPED_WITH_SUCCESS = "FRAGMENT_STOPPED_WITH_SUCCESS"

    # The ScriptRunner is done processing the ScriptEventQueue and
    # is shut down.
    SHUTDOWN = "SHUTDOWN"

    # "Data" events. These are emitted when the ScriptRunner's script has
    # data to send to the frontend.

    # The script has a ForwardMsg to send to the frontend.
    ENQUEUE_FORWARD_MSG = "ENQUEUE_FORWARD_MSG"


"""
Note [Threading]
There are two kinds of threads in Streamlit, the main thread and script threads.
The main thread is started by invoking the Streamlit CLI, and bootstraps the
framework and runs the Tornado webserver.
A script thread is created by a ScriptRunner when it starts. The script thread
is where the ScriptRunner executes, including running the user script itself,
processing messages to/from the frontend, and all the Streamlit library function
calls in the user script.
It is possible for the user script to spawn its own threads, which could call
Streamlit functions. We restrict the ScriptRunner's execution control to the
script thread. Calling Streamlit functions from other threads is unlikely to
work correctly due to lack of ScriptRunContext, so we may add a guard against
it in the future.
"""


class ScriptRunner:
    def __init__(
        self,
        session_id: str,
        main_script_path: str,
        session_state: SessionState,
        uploaded_file_mgr: UploadedFileManager,
        script_cache: ScriptCache,
        initial_rerun_data: RerunData,
        user_info: dict[str, str | None],
        fragment_storage: FragmentStorage,
        pages_manager: PagesManager,
    ):
        """Initialize the ScriptRunner.

        (The ScriptRunner won't start executing until start() is called.)

        Parameters
        ----------
        session_id
            The AppSession's id.

        main_script_path
            Path to our main app script.

        session_state
            The AppSession's SessionState instance.

        uploaded_file_mgr
            The File manager to store the data uploaded by the file_uploader widget.

        script_cache
            A ScriptCache instance.

        initial_rerun_data
            RerunData to initialize this ScriptRunner with.

        user_info
            A dict that contains information about the current user. For now,
            it only contains the user's email address.

            {
                "email": "example@example.com"
            }

            Information about the current user is optionally provided when a
            websocket connection is initialized via the "X-Streamlit-User" header.

        fragment_storage
            The AppSession's FragmentStorage instance.
        """
        self._session_id = session_id
        self._main_script_path = main_script_path
        self._session_state = SafeSessionState(
            session_state, yield_callback=self._maybe_handle_execution_control_request
        )
        self._uploaded_file_mgr = uploaded_file_mgr
        self._script_cache = script_cache
        self._user_info = user_info
        self._fragment_storage = fragment_storage

        self._pages_manager = pages_manager
        self._requests = ScriptRequests()
        self._requests.request_rerun(initial_rerun_data)

        self.on_event = Signal(
            doc="""Emitted when a ScriptRunnerEvent occurs.

            This signal is generally emitted on the ScriptRunner's script
            thread (which is *not* the same thread that the ScriptRunner was
            created on).

            Parameters
            ----------
            sender: ScriptRunner
                The sender of the event (this ScriptRunner).

            event : ScriptRunnerEvent

            forward_msg : ForwardMsg | None
                The ForwardMsg to send to the frontend. Set only for the
                ENQUEUE_FORWARD_MSG event.

            exception : BaseException | None
                Our compile error. Set only for the
                SCRIPT_STOPPED_WITH_COMPILE_ERROR event.

            widget_states : streamlit.proto.WidgetStates_pb2.WidgetStates | None
                The ScriptRunner's final WidgetStates. Set only for the
                SHUTDOWN event.
            """
        )

        # Set to true while we're executing. Used by
        # _maybe_handle_execution_control_request.
        self._execing = False

        # This is initialized in start()
        self._script_thread: threading.Thread | None = None

    def __repr__(self) -> str:
        return util.repr_(self)

    def request_stop(self) -> None:
        """Request that the ScriptRunner stop running its script and
        shut down. The ScriptRunner will handle this request when it reaches
        an interrupt point.

        Safe to call from any thread.
        """
        self._requests.request_stop()

    def request_rerun(self, rerun_data: RerunData) -> bool:
        """Request that the ScriptRunner interrupt its currently-running
        script and restart it.

        If the ScriptRunner has been stopped, this request can't be honored:
        return False.

        Otherwise, record the request and return True. The ScriptRunner will
        handle the rerun request as soon as it reaches an interrupt point.

        Safe to call from any thread.
        """
        return self._requests.request_rerun(rerun_data)

    def start(self) -> None:
        """Start a new thread to process the ScriptEventQueue.

        This must be called only once.

        """
        if self._script_thread is not None:
            raise Exception("ScriptRunner was already started")

        self._script_thread = threading.Thread(
            target=self._run_script_thread,
            name="ScriptRunner.scriptThread",
        )
        self._script_thread.start()

    def _get_script_run_ctx(self) -> ScriptRunContext:
        """Get the ScriptRunContext for the current thread.

        Returns
        -------
        ScriptRunContext
            The ScriptRunContext for the current thread.

        Raises
        ------
        AssertionError
            If called outside of a ScriptRunner thread.
        RuntimeError
            If there is no ScriptRunContext for the current thread.

        """
        assert self._is_in_script_thread()

        ctx = get_script_run_ctx()
        if ctx is None:
            # This should never be possible on the script_runner thread.
            raise RuntimeError(
                "ScriptRunner thread has a null ScriptRunContext. "
                "Something has gone very wrong!"
            )
        return ctx

    def _run_script_thread(self) -> None:
        """The entry point for the script thread.

        Processes the ScriptRequestQueue, which will at least contain the RERUN
        request that will trigger the first script-run.

        When the ScriptRequestQueue is empty, or when a SHUTDOWN request is
        dequeued, this function will exit and its thread will terminate.
        """
        assert self._is_in_script_thread()

        _LOGGER.debug("Beginning script thread")

        # Create and attach the thread's ScriptRunContext
        ctx = ScriptRunContext(
            session_id=self._session_id,
            _enqueue=self._enqueue_forward_msg,
            script_requests=self._requests,
            query_string="",
            session_state=self._session_state,
            uploaded_file_mgr=self._uploaded_file_mgr,
            main_script_path=self._main_script_path,
            user_info=self._user_info,
            gather_usage_stats=bool(config.get_option("browser.gatherUsageStats")),
            fragment_storage=self._fragment_storage,
            pages_manager=self._pages_manager,
        )
        add_script_run_ctx(threading.current_thread(), ctx)

        request = self._requests.on_scriptrunner_ready()
        while request.type == ScriptRequestType.RERUN:
            # When the script thread starts, we'll have a pending rerun
            # request that we'll handle immediately. When the script finishes,
            # it's possible that another request has come in that we need to
            # handle, which is why we call _run_script in a loop.
            self._run_script(request.rerun_data)
            request = self._requests.on_scriptrunner_ready()

        assert request.type == ScriptRequestType.STOP

        # Send a SHUTDOWN event before exiting, so some state can be saved
        # for use in a future script run when not triggered by the client.
        client_state = ClientState()
        client_state.query_string = ctx.query_string
        client_state.page_script_hash = ctx.page_script_hash
        self.on_event.send(
            self, event=ScriptRunnerEvent.SHUTDOWN, client_state=client_state
        )

    def _is_in_script_thread(self) -> bool:
        """True if the calling function is running in the script thread"""
        return self._script_thread == threading.current_thread()

    def _enqueue_forward_msg(self, msg: ForwardMsg) -> None:
        """Enqueue a ForwardMsg to our browser queue.
        This private function is called by ScriptRunContext only.

        It may be called from the script thread OR the main thread.
        """
        # Whenever we enqueue a ForwardMsg, we also handle any pending
        # execution control request. This means that a script can be
        # cleanly interrupted and stopped inside most `st.foo` calls.
        self._maybe_handle_execution_control_request()

        # Pass the message to our associated AppSession.
        self.on_event.send(
            self, event=ScriptRunnerEvent.ENQUEUE_FORWARD_MSG, forward_msg=msg
        )

    def _maybe_handle_execution_control_request(self) -> None:
        """Check our current ScriptRequestState to see if we have a
        pending STOP or RERUN request.

        This function is called every time the app script enqueues a
        ForwardMsg, which means that most `st.foo` commands - which generally
        involve sending a ForwardMsg to the frontend - act as implicit
        yield points in the script's execution.
        """
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

        request = self._requests.on_scriptrunner_yield()
        if request is None:
            # No RERUN or STOP request.
            return

        if request.type == ScriptRequestType.RERUN:
            raise RerunException(request.rerun_data)

        assert request.type == ScriptRequestType.STOP
        raise StopException()

    @contextmanager
    def _set_execing_flag(self):
        """A context for setting the ScriptRunner._execing flag.

        Used by _maybe_handle_execution_control_request to ensure that
        we only handle requests while we're inside an exec() call
        """
        if self._execing:
            raise RuntimeError("Nested set_execing_flag call")
        self._execing = True
        try:
            yield
        finally:
            self._execing = False

    def _run_script(self, rerun_data: RerunData) -> None:
        """Run our script.

        Parameters
        ----------
        rerun_data: RerunData
            The RerunData to use.

        """

        assert self._is_in_script_thread()

        # An explicit loop instead of recursion to avoid stack overflows
        while True:
            _LOGGER.debug("Running script %s", rerun_data)
            start_time: float = timer()
            prep_time: float = 0  # This will be overwritten once preparations are done.

            if not rerun_data.fragment_id_queue:
                # Don't clear session refs for media files if we're running a fragment.
                # Otherwise, we're likely to remove files that still have corresponding
                # download buttons/links to them present in the app, which will result
                # in a 404 should the user click on them.
                runtime.get_instance().media_file_mgr.clear_session_refs()

            self._pages_manager.set_script_intent(
                rerun_data.page_script_hash, rerun_data.page_name
            )
            active_script = self._pages_manager.get_initial_active_script(
                rerun_data.page_script_hash, rerun_data.page_name
            )
            main_page_info = self._pages_manager.get_main_page()

            page_script_hash = (
                active_script["page_script_hash"]
                if active_script is not None
                else main_page_info["page_script_hash"]
            )

            fragment_ids_this_run = list(rerun_data.fragment_id_queue)

            ctx = self._get_script_run_ctx()
            # Clear widget state on page change. This normally happens implicitly
            # in the script run cleanup steps, but doing it explicitly ensures
            # it happens even if a script run was interrupted.
            previous_page_script_hash = ctx.page_script_hash
            if previous_page_script_hash != page_script_hash:
                # Page changed, enforce reset widget state where possible.
                # This enforcement matters when a new script thread is started
                # before the previous script run is completed (from user
                # interaction). Use the widget ids from the rerun data to
                # maintain some widget state, as the rerun data should
                # contain the latest widget ids from the frontend.
                widget_ids: set[str] = set()

                if (
                    rerun_data.widget_states is not None
                    and rerun_data.widget_states.widgets is not None
                ):
                    widget_ids = {w.id for w in rerun_data.widget_states.widgets}
                self._session_state.on_script_finished(widget_ids)

            ctx.reset(
                query_string=rerun_data.query_string,
                page_script_hash=page_script_hash,
                fragment_ids_this_run=fragment_ids_this_run,
            )
            self._pages_manager.reset_active_script_hash()

            # We want to clear the forward_msg_queue during full script runs and
            # fragment-scoped fragment reruns. For normal fragment runs, clearing the
            # forward_msg_queue may cause us to drop messages either corresponding to
            # other, unrelated fragments or that this fragment run depends on.
            fragment_ids_this_run = rerun_data.fragment_id_queue
            clear_forward_msg_queue = (
                not fragment_ids_this_run or rerun_data.is_fragment_scoped_rerun
            )

            self.on_event.send(
                self,
                event=ScriptRunnerEvent.SCRIPT_STARTED,
                page_script_hash=page_script_hash,
                fragment_ids_this_run=fragment_ids_this_run,
                pages=self._pages_manager.get_pages(),
                clear_forward_msg_queue=clear_forward_msg_queue,
            )

            # Compile the script. Any errors thrown here will be surfaced
            # to the user via a modal dialog in the frontend, and won't result
            # in their previous script elements disappearing.
            try:
                if active_script is not None:
                    script_path = active_script["script_path"]
                else:
                    # page must not be found
                    script_path = main_page_info["script_path"]

                    # At this point, we know that either
                    #   * the script corresponding to the hash requested no longer
                    #     exists, or
                    #   * we were not able to find a script with the requested page
                    #     name.
                    # In both of these cases, we want to send a page_not_found
                    # message to the frontend.
                    msg = ForwardMsg()
                    msg.page_not_found.page_name = rerun_data.page_name
                    ctx.enqueue(msg)

                code = self._script_cache.get_bytecode(script_path)

            except Exception as ex:
                # We got a compile error. Send an error event and bail immediately.
                _LOGGER.debug("Fatal script error: %s", ex)
                self._session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY] = False
                self.on_event.send(
                    self,
                    event=ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR,
                    exception=ex,
                )
                return

            # If we get here, we've successfully compiled our script. The next step
            # is to run it. Errors thrown during execution will be shown to the
            # user as ExceptionElements.

            # Create fake module. This gives us a name global namespace to
            # execute the code in.
            module = self._new_module("__main__")

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
            module.__dict__["__file__"] = script_path

            def code_to_exec(code=code, module=module, ctx=ctx, rerun_data=rerun_data):
                with modified_sys_path(
                    self._main_script_path
                ), self._set_execing_flag():
                    # Run callbacks for widgets whose values have changed.
                    if rerun_data.widget_states is not None:
                        self._session_state.on_script_will_rerun(
                            rerun_data.widget_states
                        )

                    ctx.on_script_start()

                    if rerun_data.fragment_id_queue:
                        for fragment_id in rerun_data.fragment_id_queue:
                            try:
                                wrapped_fragment = self._fragment_storage.get(
                                    fragment_id
                                )
                                wrapped_fragment()

                            except FragmentStorageKeyError:
                                raise RuntimeError(
                                    f"Could not find fragment with id {fragment_id}"
                                )
                            except (RerunException, StopException) as e:
                                # The wrapped_fragment function is executed
                                # inside of a exec_func_with_error_handling call, so
                                # there is a correct handler for these exceptions.
                                raise e
                            except Exception:
                                # Ignore exceptions raised by fragments here as we don't
                                # want to stop the execution of other fragments. The
                                # error itself is already rendered within the wrapped
                                # fragment.
                                pass

                    else:
                        exec(code, module.__dict__)
                        self._fragment_storage.clear(
                            new_fragment_ids=ctx.new_fragment_ids
                        )

                    self._session_state.maybe_check_serializable()
                    # check for control requests, e.g. rerun requests have arrived
                    self._maybe_handle_execution_control_request()

            prep_time = timer() - start_time
            (
                _,
                run_without_errors,
                rerun_exception_data,
                premature_stop,
                uncaught_exception,
            ) = exec_func_with_error_handling(code_to_exec, ctx)
            # setting the session state here triggers a yield-callback call
            # which reads self._requests and checks for rerun data
            self._session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY] = run_without_errors

            if rerun_exception_data:
                # The handling for when a full script run or a fragment is stopped early
                # is the same, so we only have one ScriptRunnerEvent for this scenario.
                finished_event = ScriptRunnerEvent.SCRIPT_STOPPED_FOR_RERUN
            elif rerun_data.fragment_id_queue:
                finished_event = ScriptRunnerEvent.FRAGMENT_STOPPED_WITH_SUCCESS
            else:
                finished_event = ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS

            if ctx.gather_usage_stats:
                try:
                    # Prevent issues with circular import
                    from streamlit.runtime.metrics_util import (
                        create_page_profile_message,
                        to_microseconds,
                    )

                    # Create and send page profile information
                    ctx.enqueue(
                        create_page_profile_message(
                            commands=ctx.tracked_commands,
                            exec_time=to_microseconds(timer() - start_time),
                            prep_time=to_microseconds(prep_time),
                            uncaught_exception=(
                                type(uncaught_exception).__name__
                                if uncaught_exception
                                else None
                            ),
                        )
                    )
                except Exception as ex:
                    # Always capture all exceptions since we want to make sure that
                    # the telemetry never causes any issues.
                    _LOGGER.debug("Failed to create page profile", exc_info=ex)
            self._on_script_finished(ctx, finished_event, premature_stop)

            # # Use _log_if_error() to make sure we never ever ever stop running the
            # # script without meaning to.
            _log_if_error(_clean_problem_modules)

            if rerun_exception_data is not None:
                rerun_data = rerun_exception_data
            else:
                break

    def _on_script_finished(
        self, ctx: ScriptRunContext, event: ScriptRunnerEvent, premature_stop: bool
    ) -> None:
        """Called when our script finishes executing, even if it finished
        early with an exception. We perform post-run cleanup here.
        """
        # Tell session_state to update itself in response
        if not premature_stop:
            self._session_state.on_script_finished(ctx.widget_ids_this_run)

        # Signal that the script has finished. (We use SCRIPT_STOPPED_WITH_SUCCESS
        # even if we were stopped with an exception.)
        self.on_event.send(self, event=event)

        # Remove orphaned files now that the script has run and files in use
        # are marked as active.
        runtime.get_instance().media_file_mgr.remove_orphaned_files()

        # Force garbage collection to run, to help avoid memory use building up
        # This is usually not an issue, but sometimes GC takes time to kick in and
        # causes apps to go over resource limits, and forcing it to run between
        # script runs is low cost, since we aren't doing much work anyway.
        if config.get_option("runner.postScriptGC"):
            gc.collect(2)

    def _new_module(self, name: str) -> types.ModuleType:
        """Create a new module with the given name."""
        return types.ModuleType(name)


def _clean_problem_modules() -> None:
    """Some modules are stateful, so we have to clear their state."""

    if "keras" in sys.modules:
        try:
            keras = sys.modules["keras"]
            keras.backend.clear_session()
        except Exception:
            # We don't want to crash the app if we can't clear the Keras session.
            pass

    if "matplotlib.pyplot" in sys.modules:
        try:
            plt = sys.modules["matplotlib.pyplot"]
            plt.close("all")
        except Exception:
            # We don't want to crash the app if we can't close matplotlib
            pass


# The reason this is not a decorator is because we want to make it clear at the
# calling location that this function is being used.
def _log_if_error(fn: Callable[[], None]) -> None:
    try:
        fn()
    except Exception as e:
        _LOGGER.warning(e)
