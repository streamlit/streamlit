import threading
from typing import Dict, Optional, List, Callable

from streamlit import util
from streamlit.script_run_context import ScriptRunContext
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.state.session_state import SessionState
from streamlit.uploaded_file_manager import UploadedFileManager

# Note [Threading]
# There are two kinds of threads in Streamlit, the main thread and script threads.
# The main thread is started by invoking the Streamlit CLI, and bootstraps the
# framework and runs the Tornado webserver.
# A script thread is created by a ScriptRunner when it starts. The script thread
# is where the ScriptRunner executes, including running the user script itself,
# processing messages to/from the frontend, and all the Streamlit library function
# calls in the user script.
# It is possible for the user script to spawn its own threads, which could call
# Streamlit functions. We restrict the ScriptRunner's execution control to the
# script thread. Calling Streamlit functions from other threads is unlikely to
# work correctly due to lack of ScriptRunContext, so we may add a guard against
# it in the future.
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
        session_state : SessionState
            The SessionState object for the session.
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
