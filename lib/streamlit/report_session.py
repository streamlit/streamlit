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
import uuid
from enum import Enum
from typing import TYPE_CHECKING

import tornado.gen
import tornado.ioloop

import streamlit.elements.exception as exception_utils
import streamlit.server.server_util as server_util
from streamlit import __version__, config, legacy_caching, secrets, url_util, caching
from streamlit.case_converters import to_snake_case
from streamlit.credentials import Credentials
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.logger import get_logger
from streamlit.metrics_util import Installation
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.GitInfo_pb2 import GitInfo
from streamlit.proto.NewReport_pb2 import Config, CustomThemeConfig, UserInfo
from streamlit.report import Report
from streamlit.script_request_queue import RerunData, ScriptRequest, ScriptRequestQueue
from streamlit.script_runner import ScriptRunner, ScriptRunnerEvent
from streamlit.storage.file_storage import FileStorage
from streamlit.watcher.local_sources_watcher import LocalSourcesWatcher

LOGGER = get_logger(__name__)
if TYPE_CHECKING:
    from streamlit.state.session_state import SessionState


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

    def __init__(
        self,
        ioloop,
        script_path,
        command_line,
        uploaded_file_manager,
        message_enqueued_callback,
    ):
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

        message_enqueued_callback : Callable[[], None]
             After enqueuing a message, this callable notification will be invoked.

        """
        # Each ReportSession has a unique string ID.
        self.id = str(uuid.uuid4())

        self._ioloop = ioloop
        self._report = Report(script_path, command_line)
        self._uploaded_file_mgr = uploaded_file_manager
        self._message_enqueued_callback = message_enqueued_callback

        self._state = ReportSessionState.REPORT_NOT_RUNNING

        # Need to remember the client state here because when a script reruns
        # due to the source code changing we need to pass in the previous client state.
        self._client_state = ClientState()

        # The script should rerun when the `secrets.toml` file has been changed.
        secrets._file_change_listener.connect(self._on_secrets_file_changed)

        self._local_sources_watcher = LocalSourcesWatcher(
            self._report, self._on_source_file_changed
        )
        self._stop_config_listener = config.on_config_parsed(
            self._on_source_file_changed, force_connect=True
        )
        self._storage = None
        self._maybe_reuse_previous_run = False
        self._run_on_save = config.get_option("server.runOnSave")

        # The ScriptRequestQueue is the means by which we communicate
        # with the active ScriptRunner.
        self._script_request_queue = ScriptRequestQueue()

        self._scriptrunner = None

        # This needs to be lazily imported to avoid a dependency cycle.
        from streamlit.state.session_state import SessionState

        self._session_state = SessionState()

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
            in_memory_file_manager.clear_session_files(self.id)
            in_memory_file_manager.del_expired_files()

            # Shut down the ScriptRunner, if one is active.
            # self._state must not be set to SHUTDOWN_REQUESTED until
            # after this is called.
            if self._scriptrunner is not None:
                self._enqueue_script_request(ScriptRequest.SHUTDOWN)

            self._state = ReportSessionState.SHUTDOWN_REQUESTED
            self._local_sources_watcher.close()
            self._stop_config_listener()
            secrets._file_change_listener.disconnect(self._on_secrets_file_changed)

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
        self._message_enqueued_callback()

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
        exception_utils.marshall(msg.delta.new_element.exception, e)

        self.enqueue(msg)

    def request_rerun(self, client_state):
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

    @property
    def session_state(self) -> "SessionState":
        return self._session_state

    def _on_source_file_changed(self):
        """One of our source files changed. Schedule a rerun if appropriate."""
        if self._run_on_save:
            self.request_rerun(self._client_state)
        else:
            self._enqueue_file_change_message()

    def _on_secrets_file_changed(self, _):
        """Called when `secrets._file_change_listener` emits a Signal."""

        # NOTE: At the time of writing, this function only calls `_on_source_file_changed`.
        # The reason behind creating this function instead of just passing `_on_source_file_changed`
        # to `connect` / `disconnect` directly is that every function that is passed to `connect` / `disconnect`
        # must have at least one argument for `sender` (in this case we don't really care about it, thus `_`),
        # and introducing an unnecessary argument to `_on_source_file_changed` just for this purpose sounded finicky.
        self._on_source_file_changed()

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
                in_memory_file_manager.clear_session_files(self.id)

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

    def _enqueue_new_report_message(self):
        self._report.generate_new_id()

        msg = ForwardMsg()

        msg.new_report.report_id = self._report.report_id
        msg.new_report.name = self._report.name
        msg.new_report.script_path = self._report.script_path

        _populate_config_msg(msg.new_report.config)
        _populate_theme_msg(msg.new_report.custom_theme)

        # Immutable session data. We send this every time a new report is
        # started, to avoid having to track whether the client has already
        # received it. It does not change from run to run; it's up to the
        # to perform one-time initialization only once.
        imsg = msg.new_report.initialize

        _populate_user_info_msg(imsg.user_info)

        imsg.environment_info.streamlit_version = __version__
        imsg.environment_info.python_version = ".".join(map(str, sys.version_info))

        imsg.session_state.run_on_save = self._run_on_save
        imsg.session_state.report_is_running = (
            self._state == ReportSessionState.REPORT_IS_RUNNING
        )

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

    def handle_git_information_request(self):
        msg = ForwardMsg()

        try:
            from streamlit.git_util import GitRepo

            repo = GitRepo(self._report.script_path)

            repo_info = repo.get_repo_info()
            if repo_info is None:
                return

            repository_name, branch, module = repo_info

            msg.git_info_changed.repository = repository_name
            msg.git_info_changed.branch = branch
            msg.git_info_changed.module = module

            msg.git_info_changed.untracked_files[:] = repo.untracked_files
            msg.git_info_changed.uncommitted_files[:] = repo.uncommitted_files

            if repo.is_head_detached:
                msg.git_info_changed.state = GitInfo.GitStates.HEAD_DETACHED
            elif len(repo.ahead_commits) > 0:
                msg.git_info_changed.state = GitInfo.GitStates.AHEAD_OF_REMOTE
            else:
                msg.git_info_changed.state = GitInfo.GitStates.DEFAULT

            self.enqueue(msg)
        except Exception as e:
            # Users may never even install Git in the first place, so this
            # error requires no action. It can be useful for debugging.
            LOGGER.debug("Obtaining Git information produced an error", exc_info=e)

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
        legacy_caching.clear_cache()
        caching.clear_memo_cache()
        caching.clear_singleton_cache()
        self._session_state.clear_state()

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
            session_state=self._session_state,
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
            yield ws.write_message(
                server_util.serialize_forward_msg(progress_msg), binary=True
            )

        # Indicate that the save is starting.
        try:
            yield progress(0)

            url = yield self._save_final_report(progress)

            # Indicate that the save is done.
            progress_msg = ForwardMsg()
            progress_msg.report_uploaded = url
            yield ws.write_message(
                server_util.serialize_forward_msg(progress_msg), binary=True
            )

        except Exception as e:
            # Horrible hack to show something if something breaks.
            err_msg = "%s: %s" % (type(e).__name__, str(e) or "No further details.")
            progress_msg = ForwardMsg()
            progress_msg.report_uploaded = err_msg
            yield ws.write_message(
                server_util.serialize_forward_msg(progress_msg), binary=True
            )

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


def _populate_config_msg(msg: Config) -> None:
    msg.sharing_enabled = config.get_option("global.sharingMode") != "off"
    msg.gather_usage_stats = config.get_option("browser.gatherUsageStats")
    msg.max_cached_message_age = config.get_option("global.maxCachedMessageAge")
    msg.mapbox_token = config.get_option("mapbox.token")
    msg.allow_run_on_save = config.get_option("server.allowRunOnSave")


def _populate_theme_msg(msg: CustomThemeConfig) -> None:
    enum_encoded_options = {"base", "font"}
    theme_opts = config.get_options_for_section("theme")

    if not any(theme_opts.values()):
        return

    for option_name, option_val in theme_opts.items():
        if option_name not in enum_encoded_options and option_val is not None:
            setattr(msg, to_snake_case(option_name), option_val)

    # NOTE: If unset, base and font will default to the protobuf enum zero
    # values, which are BaseTheme.LIGHT and FontFamily.SANS_SERIF,
    # respectively. This is why we both don't handle the cases explicitly and
    # also only log a warning when receiving invalid base/font options.
    base_map = {
        "light": msg.BaseTheme.LIGHT,
        "dark": msg.BaseTheme.DARK,
    }
    base = theme_opts["base"]
    if base is not None:
        if base not in base_map:
            LOGGER.warning(
                f'"{base}" is an invalid value for theme.base.'
                f" Allowed values include {list(base_map.keys())}."
                ' Setting theme.base to "light".'
            )
        else:
            msg.base = base_map[base]

    font_map = {
        "sans serif": msg.FontFamily.SANS_SERIF,
        "serif": msg.FontFamily.SERIF,
        "monospace": msg.FontFamily.MONOSPACE,
    }
    font = theme_opts["font"]
    if font is not None:
        if font not in font_map:
            LOGGER.warning(
                f'"{font}" is an invalid value for theme.font.'
                f" Allowed values include {list(font_map.keys())}."
                ' Setting theme.font to "sans serif".'
            )
        else:
            msg.font = font_map[font]


def _populate_user_info_msg(msg: UserInfo) -> None:
    msg.installation_id = Installation.instance().installation_id
    msg.installation_id_v3 = Installation.instance().installation_id_v3
    if Credentials.get_current().activation:
        msg.email = Credentials.get_current().activation.email
    else:
        msg.email = ""
