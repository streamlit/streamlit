# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

from enum import Enum

import tornado.gen
import tornado.ioloop

import streamlit.elements.exception_proto as exception_proto
from streamlit import __installation_id__
from streamlit import __version__
from streamlit import caching
from streamlit import config
from streamlit import protobuf
from streamlit import util
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.Report import Report
from streamlit.ScriptRunner import ScriptRunner
from streamlit.ScriptRunner import ScriptState
from streamlit.credentials import Credentials
from streamlit.logger import get_logger
from streamlit.storage.S3Storage import S3Storage as Storage
from streamlit.widgets import Widgets

LOGGER = get_logger(__name__)


class ReportContext(object):
    """
    Contains session data for a single "user" of an active report
    (that is, a connected browser tab).

    Each ReportContext has its own Report, root DeltaGenerator, ScriptRunner,
    and widget state.

    A ReportContext is attached to each thread involved in running its Report.
    """

    _next_id = 0

    def __init__(self, ioloop, script_path, script_argv, is_preheat):
        """Initialize the ReportContext.

        Parameters
        ----------
        ioloop : tornado.ioloop.IOLoop
            The Tornado IOLoop that we're running within

        script_path : str
            Path of the Python file from which this report is generated.

        script_argv : list of str
            Command-line arguments to run the script with.

        is_preheat: boolean
            True if this is a "preheat" context.

        """
        # Each ReportContext gets a unique ID
        self.id = ReportContext._next_id
        ReportContext._next_id += 1

        self._ioloop = ioloop
        self._report = Report(script_path, script_argv)

        self._root_dg = DeltaGenerator(self.enqueue)
        self._scriptrunner = ScriptRunner(self._report)
        self._sent_initialize_message = False
        self._is_shutdown = False
        self._storage = None

        # ScriptRunner event handlers
        self._scriptrunner.on_state_changed.connect(
            self._enqueue_script_state_changed_message)
        self._scriptrunner.on_file_change_not_handled.connect(
            self._enqueue_file_change_message)
        self._scriptrunner.on_script_compile_error.connect(
            self._on_script_compile_error)

        # Kick off the scriptrunner's run loop, but don't run the script
        # itself.
        self._scriptrunner.start_run_loop(self)

        self._preheat_state = None
        if is_preheat:
            self._preheat_state = PreheatState.MUST_PREHEAT
            self._scriptrunner.request_rerun()

        LOGGER.debug('ReportContext initialized (id=%s)', self.id)

    @property
    def root_dg(self):
        """
        Returns
        -------
        DeltaGenerator
            The report's root DeltaGenerator

        """
        return self._root_dg

    @property
    def widgets(self):
        """
        Returns
        -------
        Widgets
            Our ScriptRunner's widget state dictionary

        """
        return self._scriptrunner.widgets

    def flush_browser_queue(self):
        """Clears the report queue and returns the messages it contained.

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
        """Shuts down the ReportContext.

        It's an error to use a ReportContext after it's been shut down.

        """
        if not self._is_shutdown:
            LOGGER.debug('Shutting down (id=%s)', self.id)
            self._is_shutdown = True
            self._scriptrunner.request_shutdown()

    def enqueue(self, msg):
        """Enqueues a new ForwardMsg to our browser queue.

        Parameters
        ----------
        msg : ForwardMsg
            The message to enqueue

        Returns
        -------
        bool
            True if the message was enqueued, or False if
            client.displayEnabled is not set

        """
        if not config.get_option('client.displayEnabled'):
            return False
        self._scriptrunner.maybe_handle_execution_control_request()
        self._report.enqueue(msg)
        return True

    def enqueue_exception(self, e):
        """Enqueues an Exception message.

        Parameters
        ----------
        e : BaseException

        """
        # This does a few things:
        # 1) Clears the current report in the browser.
        # 2) Marks the current report as "stopped" in the browser.
        # 3) HACK: Resets any script params that may have been broken (e.g. the
        # command-line when rerunning with wrong argv[0])
        self._enqueue_script_state_changed_message(ScriptState.STOPPED)
        self._enqueue_script_state_changed_message(ScriptState.RUNNING)
        self._enqueue_script_state_changed_message(ScriptState.STOPPED)

        msg = protobuf.ForwardMsg()
        msg.delta.id = 0
        exception_proto.marshall(msg.delta.new_element.exception, e)

        self.enqueue(msg)

    def _clear_queue(self):
        self._report.clear()

    def _enqueue_script_state_changed_message(self, new_script_state):
        if new_script_state == ScriptState.RUNNING:
            if config.get_option('server.liveSave'):
                # Enqueue into the IOLoop so it runs without blocking AND runs
                # on the main thread.
                self._ioloop.spawn_callback(self._save_running_report)
            self._clear_queue()
            self._maybe_enqueue_initialize_message()
            self._enqueue_new_report_message()

        self._enqueue_session_state_changed_message()

        if new_script_state == ScriptState.STOPPED:
            self._enqueue_report_finished_message()
            if config.get_option('server.liveSave'):
                # Enqueue into the IOLoop so it runs without blocking AND runs
                # on the main thread.
                self._ioloop.spawn_callback(self._save_final_report_and_quit)

    def _enqueue_session_state_changed_message(self):
        msg = protobuf.ForwardMsg()
        msg.session_state_changed.run_on_save = self._scriptrunner.run_on_save
        msg.session_state_changed.report_is_running = \
            self._scriptrunner.is_running()
        self.enqueue(msg)

    def _enqueue_file_change_message(self, _):
        LOGGER.debug('Enqueuing report_changed message (id=%s)', self.id)
        msg = protobuf.ForwardMsg()
        msg.session_event.report_changed_on_disk = True
        self.enqueue(msg)

    def _on_script_compile_error(self, exc):
        """Handles exceptions caught by ScriptRunner during script compilation.

        We deliver these exceptions to the client via SessionEvent messages.
        "Normal" exceptions that are thrown during script execution show up as
        inline elements in the report, but compilation exceptions are handled
        specially, so that the frontend can leave the previous report up.
        """
        from streamlit.elements import exception_proto
        msg = protobuf.ForwardMsg()
        exception_proto.marshall(
            msg.session_event.script_compilation_exception, exc)
        self.enqueue(msg)

    def _maybe_enqueue_initialize_message(self):
        if self._sent_initialize_message:
            return

        self._sent_initialize_message = True

        msg = protobuf.ForwardMsg()
        imsg = msg.initialize

        imsg.sharing_enabled = (
            config.get_option('global.sharingMode') != 'off')
        LOGGER.debug(
            'New browser connection: sharing_enabled=%s',
            msg.initialize.sharing_enabled)

        imsg.gather_usage_stats = (
            config.get_option('browser.gatherUsageStats'))
        LOGGER.debug(
            'New browser connection: gather_usage_stats=%s',
            msg.initialize.gather_usage_stats)

        imsg.streamlit_version = __version__
        imsg.session_state.run_on_save = self._scriptrunner.run_on_save
        imsg.session_state.report_is_running = self._scriptrunner.is_running()

        imsg.user_info.installation_id = __installation_id__
        imsg.user_info.email = Credentials.get_current().activation.email

        self.enqueue(msg)

    def _enqueue_new_report_message(self):
        self._report.generate_new_id()
        msg = protobuf.ForwardMsg()
        msg.new_report.id = self._report.report_id
        msg.new_report.command_line.extend(self._report.argv)
        msg.new_report.name = self._report.name
        self.enqueue(msg)

    def _enqueue_report_finished_message(self):
        msg = protobuf.ForwardMsg()
        msg.report_finished = True
        self.enqueue(msg)

    def handle_rerun_script_request(self, command_line=None, widget_state=None):
        """Tells the ScriptRunner to re-run its report.

        Parameters
        ----------
        command_line : str | None
            The new command line arguments to run the script with, or None
            to use its previous command line value.
        widget_state : WidgetStates | None
            The WidgetStates protobuf to run the script with, or None
            to use its previous widget states.

        """
        old_argv = self._report.argv

        if command_line is not None:
            self._report.parse_argv_from_command_line(command_line)

        if self._preheat_state == PreheatState.MUST_PREHEAT:
            self._preheat_state = PreheatState.PREHEAT_VALID

        elif self._preheat_state == PreheatState.PREHEAT_VALID:
            has_widget_state = (
                widget_state is not None and len(widget_state.widgets) > 0)
            has_new_argv = old_argv != self._report.argv

            if not has_widget_state and not has_new_argv:
                LOGGER.debug(
                    'Skipping rerun since the preheated run is the same')
                return

            self._preheat_state = PreheatState.PREHEAT_EXPIRED

        self._scriptrunner.request_rerun(self._report.argv, widget_state)

    def handle_stop_script_request(self):
        """Tells the ScriptRunner to stop running its report."""
        self._preheat_state = None
        self._scriptrunner.request_stop()

    def handle_clear_cache_request(self):
        """Clears this report's cache.

        Because this cache is global, it will be cleared for all users.

        """
        # Setting verbose=True causes clear_cache to print to stdout.
        # Since this command was initiated from the browser, the user
        # doesn't need to see the results of the command in their
        # terminal.
        caching.clear_cache()

    def handle_set_run_on_save_request(self, new_value):
        """Changes ScriptRunner's run_on_save flag to the given value.

        The browser will be notified of the change.

        Parameters
        ----------
        new_value : bool
            New run_on_save value

        """
        self._scriptrunner.run_on_save = new_value
        self._enqueue_session_state_changed_message()

    @tornado.gen.coroutine
    def handle_save_request(self, ws):
        """Save serialized version of report deltas to the cloud."""
        @tornado.gen.coroutine
        def progress(percent):
            progress_msg = protobuf.ForwardMsg()
            progress_msg.upload_report_progress = percent
            yield ws.write_message(
                progress_msg.SerializeToString(), binary=True)

        # Indicate that the save is starting.
        try:
            yield progress(0)

            url = yield self._save_final_report(progress)

            # Indicate that the save is done.
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = url
            yield ws.write_message(
                progress_msg.SerializeToString(), binary=True)

        except Exception as e:
            # Horrible hack to show something if something breaks.
            err_msg = '%s: %s' % (
                type(e).__name__, str(e) or 'No further details.')
            progress_msg = protobuf.ForwardMsg()
            progress_msg.report_uploaded = err_msg
            yield ws.write_message(
                progress_msg.SerializeToString(), binary=True)
            raise e

    @tornado.gen.coroutine
    def _save_running_report(self):
        files = self._report.serialize_running_report_to_files()
        url = yield self._get_storage().save_report_files(
            self._report.report_id, files)

        if config.get_option('server.liveSave'):
            util.print_url('Saved running report', url)

        raise tornado.gen.Return(url)

    @tornado.gen.coroutine
    def _save_final_report(self, progress=None):
        files = self._report.serialize_final_report_to_files()
        url = yield self._get_storage().save_report_files(
            self._report.report_id, files, progress)

        if config.get_option('server.liveSave'):
            util.print_url('Saved final report', url)

        raise tornado.gen.Return(url)

    @tornado.gen.coroutine
    def _save_final_report_and_quit(self):
        yield self._save_final_report()
        self._ioloop.stop()

    def _get_storage(self):
        if self._storage is None:
            self._storage = Storage()
        return self._storage


class PreheatState(Enum):
    MUST_PREHEAT = 'MUST_PREHEAT'
    PREHEAT_VALID = 'PREHEAT_VALID'
    PREHEAT_EXPIRED = 'PREHEAT_EXPIRED'
