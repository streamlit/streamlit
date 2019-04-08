# Copyright 2019 Streamlit Inc. All rights reserved.

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import

from streamlit import process_runner
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from blinker import Signal
from collections import namedtuple

try:
    from streamlit.proxy.FileEventObserver import FileEventObserver as FileObserver
except ImportError:
    from streamlit.proxy.PollingFileObserver import PollingFileObserver as FileObserver

ReportState = namedtuple('ReportState', ['run_on_save'])


class ReportSession(object):
    """Manages a single report session. Multiple browsers
    can be connected to the session. A ReportSession is created
    when a browser connects to a running report, persists across
    re-runs of the report, and lasts until there are no browsers
    connected any longer.
    """

    def __init__(self, report_name, source_file_path, command_line, cwd):
        """Creates a new ReportSession

        Parameters
        ----------
        report_name : str
            The name of the report

        source_file_path : str or None
            Absolute path of this report's source file. The
            ReportSession will optionally watch this file and
            re-run the report if the file changes. (This value
            can be None; for example, when the report is being
            run from the REPL.)

        command_line : str or sequence of str
            The command line this report was run with

        cwd : str or None
            The current working directory from which the report
            was launched
        """
        self._report_name = report_name
        self._source_file_path = source_file_path
        self._command_line = command_line
        self._cwd = cwd
        self._browser_keys = set()
        self._file_observer = None
        self._run_on_save = False

        self.state_changed = Signal(
            doc="""Emitted when our state changes

            Parameters
            ----------
            state : ReportState
                the ReportSession's current ReportState
            """)

    @property
    def state(self):
        """Returns the ReportSession's current state in a ReportState
        object"""
        return ReportState(run_on_save=self._run_on_save)

    def register_browser(self, browser_key):
        """Registers a browser as interested in the report."""
        self._browser_keys.add(browser_key)
        self._update_file_observer()

    def deregister_browser(self, browser_key):
        """Deregisters a browser from the wrapped FileObserver."""
        self._browser_keys.remove(browser_key)
        self._update_file_observer()

    def close(self):
        """Closes the wrapped FileObserver and clears all
        registered browsers."""
        self._browser_keys.clear()
        self._update_file_observer()

    @property
    def has_registered_browsers(self):
        """True if this object has any registered browser keys"""
        return len(self._browser_keys) > 0

    def set_run_on_save(self, run_on_save):
        """Sets this session's run_on_save value. The wrapped FileObserver
        will be created or destroyed as appropriate.
        """
        if self._run_on_save != run_on_save:
            self._run_on_save = run_on_save
            self._update_file_observer()
            self.state_changed.send(self, state=self.state)

    def _update_file_observer(self):
        """Creates the file observer if it should exist; destroys
        it if it should not.

        The observer should exist if self._enabled is True and we
        have at least one registered browser.
        """
        should_observe = \
            self._source_file_path is not None and \
            self._run_on_save and \
            len(self._browser_keys) > 0

        if should_observe and self._file_observer is None:
            self._file_observer = self._create_file_observer()
        elif not should_observe and self._file_observer is not None:
            self._file_observer.close()
            self._file_observer = None

    def _create_file_observer(self):
        def rerun_report():
            # IMPORTANT: This method runs in a thread owned by the
            # watchdog module (i.e. *not* in the Tornado IO loop).
            process_runner.run_handling_errors_in_subprocess(
                self._command_line, cwd=self._cwd)

        return FileObserver(self._source_file_path, rerun_report)
