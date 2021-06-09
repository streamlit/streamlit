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

import threading
from typing import Dict, Optional, List, Callable

from streamlit import util
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.state.session_state import SessionState
from streamlit.uploaded_file_manager import UploadedFileManager

LOGGER = get_logger(__name__)


class ReportContext:
    """A context object that contains data for a "report run" - that is,
    data that's scoped to a single ScriptRunner execution (and therefore also
    scoped to a single connected "session").

    ReportContext is used internally by virtually every `st.foo()` function.
    It should be accessed only from the script thread that's created by
    ScriptRunner; it is not safe to use from other threads.

    Streamlit code typically retrieves the active ReportContext via the
    `get_report_ctx` function.
    """

    def __init__(
        self,
        session_id: str,
        enqueue: Callable[[ForwardMsg], None],
        query_string: str,
        session_state: SessionState,
        uploaded_file_mgr: UploadedFileManager,
    ):
        """Construct a ReportContext.

        Parameters
        ----------
        session_id : str
            The ReportSession's id.
        enqueue : callable
            Function that enqueues ForwardMsg protos in the websocket.
        query_string : str
            The URL query string for this run.
        widget_mgr : WidgetManager
            The WidgetManager for the report.
        uploaded_file_mgr : UploadedFileManager
            The manager for files uploaded by all users.

        """
        self.cursors: Dict[int, "streamlit.cursor.RunningCursor"] = {}
        self.session_id = session_id
        self._enqueue = enqueue
        self.query_string = query_string
        self.session_state = session_state
        # The ID of each widget that's been registered this run
        self.widget_ids_this_run = _StringSet()
        self.form_ids_this_run = _StringSet()
        self.uploaded_file_mgr = uploaded_file_mgr
        # set_page_config is allowed at most once, as the very first st.command
        self._set_page_config_allowed = True
        # Stack of DGs used for the with block. The current one is at the end.
        self.dg_stack: List["streamlit.delta_generator.DeltaGenerator"] = []

    def __repr__(self) -> str:
        return util.repr_(self)

    def reset(self, query_string: str = "") -> None:
        self.cursors = {}
        self.widget_ids_this_run = _StringSet()
        self.form_ids_this_run = _StringSet()
        self.query_string = query_string
        # Permit set_page_config when the ReportContext is reused on a rerun
        self._set_page_config_allowed = True

    def enqueue(self, msg: ForwardMsg) -> None:
        if msg.HasField("page_config_changed") and not self._set_page_config_allowed:
            raise StreamlitAPIException(
                "`set_page_config()` can only be called once per app, "
                + "and must be called as the first Streamlit command in your script.\n\n"
                + "For more information refer to the [docs]"
                + "(https://docs.streamlit.io/en/stable/api.html#streamlit.set_page_config)."
            )

        if msg.HasField("delta") or msg.HasField("page_config_changed"):
            self._set_page_config_allowed = False

        self._enqueue(msg)


class _StringSet:
    """A thread-safe set of strings."""

    def __init__(self):
        self._lock = threading.Lock()
        self._items = set()

    def __repr__(self) -> str:
        return util.repr_(self)

    def clear(self) -> None:
        """Clears all items in the set."""
        with self._lock:
            self._items.clear()

    def items(self):
        """Returns items as a new Python set.

        Returns
        -------
        Set[str]
            Python set containing items.
        """
        return set(self._items)

    def add(self, item: str) -> bool:
        """Adds an item to the set.

        Parameters
        ----------
        item : str
            The item to add.

        Returns
        -------
        bool
            True if the item was added, or False if it was already in the set.

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
        session_id: str,
        enqueue: Callable[[ForwardMsg], None],
        query_string: str,
        session_state: SessionState,
        uploaded_file_mgr: UploadedFileManager,
        target: Optional[Callable[[], None]] = None,
        name: Optional[str] = None,
    ):
        """Construct a ReportThread.

        Parameters
        ----------
        session_id : str
            The ReportSession's id.
        enqueue : callable
            Function that enqueues ForwardMsg protos in the websocket.
        query_string : str
            The URL query string for this run.
        widget_mgr : WidgetManager
            The WidgetManager object for the report.
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
            query_string=query_string,
            session_state=session_state,
            uploaded_file_mgr=uploaded_file_mgr,
        )

    def __repr__(self) -> str:
        return util.repr_(self)


def add_report_ctx(
    thread: Optional[threading.Thread] = None, ctx: Optional[ReportContext] = None
):
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


def get_report_ctx() -> Optional[ReportContext]:
    """
    Returns
    -------
    ReportContext | None
        The current thread's ReportContext, or None if it doesn't have one.

    """
    thread = threading.current_thread()
    ctx: Optional[ReportContext] = getattr(thread, REPORT_CONTEXT_ATTR_NAME, None)
    if ctx is None and streamlit._is_running_with_streamlit:
        # Only warn about a missing ReportContext if we were started
        # via `streamlit run`. Otherwise, the user is likely running a
        # script "bare", and doesn't need to be warned about streamlit
        # bits that are irrelevant when not connected to a report.
        LOGGER.warning("Thread '%s': missing ReportContext" % thread.name)

    return ctx


# Needed to avoid circular dependencies while running tests.
import streamlit
