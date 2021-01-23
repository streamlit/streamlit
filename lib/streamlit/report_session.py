# Copyright 2018-2020 Streamlit Inc.
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
import uuid
from enum import Enum

import tornado.gen
import tornado.ioloop

from streamlit import __version__
from streamlit import caching
from streamlit import config
from streamlit import url_util
from streamlit.media_file_manager import media_file_manager
from streamlit.metrics_util import Installation
from streamlit.report import Report
from streamlit.script_request_queue import RerunData
from streamlit.script_request_queue import ScriptRequest
from streamlit.script_request_queue import ScriptRequestQueue
from streamlit.script_runner import ScriptRunner
from streamlit.script_runner import ScriptRunnerEvent
from streamlit.uploaded_file_manager import UploadedFileManager
from streamlit.credentials import Credentials
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.server.server_util import serialize_forward_msg
from streamlit.storage.file_storage import FileStorage
from streamlit.watcher.local_sources_watcher import LocalSourcesWatcher
import streamlit.elements.exception as exception

LOGGER = get_logger(__name__)


class ReportSessionState(Enum):
    REPORT_NOT_RUNNING = "REPORT_NOT_RUNNING"
    REPORT_IS_RUNNING = "REPORT_IS_RUNNING"
    SHUTDOWN_REQUESTED = "SHUTDOWN_REQUESTED"


class ReportSession(object):
    """
    Contains session data for a single "user" of an active report
    (that is, a connected browser tab).

    Each ReportSession has its own Report, root DeltaGenerator, ScriptRunner,
    and widget state.

    A ReportSession is attached to each thread involved in running its Report.
    """

    def __init__(self, ioloop, script_path, command_line, uploaded_file_manager):
        """Initialize the ReportSession.

        Parameters
        ----------
        ioloop : tornado.ioloop.IOLoop
            The Tornado IOLoop that we're running within.

        script_path : str
            Path of the Python file from which this report is generated.

        command_line : str
            Command line as input by the user.

        uploaded_file_manager : UploadedFileManager
            The server's UploadedFileManager.

        """
        # Each ReportSession has a unique string ID.
        self.id = str(uuid.uuid4())

        self._ioloop = ioloop
        self._report = Report(script_path, command_line)
        self._uploaded_file_mgr = uploaded_file_manager

        self._state = ReportSessionState.REPORT_NOT_RUNNING

        # Need to remember the client state here because when a script reruns
        # due to the source code changing we need to pass in the previous client state.
        self._client_state = ClientState()

        self._local_sources_watcher = LocalSourcesWatcher(
            self._report, self._on_source_file_changed
        )
        self._storage = None
        self._maybe_reuse_previous_run = False
        self._run_on_save = config.get_option("server.runOnSave")

        # The ScriptRequestQueue is the means by which we communicate
        # with the active ScriptRunner.
        self._script_request_queue = ScriptRequestQueue()

        self._scriptrunner = None

        LOGGER.debug("ReportSession initialized (id=%s)", self.id)

    def flush_browser_queue(self):
        """Clear the report queue and return the messages it contained.

        The Server calls this periodically to deliver new messages
        to the browser connected to this report.

        Returns
        -------
        list[ForwardMsg]
            The messages that were removed from the queue and should
            be delivered to the browser.

        """
        return self._report.flush_browser_queue()

    def shutdown(self):
        """Shut down the ReportSession.

        It's an error to use a ReportSession after it's been shut down.

        """
        if self._state != ReportSessionState.SHUTDOWN_REQUESTED:
            LOGGER.debug("Shutting down (id=%s)", self.id)
            # Clear any unused session files in upload file manager and media
            # file manager
            self._uploaded_file_mgr.remove_session_files(self.id)
            media_file_manager.clear_session_files(self.id)
            media_file_manager.del_expired_files()

            # Shut down the ScriptRunner, if one is active.
            # self._state must not be set to SHUTDOWN_REQUESTED until
            # after this is called.
            if self._scriptrunner is not None:
                self._enqueue_script_request(ScriptRequest.SHUTDOWN)

            self._state = ReportSessionState.SHUTDOWN_REQUESTED
            self._local_sources_watcher.close()

    def enqueue(self, msg):
        """Enqueue a new ForwardMsg to our browser queue.

        This can be called on both the main thread and a ScriptRunner
        run thread.

        Parameters
        ----------
        msg : ForwardMsg
            The message to enqueue

        """
        if not config.get_option("client.displayEnabled"):
            return

        # Avoid having two maybe_handle_execution_control_request running on
        # top of each other when tracer is installed. This leads to a lock
        # contention.
        if not config.get_option("runner.installTracer"):
            # If we have an active ScriptRunner, signal that it can handle an
            # execution control request. (Copy the scriptrunner reference to
            # avoid it being unset from underneath us, as this function can be
            # called outside the main thread.)
            scriptrunner = self._scriptrunner

            if scriptrunner is not None:
                scriptrunner.maybe_handle_execution_control_request()

        self._report.enqueue(msg)

    def enqueue_exception(self, e):
        """Enqueue an Exception message.

        Parameters
        ----------
        e : BaseException

        """
        # This does a few things:
        # 1) Clears the current report in the browser.
        # 2) Marks the current report as "stopped" in the browser.
        # 3) HACK: Resets any script params that may have been broken (e.g. the
        # command-line when rerunning with wrong argv[0])
        self._on_scriptrunner_event(ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS)
        self._on_scriptrunner_event(ScriptRunnerEvent.SCRIPT_STARTED)
        self._on_scriptrunner_event(ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS)

        msg = ForwardMsg()
        exception.marshall(msg.delta.new_element.exception, e)

        self.enqueue(msg)

    def request_rerun(self, client_state=None):
        """Signal that we're interested in running the script.

        If the script is not already running, it will be started immediately.
        Otherwise, a rerun will be requested.

        Parameters
        ----------
        client_state : streamlit.proto.ClientState_pb2.ClientState | None
            The ClientState protobuf to run the script with, or None
            to use previous client state.

        """
        if client_state:
            rerun_data = RerunData(
                client_state.query_string, client_state.widget_states
            )
        else:
            rerun_data = RerunData()

        self._enqueue_script_request(ScriptRequest.RERUN, rerun_data)
        self._set_page_config_allowed = True

    def _on_source_file_changed(self):
        """One of our source files changed. Schedule a rerun if appropriate."""
        if self._run_on_save:
            self.request_rerun()
        else:
            self._enqueue_file_change_message()

    def _clear_queue(self):
        self._report.clear()

    def _on_scriptrunner_event(self, event, exception=None, client_state=None):
        """Called when our ScriptRunner emits an event.

        This is *not* called on the main thread.

        Parameters
        ----------
        event : ScriptRunnerEvent

        exception : BaseException | None
            An exception thrown during compilation. Set only for the
            SCRIPT_STOPPED_WITH_COMPILE_ERROR event.

        client_state : streamlit.proto.ClientState_pb2.ClientState | None
            The ScriptRunner's final ClientState. Set only for the
            SHUTDOWN event.

        """
        LOGGER.debug("OnScriptRunnerEvent: %s", event)

        prev_state = self._state

        if event == ScriptRunnerEvent.SCRIPT_STARTED:
            if self._state != ReportSessionState.SHUTDOWN_REQUESTED:
                self._state = ReportSessionState.REPORT_IS_RUNNING

            if config.get_option("server.liveSave"):
                # Enqueue into the IOLoop so it runs without blocking AND runs
                # on the main thread.
                self._ioloop.spawn_callback(self._save_running_report)

            self._clear_queue()
            self._enqueue_new_report_message()

        elif (
            event == ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS
            or event == ScriptRunnerEvent.SCRIPT_STOPPED_WITH_COMPILE_ERROR
        ):

            if self._state != ReportSessionState.SHUTDOWN_REQUESTED:
                self._state = ReportSessionState.REPORT_NOT_RUNNING

            script_succeeded = event == ScriptRunnerEvent.SCRIPT_STOPPED_WITH_SUCCESS

            self._enqueue_report_finished_message(
                ForwardMsg.FINISHED_SUCCESSFULLY
                if script_succeeded
                else ForwardMsg.FINISHED_WITH_COMPILE_ERROR
            )

            if config.get_option("server.liveSave"):
                # Enqueue into the IOLoop so it runs without blocking AND runs
                # on the main thread.
                self._ioloop.spawn_callback(self._save_final_report_and_quit)

            if script_succeeded:
                # When a script completes successfully, we update our
                # LocalSourcesWatcher to account for any source code changes
                # that change which modules should be watched. (This is run on
                # the main thread, because LocalSourcesWatcher is not
                # thread safe.)
                self._ioloop.spawn_callback(
                    self._local_sources_watcher.update_watched_modules
                )
            else:
                # When a script fails to compile, we send along the exception.
                import streamlit.elements.exception as exception_utils

                msg = ForwardMsg()
                exception_utils.marshall(
                    msg.session_event.script_compilation_exception, exception
                )
                self.enqueue(msg)

        elif event == ScriptRunnerEvent.SHUTDOWN:
            # When ScriptRunner shuts down, update our local reference to it,
            # and check to see if we need to spawn a new one. (This is run on
            # the main thread.)

            if self._state == ReportSessionState.SHUTDOWN_REQUESTED:
                # Only clear media files if the script is done running AND the
                # report session is actually shutting down.
                media_file_manager.clear_session_files(self.id)

            def on_shutdown():
                self._client_state = client_state
                self._scriptrunner = None
                # Because a new ScriptEvent could have been enqueued while the
                # scriptrunner was shutting down, we check to see if we should
                # create a new one. (Otherwise, a newly-enqueued ScriptEvent
                # won't be processed until another event is enqueued.)
                self._maybe_create_scriptrunner()

            self._ioloop.spawn_callback(on_shutdown)

        # Send a message if our run state changed
        report_was_running = prev_state == ReportSessionState.REPORT_IS_RUNNING
        report_is_running = self._state == ReportSessionState.REPORT_IS_RUNNING
        if report_is_running != report_was_running:
            self._enqueue_session_state_changed_message()

    def _enqueue_session_state_changed_message(self):
        msg = ForwardMsg()
        msg.session_state_changed.run_on_save = self._run_on_save
        msg.session_state_changed.report_is_running = (
            self._state == ReportSessionState.REPORT_IS_RUNNING
        )
        self.enqueue(msg)

    def _enqueue_file_change_message(self):
        LOGGER.debug("Enqueuing report_changed message (id=%s)", self.id)
        msg = ForwardMsg()
        msg.session_event.report_changed_on_disk = True
        self.enqueue(msg)

    def get_deploy_params(self):
        try:
            from streamlit.git_util import GitRepo

            self._repo = GitRepo(self._report.script_path)
            return self._repo.get_repo_info()
        except:
            # Issues can arise based on the git structure
            # (e.g. if branch is in DETACHED HEAD state,
            # git is not installed, etc)
            # In this case, catch any errors
            return None

    def _enqueue_new_report_message(self):
        self._report.generate_new_id()
        msg = ForwardMsg()
        msg.new_report.report_id = self._report.report_id
        msg.new_report.name = self._report.name
        msg.new_report.script_path = self._report.script_path

        # git deploy params
        deploy_params = self.get_deploy_params()
        if deploy_params is not None:
            repo, branch, module = deploy_params
            msg.new_report.deploy_params.repository = repo
            msg.new_report.deploy_params.branch = branch
            msg.new_report.deploy_params.module = module

        # Immutable session data. We send this every time a new report is
        # started, to avoid having to track whether the client has already
        # received it. It does not change from run to run; it's up to the
        # to perform one-time initialization only once.
        imsg = msg.new_report.initialize
        imsg.config.sharing_enabled = config.get_option("global.sharingMode") != "off"

        imsg.config.gather_usage_stats = config.get_option("browser.gatherUsageStats")

        imsg.config.max_cached_message_age = config.get_option(
            "global.maxCachedMessageAge"
        )

        imsg.config.mapbox_token = config.get_option("mapbox.token")

        imsg.config.allow_run_on_save = config.get_option("server.allowRunOnSave")

        imsg.environment_info.streamlit_version = __version__
        imsg.environment_info.python_version = ".".join(map(str, sys.version_info))

        imsg.session_state.run_on_save = self._run_on_save
        imsg.session_state.report_is_running = (
            self._state == ReportSessionState.REPORT_IS_RUNNING
        )

        imsg.user_info.installation_id = Installation.instance().installation_id
        imsg.user_info.installation_id_v1 = Installation.instance().installation_id_v1
        imsg.user_info.installation_id_v2 = Installation.instance().installation_id_v2
        imsg.user_info.installation_id_v3 = Installation.instance().installation_id_v3
        if Credentials.get_current().activation:
            imsg.user_info.email = Credentials.get_current().activation.email
        else:
            imsg.user_info.email = ""

        imsg.command_line = self._report.command_line
        imsg.session_id = self.id

        self.enqueue(msg)

    def _enqueue_report_finished_message(self, status):
        """Enqueue a report_finished ForwardMsg.

        Parameters
        ----------
        status : ReportFinishedStatus

        """
        msg = ForwardMsg()
        msg.report_finished = status
        self.enqueue(msg)

    def handle_rerun_script_request(self, client_state=None, is_preheat=False):
        """Tell the ScriptRunner to re-run its report.

        Parameters
        ----------
        client_state : streamlit.proto.ClientState_pb2.ClientState | None
            The ClientState protobuf to run the script with, or None
            to use previous client state.
        is_preheat: boolean
            True if this ReportSession should run the script immediately, and
            then ignore the next rerun request if it matches the already-ran
            widget state.

        """
        if is_preheat:
            self._maybe_reuse_previous_run = True  # For next time.

        elif self._maybe_reuse_previous_run:
            # If this is a "preheated" ReportSession, reuse the previous run if
            # the widget state matches. But only do this one time ever.
            self._maybe_reuse_previous_run = False

            has_client_state = False

            if client_state is not None:
                has_query_string = client_state.query_string != ""
                has_widget_states = (
                    client_state.widget_states is not None
                    and len(client_state.widget_states.widgets) > 0
                )
                has_client_state = has_query_string or has_widget_states

            if not has_client_state:
                LOGGER.debug("Skipping rerun since the preheated run is the same")
                return

        self.request_rerun(client_state)

    def handle_stop_script_request(self):
        """Tell the ScriptRunner to stop running its report."""
        self._enqueue_script_request(ScriptRequest.STOP)

    def handle_clear_cache_request(self):
        """Clear this report's cache.

        Because this cache is global, it will be cleared for all users.

        """
        # Setting verbose=True causes clear_cache to print to stdout.
        # Since this command was initiated from the browser, the user
        # doesn't need to see the results of the command in their
        # terminal.
        caching.clear_cache()

    def handle_set_run_on_save_request(self, new_value):
        """Change our run_on_save flag to the given value.

        The browser will be notified of the change.

        Parameters
        ----------
        new_value : bool
            New run_on_save value

        """
        self._run_on_save = new_value
        self._enqueue_session_state_changed_message()

    def _enqueue_script_request(self, request, data=None):
        """Enqueue a ScriptEvent into our ScriptEventQueue.

        If a script thread is not already running, one will be created
        to handle the event.

        Parameters
        ----------
        request : ScriptRequest
            The type of request.

        data : Any
            Data associated with the request, if any.

        """
        if self._state == ReportSessionState.SHUTDOWN_REQUESTED:
            LOGGER.warning("Discarding %s request after shutdown" % request)
            return

        self._script_request_queue.enqueue(request, data)
        self._maybe_create_scriptrunner()

    def _maybe_create_scriptrunner(self):
        """Create a new ScriptRunner if we have unprocessed script requests.

        This is called every time a ScriptRequest is enqueued, and also
        after a ScriptRunner shuts down, in case new requests were enqueued
        during its termination.

        This function should only be called on the main thread.

        """
        if (
            self._state == ReportSessionState.SHUTDOWN_REQUESTED
            or self._scriptrunner is not None
            or not self._script_request_queue.has_request
        ):
            return

        # Create the ScriptRunner, attach event handlers, and start it
        self._scriptrunner = ScriptRunner(
            session_id=self.id,
            report=self._report,
            enqueue_forward_msg=self.enqueue,
            client_state=self._client_state,
            request_queue=self._script_request_queue,
            uploaded_file_mgr=self._uploaded_file_mgr,
        )
        self._scriptrunner.on_event.connect(self._on_scriptrunner_event)
        self._scriptrunner.start()

    @tornado.gen.coroutine
    def handle_save_request(self, ws):
        """Save serialized version of report deltas to the cloud.

        "Progress" ForwardMsgs will be sent to the client during the upload.
        These messages are sent "out of band" - that is, they don't get
        enqueued into the ReportQueue (because they're not part of the report).
        Instead, they're written directly to the report's WebSocket.

        Parameters
        ----------
        ws : _BrowserWebSocketHandler
            The report's websocket handler.

        """

        @tornado.gen.coroutine
        def progress(percent):
            progress_msg = ForwardMsg()
            progress_msg.upload_report_progress = percent
            yield ws.write_message(serialize_forward_msg(progress_msg), binary=True)

        # Indicate that the save is starting.
        try:
            yield progress(0)

            url = yield self._save_final_report(progress)

            # Indicate that the save is done.
            progress_msg = ForwardMsg()
            progress_msg.report_uploaded = url
            yield ws.write_message(serialize_forward_msg(progress_msg), binary=True)

        except Exception as e:
            # Horrible hack to show something if something breaks.
            err_msg = "%s: %s" % (type(e).__name__, str(e) or "No further details.")
            progress_msg = ForwardMsg()
            progress_msg.report_uploaded = err_msg
            yield ws.write_message(serialize_forward_msg(progress_msg), binary=True)

            LOGGER.warning("Failed to save report:", exc_info=e)

    @tornado.gen.coroutine
    def _save_running_report(self):
        files = self._report.serialize_running_report_to_files()
        url = yield self._get_storage().save_report_files(self._report.report_id, files)

        if config.get_option("server.liveSave"):
            url_util.print_url("Saved running app", url)

        raise tornado.gen.Return(url)

    @tornado.gen.coroutine
    def _save_final_report(self, progress_coroutine=None):
        files = self._report.serialize_final_report_to_files()
        url = yield self._get_storage().save_report_files(
            self._report.report_id, files, progress_coroutine
        )

        if config.get_option("server.liveSave"):
            url_util.print_url("Saved final app", url)

        raise tornado.gen.Return(url)

    @tornado.gen.coroutine
    def _save_final_report_and_quit(self):
        yield self._save_final_report()
        self._ioloop.stop()

    def _get_storage(self):
        if self._storage is None:
            sharing_mode = config.get_option("global.sharingMode")
            if sharing_mode == "s3":
                from streamlit.storage.s3_storage import S3Storage

                self._storage = S3Storage()
            elif sharing_mode == "file":
                self._storage = FileStorage()
            else:
                raise RuntimeError("Unsupported sharing mode '%s'" % sharing_mode)
        return self._storage
