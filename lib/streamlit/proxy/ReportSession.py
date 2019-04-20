# Copyright 2019 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from blinker import Signal
from collections import namedtuple
from tornado.ioloop import IOLoop

from streamlit import process_runner

try:
    from streamlit.proxy.FileEventObserver import FileEventObserver as FileObserver
except ImportError:
    from streamlit.proxy.PollingFileObserver import PollingFileObserver as FileObserver

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)

ReportState = namedtuple('ReportState', ['run_on_save', 'report_is_running'])


class ReportSession(object):
    """Manages a single report session. Multiple browsers
    can be connected to the session. A ReportSession is created
    when a browser connects to a running report, persists across
    re-runs of the report, and lasts until there are no browsers
    connected any longer.
    """

    def __init__(self, initial_client_connection):
        """Creates a new ReportSession

        Parameters
        ----------
        initial_client_connection : ClientConnection
            The current ClientConnection for this ReportSession's report
        """
        self._client_connection = None
        self._report_name = initial_client_connection.name
        self._source_file_path = initial_client_connection.source_file_path
        self._command_line = initial_client_connection.command_line
        self._cwd = initial_client_connection.cwd
        self._browser_keys = set()
        self._file_observer = None
        self._state = ReportState(run_on_save=False, report_is_running=False)

        self.state_changed = Signal(
            doc="""Emitted when our state changes

            Parameters
            ----------
            state : ReportState
                the ReportSession's current ReportState
            """)

        self.on_report_changed = Signal(
            doc="""Emitted when our report's source_file is changed on disk,
            and self.run_on_save is False. When this happens, the browser
            alerts the user that the report has changed and prompts them to
            re-run it.
            """
        )

        self.on_report_was_manually_stopped = Signal(
            doc="""Emitted when our running report is manually stopped."""
        )

        self.set_client_connection(initial_client_connection)

    @property
    def state(self):
        """
        Returns
        -------
        ReportState
            The report's current ReportState
        """
        return self._state

    @property
    def client_connection(self):
        """
        Returns
        -------
        ClientConnection
            The report's current ClientConnection. Can be None.
        """
        return self._client_connection

    def set_client_connection(self, client_connection):
        """Sets the current ClientConnection for this ReportSession's report.
        The ReportSession registers a listener with its current ClientConnection
        to be notified when the ClientConnection's report has finished
        running.

        Parameters
        ----------
        client_connection : ClientConnection
            The new ClientConnection that the ReportSession should listen to.
        """
        if self._client_connection == client_connection:
            return

        assert (client_connection is None or client_connection.name == self._report_name), \
            'ClientConnection must refer to the same report as the ReportSession'

        # Stop listening to our previous client_connection...
        if self._client_connection:
            self._client_connection.on_closed.disconnect(
                self._update_report_is_running)

        # ...and start listening to our new one.
        self._client_connection = client_connection
        if self._client_connection:
            self._client_connection.on_closed.connect(
                self._update_report_is_running)

        self._update_report_is_running()

    def _update_report_is_running(self, _=None):
        """Updates state.report_is_running."""
        is_running = (
            self._client_connection and
            self._client_connection.is_connected)
        self._set_state(self._state._replace(report_is_running=is_running))

    def register_browser(self, browser_key):
        """Registers a browser as interested in the report."""
        self._browser_keys.add(browser_key)
        self._update_file_observer()

    def deregister_browser(self, browser_key):
        """Deregisters a browser from the wrapped FileObserver."""
        self._browser_keys.remove(browser_key)
        self._update_file_observer()

    def close(self):
        """Shuts down connections and releases resources. Must be called before
        the ReportSession goes out of scope."""
        self._browser_keys.clear()
        self._update_file_observer()
        if self._client_connection:
            self._client_connection.on_closed.disconnect(
                self._update_report_is_running)
            self._client_connection = None

    @property
    def has_registered_browsers(self):
        """True if this object has any registered browser keys"""
        return len(self._browser_keys) > 0

    def set_run_on_save(self, run_on_save):
        """Sets this session's run_on_save value. The wrapped FileObserver
        will be created or destroyed as appropriate.
        """
        self._set_state(self._state._replace(run_on_save=run_on_save))

    def stop_report(self):
        """If our report is running, stop it and emit the
        report_was_manually_stopped event
        """
        LOGGER.debug('TODO: stop_report')
        self.on_report_was_manually_stopped.send(self)

    def _set_state(self, new_state):
        """Sets the current ReportState. Emits a state changed event if
        the new ReportState is different.

        Parameters
        ----------
        new_state : ReportState
        """
        if self._state != new_state:
            self._state = new_state
            self.state_changed.send(self, state=self._state)

    def _update_file_observer(self):
        """Creates the file observer if it should exist; destroys
        it if it should not.
        """
        should_observe = \
            self._source_file_path is not None and \
            len(self._browser_keys) > 0

        if should_observe and self._file_observer is None:
            self._file_observer = self._create_file_observer()
        elif not should_observe and self._file_observer is not None:
            self._file_observer.close()
            self._file_observer = None

    def _on_source_file_changed(self, ioloop):
        """Called when the report's source file changes on disk.
        IMPORTANT: This method runs in a thread owned by the
        watchdog module (i.e. *not* in the Tornado IO loop).

        Parameters
        ----------
        ioloop : IOLoop
            The IOLoop that was current when the FileObserver was created.
        """
        LOGGER.debug('Source file "%s" changed. Run-on-save is %s.',
                     self._source_file_path, self._state.run_on_save)

        if self._state.run_on_save:
            process_runner.run_handling_errors_in_subprocess(
                self._command_line, cwd=self._cwd)
        else:
            # Fire our signal on the Tornado IO loop
            ioloop.add_callback(lambda: self.on_report_changed.send(self))

    def _create_file_observer(self):
        ioloop = IOLoop.current()
        return FileObserver(
            self._source_file_path,
            lambda: self._on_source_file_changed(ioloop))
