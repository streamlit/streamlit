import asyncio
from asyncio import AbstractEventLoop, Future
from enum import Enum
from typing import Optional, Dict, Protocol, NamedTuple

from streamlit.app_session import AppSession
from streamlit.caching import get_memo_stats_provider, get_singleton_stats_provider
from streamlit.forward_msg_cache import ForwardMsgCache
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.legacy_caching.caching import _mem_caches
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.state import SessionStateStatProvider
from streamlit.stats import StatsManager
from streamlit.uploaded_file_manager import UploadedFileManager


class SessionClient(Protocol):
    """Interface for sending data to a session's client."""

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Deliver a ForwardMsg to the client."""


class RuntimeConfig(NamedTuple):
    """Config options for StreamlitRuntime."""

    # The filesystem path of the Streamlit script to run.
    script_path: str

    # The (optional) command line that Streamlit was started with
    # (e.g. "streamlit run app.py")
    command_line: Optional[str] = None

    # This will grow to contain various injectable dependencies!


class SessionInfo:
    """Type stored in our _session_info_by_id dict.

    For each AppSession, the server tracks that session's
    script_run_count. This is used to track the age of messages in
    the ForwardMsgCache.
    """

    def __init__(self, client: SessionClient, session: AppSession):
        """Initialize a SessionInfo instance.

        Parameters
        ----------
        session : AppSession
            The AppSession object.
        client : SessionClient
            The concrete SessionClient for this session.
        """
        self.session = session
        self.client = client
        self.script_run_count = 0


class State(Enum):
    INITIAL = "INITIAL"
    WAITING_FOR_FIRST_SESSION = "WAITING_FOR_FIRST_SESSION"
    ONE_OR_MORE_SESSIONS_CONNECTED = "ONE_OR_MORE_SESSIONS_CONNECTED"
    NO_SESSIONS_CONNECTED = "NO_SESSIONS_CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


class StreamlitRuntime:
    def __init__(self, event_loop: AbstractEventLoop, config: RuntimeConfig):
        """Create a StreamlitRuntime. It won't be started yet.

        StreamlitRuntime is *not* thread-safe. Its public methods are only
        safe to call on the same thread that its event loop runs on.

        Parameters
        ----------
        event_loop
            The asyncio event loop to run on.
        config
            Config options.
        """
        self._event_loop = event_loop
        self._config = config

        # Mapping of AppSession.id -> SessionInfo.
        self._session_info_by_id: Dict[str, SessionInfo] = {}

        self._must_stop = asyncio.Event()
        self._state = State.INITIAL
        self._message_cache = ForwardMsgCache()
        self._uploaded_file_mgr = UploadedFileManager()
        self._uploaded_file_mgr.on_files_updated.connect(self._on_files_updated)
        self._has_connection = asyncio.Condition()
        self._need_send_data = asyncio.Event()

        # StatsManager
        self._stats_mgr = StatsManager()
        self._stats_mgr.register_provider(get_memo_stats_provider())
        self._stats_mgr.register_provider(get_singleton_stats_provider())
        self._stats_mgr.register_provider(_mem_caches)
        self._stats_mgr.register_provider(self._message_cache)
        self._stats_mgr.register_provider(in_memory_file_manager)
        self._stats_mgr.register_provider(self._uploaded_file_mgr)
        self._stats_mgr.register_provider(
            SessionStateStatProvider(self._session_info_by_id)
        )

    def _on_files_updated(self, session_id: str) -> None:
        """Event handler for UploadedFileManager.on_file_added.
        Ensures that uploaded files from stale sessions get deleted.
        """
        session_info = self._get_session_info(session_id)
        if session_info is None:
            # If an uploaded file doesn't belong to an existing session,
            # remove it so it doesn't stick around forever.
            self._uploaded_file_mgr.remove_session_files(session_id)

    def _get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Return the SessionInfo with the given id, or None if no such
        session exists.
        """
        return self._session_info_by_id.get(session_id, None)

    def start(self) -> None:
        """Start the runtime. This must be called only once, before
        any other functions are called.
        """

    def stop(self) -> None:
        """Request that Streamlit close all sessions and stop running.
        Note that Streamlit won't stop running immediately.
        TODO: how to know when it stops?
        """

    def create_session(
        self,
        client: SessionClient,
        user_info: Dict[str, Optional[str]],
    ) -> str:
        """Create a new session and return its unique ID.

        Parameters
        ----------
        client
            A concrete SessionClient implementation for communicating with
            the session's client.
        user_info
            A dict that contains information about the session's user. For now,
            it only (optionally) contains the user's email address.

            {
                "email": "example@example.com"
            }

        Returns
        -------
        The session's unique string ID.
        """

    def close_session(self, session_id: str) -> None:
        """Close a session. It will stop producing ForwardMsgs.

        Parameters
        ----------
        session_id
            The session's unique ID.
        """

    def handle_backmsg(self, session_id: str, msg: BackMsg) -> None:
        """Send a BackMsg to a connected session.

        Parameters
        ----------
        session_id
            The session's unique ID.
        msg
            The BackMsg to deliver to the session.
        """

    @property
    def started(self) -> Future:
        """Resolves when the runtime has started."""
