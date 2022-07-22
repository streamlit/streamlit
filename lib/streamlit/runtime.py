import asyncio
import time
import traceback
from enum import Enum
from typing import Optional, Dict, Protocol, NamedTuple, Callable, Any, Tuple

from typing_extensions import Final

from streamlit import config
from streamlit.app_session import AppSession
from streamlit.caching import get_memo_stats_provider, get_singleton_stats_provider
from streamlit.forward_msg_cache import ForwardMsgCache
from streamlit.forward_msg_cache import (
    populate_hash_if_needed,
    create_reference_msg,
)
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.legacy_caching.caching import _mem_caches
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.session_data import SessionData
from streamlit.state import SessionStateStatProvider, SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.stats import StatsManager
from streamlit.uploaded_file_manager import UploadedFileManager
from streamlit.watcher import LocalSourcesWatcher
from streamlit.web.server.server_util import is_cacheable_msg

# Wait for the script run result for 60s and if no result is available give up
SCRIPT_RUN_CHECK_TIMEOUT: Final = 60

LOGGER: Final = get_logger(__name__)


class SessionClientDisconnectedError(Exception):
    """Raised by operations on a disconnected SessionClient."""


class SessionClient(Protocol):
    """Interface for sending data to a session's client."""

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Deliver a ForwardMsg to the client.

        If the SessionClient has been disconnected, it should raise a
        SessionClientDisconnectedError.
        """


class RuntimeConfig(NamedTuple):
    """Config options for StreamlitRuntime."""

    # The filesystem path of the Streamlit script to run.
    script_path: str

    # The (optional) command line that Streamlit was started with
    # (e.g. "streamlit run app.py")
    command_line: Optional[str]


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


class RuntimeState(Enum):
    INITIAL = "INITIAL"
    WAITING_FOR_FIRST_SESSION = "WAITING_FOR_FIRST_SESSION"
    ONE_OR_MORE_SESSIONS_CONNECTED = "ONE_OR_MORE_SESSIONS_CONNECTED"
    NO_SESSIONS_CONNECTED = "NO_SESSIONS_CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


class Runtime:
    def __init__(self, config: RuntimeConfig):
        """Create a StreamlitRuntime. It won't be started yet.

        StreamlitRuntime is *not* thread-safe. Its public methods are only
        safe to call on the same thread that its event loop runs on.

        Parameters
        ----------
        config
            Config options.
        """
        # Will be set when we start.
        self._eventloop: Optional[asyncio.AbstractEventLoop] = None

        self._script_path = config.script_path
        self._command_line = config.command_line

        # Mapping of AppSession.id -> SessionInfo.
        self._session_info_by_id: Dict[str, SessionInfo] = {}

        self._state = RuntimeState.INITIAL

        # asyncio eventloop synchronization primitives.
        # Note: these are not thread-safe!
        self._must_stop = asyncio.Event()
        self._has_connection = asyncio.Condition()
        self._need_send_data = asyncio.Event()

        # Initialize managers
        self._message_cache = ForwardMsgCache()
        self._uploaded_file_mgr = UploadedFileManager()

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

    @property
    def state(self) -> RuntimeState:
        return self._state

    @property
    def message_cache(self) -> ForwardMsgCache:
        return self._message_cache

    @property
    def uploaded_file_mgr(self) -> UploadedFileManager:
        return self._uploaded_file_mgr

    @property
    def stats_mgr(self) -> StatsManager:
        return self._stats_mgr

    def _on_files_updated(self, session_id: str) -> None:
        """Event handler for UploadedFileManager.on_file_added.
        Ensures that uploaded files from stale sessions get deleted.

        Threading
        ---------
        May be called on any thread.
        """
        session_info = self._get_session_info(session_id)
        if session_info is None:
            # If an uploaded file doesn't belong to an existing session,
            # remove it so it doesn't stick around forever.
            self._uploaded_file_mgr.remove_session_files(session_id)

    def _get_session_info(self, session_id: str) -> Optional[SessionInfo]:
        """Return the SessionInfo with the given id, or None if no such
        session exists.

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        return self._session_info_by_id.get(session_id, None)

    async def start(self, on_started: Optional[Callable[[], Any]] = None) -> None:
        """Start the runtime. This must be called only once, before
        any other functions are called.

        Parameters
        ----------
        on_started
            An optional callback that will be called when the runtime's loop
            has started. It will be called on the eventloop thread.

        Returns
        -------
        None

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        await self._loop_coroutine(on_started)

    def stop(self) -> None:
        """Request that Streamlit close all sessions and stop running.
        Note that Streamlit won't stop running immediately.

        Threading
        ---------
        May be called on any thread.
        """
        if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
            return

        LOGGER.debug("Runtime stopping...")
        self._set_state(RuntimeState.STOPPING)
        self._get_eventloop().call_soon_threadsafe(self._must_stop.set)

    def is_active_session(self, session_id: str) -> bool:
        """True if the session_id belongs to an active session.

        Threading
        ---------
        May be called on any thread.
        """
        # Dictionary membership is atomic in CPython, so this is thread-safe.
        return session_id in self._session_info_by_id

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
        str
            The session's unique string ID.

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
            raise RuntimeError(f"Can't create_session (state={self._state})")

        session_data = SessionData(self._script_path, self._command_line or "")

        session = AppSession(
            event_loop=self._get_eventloop(),
            session_data=session_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            message_enqueued_callback=self._enqueued_some_message,
            local_sources_watcher=LocalSourcesWatcher(session_data),
            user_info=user_info,
        )

        LOGGER.debug(
            "Created new session for client %s. Session ID: %s", id(client), session.id
        )

        assert (
            session.id not in self._session_info_by_id
        ), f"session.id '{session.id}' registered multiple times!"

        self._session_info_by_id[session.id] = SessionInfo(client, session)
        self._set_state(RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED)
        self._has_connection.notify_all()

        return session.id

    def close_session(self, session_id: str) -> None:
        """Close a session. It will stop producing ForwardMsgs.

        This function may be called multiple times for the same session,
        which is not an error. (Subsequent calls just no-op.)

        Parameters
        ----------
        session_id
            The session's unique ID.

        Returns
        -------
        None

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        if session_id in self._session_info_by_id:
            session_info = self._session_info_by_id[session_id]
            del self._session_info_by_id[session_id]
            session_info.session.shutdown()

        if (
            self._state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED
            and len(self._session_info_by_id) == 0
        ):
            self._set_state(RuntimeState.NO_SESSIONS_CONNECTED)

    def handle_backmsg(self, session_id: str, msg: BackMsg) -> None:
        """Send a BackMsg to a connected session.

        Parameters
        ----------
        session_id
            The session's unique ID.
        msg
            The BackMsg to deliver to the session.

        Returns
        -------
        None

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
            raise RuntimeError(f"Can't handle_backmsg (state={self._state})")

        session_info = self._session_info_by_id.get(session_id)
        if session_info is None:
            LOGGER.debug(
                "Discarding BackMsg for disconnected session (id=%s)", session_id
            )
            return

        session_info.session.handle_backmsg(msg)

    @property
    async def is_ready_for_browser_connection(self) -> Tuple[bool, str]:
        if self._state not in (
            RuntimeState.INITIAL,
            RuntimeState.STOPPING,
            RuntimeState.STOPPED,
        ):
            return True, "ok"

        return False, "unavailable"

    async def does_script_run_without_error(self) -> Tuple[bool, str]:
        """Load and execute the app's script to verify it runs without an error.

        Returns
        -------
        (True, "ok") if the script completes without error, or (False, err_msg)
        if the script raises an exception.
        """
        session_data = SessionData(self._script_path, self._command_line)
        local_sources_watcher = LocalSourcesWatcher(session_data)
        session = AppSession(
            event_loop=self._get_eventloop(),
            session_data=session_data,
            uploaded_file_manager=self._uploaded_file_mgr,
            message_enqueued_callback=self._enqueued_some_message,
            local_sources_watcher=local_sources_watcher,
            user_info={"email": "test@test.com"},
        )

        try:
            session.request_rerun(None)

            now = time.perf_counter()
            while (
                SCRIPT_RUN_WITHOUT_ERRORS_KEY not in session.session_state
                and (time.perf_counter() - now) < SCRIPT_RUN_CHECK_TIMEOUT
            ):
                await asyncio.sleep(0.1)

            if SCRIPT_RUN_WITHOUT_ERRORS_KEY not in session.session_state:
                return False, "timeout"

            ok = session.session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY]
            msg = "ok" if ok else "error"

            return ok, msg
        finally:
            session.shutdown()

    def _set_state(self, new_state: RuntimeState) -> None:
        LOGGER.debug("Runtime state: %s -> %s", self._state, new_state)
        self._state = new_state

    async def _loop_coroutine(
        self, on_started: Optional[Callable[[], Any]] = None
    ) -> None:
        """The main Runtime loop.

        Returns
        -------
        None

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        try:
            if self._state == RuntimeState.INITIAL:
                self._set_state(RuntimeState.WAITING_FOR_FIRST_SESSION)
            elif self._state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED:
                pass
            else:
                raise RuntimeError(f"Bad server state at start: {self._state}")

            # Store the eventloop we're running on so that we can schedule
            # callbacks on it when necessary. (We can't just call
            # `asyncio.get_running_loop()` whenever we like, because we have
            # some functions, e.g. `stop`, that can be called from other
            # threads, and `asyncio.get_running_loop()` is thread-specific.)
            self._eventloop = asyncio.get_running_loop()

            if on_started is not None:
                on_started()

            while not self._must_stop.is_set():
                if self._state == RuntimeState.WAITING_FOR_FIRST_SESSION:
                    await asyncio.wait(
                        [self._must_stop.wait(), self._has_connection.wait()],
                        return_when=asyncio.FIRST_COMPLETED,
                    )

                elif self._state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED:
                    self._need_send_data.clear()

                    # Shallow-clone our sessions into a list, so we can iterate
                    # over it and not worry about whether it's being changed
                    # outside this coroutine.
                    session_infos = list(self._session_info_by_id.values())

                    for session_info in session_infos:
                        msg_list = session_info.session.flush_browser_queue()
                        for msg in msg_list:
                            try:
                                self._send_message(session_info, msg)
                            except SessionClientDisconnectedError:
                                self.close_session(session_info.session.id)

                            # Yield for a tick after sending a message.
                            await asyncio.sleep(0)

                    # Yield for a few milliseconds between session message
                    # flushing.
                    await asyncio.sleep(0.01)

                elif self._state == RuntimeState.NO_SESSIONS_CONNECTED:
                    await asyncio.wait(
                        [self._must_stop.wait(), self._has_connection.wait()],
                        return_when=asyncio.FIRST_COMPLETED,
                    )

                else:
                    # Break out of the thread loop if we encounter any other state.
                    break

                await asyncio.wait(
                    [self._must_stop.wait(), self._need_send_data.wait()],
                    return_when=asyncio.FIRST_COMPLETED,
                )

            # Shut down all AppSessions
            for session_info in list(self._session_info_by_id.values()):
                session_info.session.shutdown()

            self._set_state(RuntimeState.STOPPED)

        except Exception:
            traceback.print_exc()
            LOGGER.info(
                """
Please report this bug at https://github.com/streamlit/streamlit/issues.
"""
            )

        finally:
            self._on_stopped()

    def _on_stopped(self) -> None:
        """Called when our runloop is exiting."""
        raise Exception("TODO")

    def _send_message(self, session_info: SessionInfo, msg: ForwardMsg) -> None:
        """Send a message to a client.

        If the client is likely to have already cached the message, we may
        instead send a "reference" message that contains only the hash of the
        message.

        Parameters
        ----------
        session_info : SessionInfo
            The SessionInfo associated with websocket
        msg : ForwardMsg
            The message to send to the client

        Returns
        -------
        None

        Threading
        ---------
        Must be called on the eventloop thread.
        """
        msg.metadata.cacheable = is_cacheable_msg(msg)
        msg_to_send = msg
        if msg.metadata.cacheable:
            populate_hash_if_needed(msg)

            if self._message_cache.has_message_reference(
                msg, session_info.session, session_info.script_run_count
            ):
                # This session has probably cached this message. Send
                # a reference instead.
                LOGGER.debug("Sending cached message ref (hash=%s)", msg.hash)
                msg_to_send = create_reference_msg(msg)

            # Cache the message so it can be referenced in the future.
            # If the message is already cached, this will reset its
            # age.
            LOGGER.debug("Caching message (hash=%s)", msg.hash)
            self._message_cache.add_message(
                msg, session_info.session, session_info.script_run_count
            )

        # If this was a `script_finished` message, we increment the
        # script_run_count for this session, and update the cache
        if (
            msg.WhichOneof("type") == "script_finished"
            and msg.script_finished == ForwardMsg.FINISHED_SUCCESSFULLY
        ):
            LOGGER.debug(
                "Script run finished successfully; "
                "removing expired entries from MessageCache "
                "(max_age=%s)",
                config.get_option("global.maxCachedMessageAge"),
            )
            session_info.script_run_count += 1
            self._message_cache.remove_expired_session_entries(
                session_info.session, session_info.script_run_count
            )

        # Ship it off!
        session_info.client.write_forward_msg(msg_to_send)

    def _enqueued_some_message(self) -> None:
        """Callback called by AppSession after the AppSession has enqueued a
        message. Sets the "needs_send_data" event, which causes our core
        loop to wake up and flush client message queues.

        Returns
        -------
        None

        Threading
        ---------
        May be called on any thread.
        """
        self._get_eventloop().call_soon_threadsafe(self._need_send_data.set)

    def _get_eventloop(self) -> asyncio.AbstractEventLoop:
        """Return the asyncio eventloop that the Server was started with.
        If the Server hasn't been started, this will raise an error.
        """
        if self._eventloop is None:
            raise RuntimeError("Server hasn't started yet!")
        return self._eventloop
