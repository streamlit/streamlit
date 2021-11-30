import threading
from typing import Dict, Optional, List, Callable

from streamlit import util
from streamlit.script_run_context import ScriptRunContext
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.state.session_state import SessionState
from streamlit.uploaded_file_manager import UploadedFileManager


class ScriptThread(threading.Thread):
    """Extends threading.Thread with a ScriptRunContext member"""

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
        """Construct a ScriptThread.

        Parameters
        ----------
        session_id : str
            The AppSession's id.
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
        super(ScriptThread, self).__init__(target=target, name=name)
        self.streamlit_script_run_ctx = ScriptRunContext(
            session_id=session_id,
            enqueue=enqueue,
            query_string=query_string,
            session_state=session_state,
            uploaded_file_mgr=uploaded_file_mgr,
        )

    def __repr__(self) -> str:
        return util.repr_(self)
