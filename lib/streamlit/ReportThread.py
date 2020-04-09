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

import threading

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


class ReportContext(object):
    def __init__(
        self, session_id, enqueue, widgets, widget_ids_this_run, uploaded_file_mgr,
    ):
        """Construct a ReportContext.

        Parameters
        ----------
        session_id : str
            The ReportSession's id.
        enqueue : callable
            Function that enqueues ForwardMsg protos in the websocket.
        widgets : Widgets
            The Widgets state object for the report.
        widget_ids_this_run : _WidgetIDSet
            The set of widget IDs that have been assigned in the
            current report run. This set is cleared at the start of each run.
        uploaded_file_mgr : UploadedFileManager
            The manager for files uploaded by all users.
        """
        # (dict) Mapping of container (type str or BlockPath) to top-level
        # cursor (type AbstractCursor).
        self.cursors = {}
        self.session_id = session_id
        self.enqueue = enqueue
        self.widgets = widgets
        self.widget_ids_this_run = widget_ids_this_run
        self.uploaded_file_mgr = uploaded_file_mgr

    def reset(self):
        self.cursors = {}
        self.widget_ids_this_run.clear()


class _WidgetIDSet(object):
    """Stores a set of widget IDs. Safe to mutate from multiple threads."""

    def __init__(self):
        self._lock = threading.Lock()
        self._items = set()

    def clear(self):
        """Clears all items in the set."""
        with self._lock:
            self._items.clear()

    def add(self, item):
        """Adds an item to the set.

        Parameters
        ----------
        item : Any
            The item to add.

        Returns
        -------
        bool
            True if the item was added, and False if it was already in
            the set.

        """
        with self._lock:
            if item in self._items:
                return False
            self._items.add(item)
            return True


REPORT_CONTEXT_ATTR_NAME = "streamlit_report_ctx"


class ReportThread(threading.Thread):
    """Extends threading.Thread with a ReportContext member"""

    def __init__(
        self,
        session_id,
        enqueue,
        widgets,
        uploaded_file_mgr=None,
        target=None,
        name=None,
    ):
        """Construct a ReportThread.

        Parameters
        ----------
        session_id : str
            The ReportSession's id.
        enqueue : callable
            Function that enqueues ForwardMsg protos in the websocket.
        widgets : Widgets
            The Widgets state object for the report.
        uploaded_file_mgr : UploadedFileManager
            The manager for files uploaded by all users.
        target : callable
            The callable object to be invoked by the run() method.
            Defaults to None, meaning nothing is called.
        name : str
            The thread name. By default, a unique name is constructed of
            the form "Thread-N" where N is a small decimal number.

        """
        super(ReportThread, self).__init__(target=target, name=name)
        self.streamlit_report_ctx = ReportContext(
            session_id=session_id,
            enqueue=enqueue,
            widgets=widgets,
            uploaded_file_mgr=uploaded_file_mgr,
            widget_ids_this_run=_WidgetIDSet(),
        )


def add_report_ctx(thread=None, ctx=None):
    """Adds the current ReportContext to a newly-created thread.

    This should be called from this thread's parent thread,
    before the new thread starts.

    Parameters
    ----------
    thread : threading.Thread
        The thread to attach the current ReportContext to.
    ctx : ReportContext or None
        The ReportContext to add, or None to use the current thread's
        ReportContext.

    Returns
    -------
    threading.Thread
        The same thread that was passed in, for chaining.

    """
    if thread is None:
        thread = threading.current_thread()
    if ctx is None:
        ctx = get_report_ctx()
    if ctx is not None:
        setattr(thread, REPORT_CONTEXT_ATTR_NAME, ctx)
    return thread


def get_report_ctx():
    """
    Returns
    -------
    ReportContext | None
        The current thread's ReportContext, or None if it doesn't have one.

    """
    thread = threading.current_thread()
    ctx = getattr(thread, REPORT_CONTEXT_ATTR_NAME, None)
    if ctx is None and streamlit._is_running_with_streamlit:
        # Only warn about a missing ReportContext if we were started
        # via `streamlit run`. Otherwise, the user is likely running a
        # script "bare", and doesn't need to be warned about streamlit
        # bits that are irrelevant when not connected to a report.
        LOGGER.warning("Thread '%s': missing ReportContext" % thread.name)
    return ctx


# Needed to avoid circular dependencies while running tests.
import streamlit
