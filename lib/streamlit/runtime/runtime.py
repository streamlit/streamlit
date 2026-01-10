# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import asyncio
import sys
import time
import traceback
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Final, NamedTuple

from streamlit.components.lib.local_component_registry import LocalComponentRegistry
from streamlit.components.v2.component_manager import BidiComponentManager
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.app_session import AppSession
from streamlit.runtime.caching import (
    get_data_cache_stats_provider,
    get_resource_cache_stats_provider,
)
from streamlit.runtime.caching.storage.local_disk_cache_storage import (
    LocalDiskCacheStorageManager,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_session_storage import MemorySessionStorage
from streamlit.runtime.script_data import ScriptData
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.runtime.session_manager import (
    ActiveSessionInfo,
    SessionClient,
    SessionClientDisconnectedError,
    SessionManager,
    SessionStorage,
)
from streamlit.runtime.state import (
    SCRIPT_RUN_WITHOUT_ERRORS_KEY,
    SessionStateStatProvider,
)
from streamlit.runtime.stats import (
    StatsManager,
    StatsProvider,
)
from streamlit.runtime.websocket_session_manager import WebsocketSessionManager

if TYPE_CHECKING:
    from collections.abc import Awaitable

    from streamlit.components.types.base_component_registry import BaseComponentRegistry
    from streamlit.proto.BackMsg_pb2 import BackMsg
    from streamlit.runtime.caching.storage import CacheStorageManager
    from streamlit.runtime.media_file_storage import MediaFileStorage
    from streamlit.runtime.scriptrunner_utils.script_run_context import UserInfoType
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager

# Wait for the script run result for 60s and if no result is available give up
SCRIPT_RUN_CHECK_TIMEOUT: Final = 60

# On Windows, periodically check for signals when blocked in asyncio.wait()
# This ensures Ctrl+C can be processed even when no sessions are connected
_SIGNAL_CHECK_INTERVAL: Final = 0.5 if sys.platform == "win32" else None

_LOGGER: Final = get_logger(__name__)


class RuntimeStoppedError(Exception):
    """Raised by operations on a Runtime instance that is stopped."""


@dataclass(frozen=True)
class RuntimeConfig:
    """Config options for StreamlitRuntime."""

    # The filesystem path of the Streamlit script to run.
    script_path: str

    # DEPRECATED: We need to keep this field around for compatibility reasons, but we no
    # longer use this anywhere.
    command_line: str | None

    # The storage backend for Streamlit's MediaFileManager.
    media_file_storage: MediaFileStorage

    # The upload file manager
    uploaded_file_manager: UploadedFileManager

    # The cache storage backend for Streamlit's st.cache_data.
    cache_storage_manager: CacheStorageManager = field(
        default_factory=LocalDiskCacheStorageManager
    )

    # The ComponentRegistry instance to use.
    component_registry: BaseComponentRegistry = field(
        default_factory=LocalComponentRegistry
    )

    # The BidiComponentManager instance to use for v2 components.
    bidi_component_registry: BidiComponentManager = field(
        default_factory=BidiComponentManager
    )

    # The SessionManager class to be used.
    session_manager_class: type[SessionManager] = WebsocketSessionManager

    # The SessionStorage instance for the SessionManager to use.
    session_storage: SessionStorage = field(default_factory=MemorySessionStorage)

    # True if the command used to start Streamlit was `streamlit hello`.
    is_hello: bool = False

    # TODO(vdonato): Eventually add a new fragment_storage_class field enabling the code
    # creating a new Streamlit Runtime to configure the FragmentStorage instances
    # created by each new AppSession. We choose not to do this for now to avoid adding
    # additional complexity to RuntimeConfig/SessionManager/etc when it's unlikely
    # we'll have a custom implementation of this class anytime soon.


class RuntimeState(Enum):
    INITIAL = "INITIAL"
    NO_SESSIONS_CONNECTED = "NO_SESSIONS_CONNECTED"
    ONE_OR_MORE_SESSIONS_CONNECTED = "ONE_OR_MORE_SESSIONS_CONNECTED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


class AsyncObjects(NamedTuple):
    """Container for all asyncio objects that Runtime manages.
    These cannot be initialized until the Runtime's eventloop is assigned.
    """

    # The eventloop that Runtime is running on.
    eventloop: asyncio.AbstractEventLoop

    # Set after Runtime.stop() is called. Never cleared.
    must_stop: asyncio.Event

    # Set when a client connects; cleared when we have no connected clients.
    has_connection: asyncio.Event

    # Set after a ForwardMsg is enqueued; cleared when we flush ForwardMsgs.
    need_send_data: asyncio.Event

    # Completed when the Runtime has started.
    started: asyncio.Future[None]

    # Completed when the Runtime has stopped.
    stopped: asyncio.Future[None]


class Runtime:
    _instance: Runtime | None = None

    @classmethod
    def instance(cls) -> Runtime:
        """Return the singleton Runtime instance. Raise an Error if the
        Runtime hasn't been created yet.
        """
        if cls._instance is None:
            raise RuntimeError("Runtime hasn't been created!")
        return cls._instance

    @classmethod
    def exists(cls) -> bool:
        """True if the singleton Runtime instance has been created.

        When a Streamlit app is running in "raw mode" - that is, when the
        app is run via `python app.py` instead of `streamlit run app.py` -
        the Runtime will not exist, and various Streamlit functions need
        to adapt.
        """
        return cls._instance is not None

    def __init__(self, config: RuntimeConfig) -> None:
        """Create a Runtime instance. It won't be started yet.

        Runtime is *not* thread-safe. Its public methods are generally
        safe to call only on the same thread that its event loop runs on.

        Parameters
        ----------
        config
            Config options.
        """
        if Runtime._instance is not None:
            raise RuntimeError("Runtime instance already exists!")
        Runtime._instance = self

        # Will be created when we start.
        self._async_objs: AsyncObjects | None = None

        # The task that runs our main loop. We need to save a reference
        # to it so that it doesn't get garbage collected while running.
        self._loop_coroutine_task: asyncio.Task[None] | None = None

        self._main_script_path = config.script_path
        self._is_hello = config.is_hello

        self._state = RuntimeState.INITIAL

        # Initialize managers
        self._component_registry = config.component_registry
        self._bidi_component_registry = config.bidi_component_registry
        self._uploaded_file_mgr = config.uploaded_file_manager
        self._media_file_mgr = MediaFileManager(storage=config.media_file_storage)
        self._cache_storage_manager = config.cache_storage_manager
        self._script_cache = ScriptCache()

        # Discover and register components for CCv2 from installed packages
        self._bidi_component_registry.discover_and_register_components()

        self._session_mgr = config.session_manager_class(
            session_storage=config.session_storage,
            uploaded_file_manager=self._uploaded_file_mgr,
            script_cache=self._script_cache,
            message_enqueued_callback=self._enqueued_some_message,
        )

        self._stats_mgr = StatsManager()
        self._stats_mgr.register_provider(get_data_cache_stats_provider())
        self._stats_mgr.register_provider(get_resource_cache_stats_provider())
        if self._uploaded_file_mgr is not None:
            self._stats_mgr.register_provider(self._uploaded_file_mgr)
        # Register media file storage for stats if it implements StatsProvider
        if isinstance(config.media_file_storage, StatsProvider):
            self._stats_mgr.register_provider(config.media_file_storage)
        self._stats_mgr.register_provider(SessionStateStatProvider(self._session_mgr))

        # Register session manager for session event metrics if it implements StatsProvider
        if isinstance(self._session_mgr, StatsProvider):
            self._stats_mgr.register_provider(self._session_mgr)

    @property
    def state(self) -> RuntimeState:
        return self._state

    @property
    def component_registry(self) -> BaseComponentRegistry:
        return self._component_registry

    @property
    def bidi_component_registry(self) -> BidiComponentManager:
        return self._bidi_component_registry

    @property
    def uploaded_file_mgr(self) -> UploadedFileManager:
        return self._uploaded_file_mgr

    @property
    def cache_storage_manager(self) -> CacheStorageManager:
        return self._cache_storage_manager

    @property
    def media_file_mgr(self) -> MediaFileManager:
        return self._media_file_mgr

    @property
    def stats_mgr(self) -> StatsManager:
        return self._stats_mgr

    @property
    def stopped(self) -> Awaitable[None]:
        """A Future that completes when the Runtime's run loop has exited."""
        return self._get_async_objs().stopped

    # NOTE: A few Runtime methods listed as threadsafe (get_client and
    # is_active_session) currently rely on the implementation detail that
    # WebsocketSessionManager's get_active_session_info and is_active_session methods
    # happen to be threadsafe. This may change with future SessionManager implementations,
    # at which point we'll need to formalize our thread safety rules for each
    # SessionManager method.
    def get_client(self, session_id: str) -> SessionClient | None:
        """Get the SessionClient for the given session_id, or None
        if no such session exists.

        Notes
        -----
        Threading: SAFE. May be called on any thread.
        """
        session_info = self._session_mgr.get_active_session_info(session_id)
        if session_info is None:
            return None
        return session_info.client

    def clear_user_info_for_session(self, session_id: str) -> None:
        """Clear the user_info for the given session_id.

        Notes
        -----
        Threading: SAFE. May be called on any thread.
        """
        session_info = self._session_mgr.get_session_info(session_id)
        if session_info is not None:
            session_info.session.clear_user_info()

    async def start(self) -> None:
        """Start the runtime. This must be called only once, before
        any other functions are called.

        When this coroutine returns, Streamlit is ready to accept new sessions.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """

        # Create our AsyncObjects. We need to have a running eventloop to
        # instantiate our various synchronization primitives.
        async_objs = AsyncObjects(
            eventloop=asyncio.get_running_loop(),
            must_stop=asyncio.Event(),
            has_connection=asyncio.Event(),
            need_send_data=asyncio.Event(),
            started=asyncio.Future(),
            stopped=asyncio.Future(),
        )
        self._async_objs = async_objs

        self._loop_coroutine_task = asyncio.create_task(
            self._loop_coroutine(), name="Runtime.loop_coroutine"
        )

        await async_objs.started

    def stop(self) -> None:
        """Request that Streamlit close all sessions and stop running.
        Note that Streamlit won't stop running immediately.

        Notes
        -----
        Threading: SAFE. May be called from any thread.
        """

        async_objs = self._get_async_objs()

        def stop_on_eventloop() -> None:
            if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
                return

            _LOGGER.debug("Runtime stopping...")
            self._set_state(RuntimeState.STOPPING)
            async_objs.must_stop.set()

        async_objs.eventloop.call_soon_threadsafe(stop_on_eventloop)

    def is_active_session(self, session_id: str) -> bool:
        """True if the session_id belongs to an active session.

        Notes
        -----
        Threading: SAFE. May be called on any thread.
        """
        return self._session_mgr.is_active_session(session_id)

    def connect_session(
        self,
        client: SessionClient,
        user_info: UserInfoType,
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        """Create a new session (or connect to an existing one) and return its unique ID.

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
        existing_session_id
            The ID of an existing session to reconnect to. If one is not provided, a new
            session is created. Note that whether the Runtime's SessionManager supports
            reconnecting to an existing session depends on the SessionManager that this
            runtime is configured with.
        session_id_override
            The ID to assign to a new session being created with this method. Setting
            this can be useful when the service that a Streamlit Runtime is running in
            wants to tie the lifecycle of a Streamlit session to some other session-like
            object that it manages. Only one of existing_session_id and
            session_id_override should be set.

        Returns
        -------
        str
            The session's unique string ID.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """
        if existing_session_id and session_id_override:
            raise RuntimeError(
                "Only one of existing_session_id and session_id_override should be set. "
                "This should never happen."
            )

        if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
            raise RuntimeStoppedError(f"Can't connect_session (state={self._state})")

        session_id = self._session_mgr.connect_session(
            client=client,
            script_data=ScriptData(self._main_script_path, self._is_hello),
            user_info=user_info,
            existing_session_id=existing_session_id,
            session_id_override=session_id_override,
        )
        self._set_state(RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED)
        self._get_async_objs().has_connection.set()

        return session_id

    def create_session(
        self,
        client: SessionClient,
        user_info: UserInfoType,
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        """Create a new session (or connect to an existing one) and return its unique ID.

        Notes
        -----
        This method is simply an alias for connect_session added for backwards
        compatibility.
        """
        _LOGGER.warning("create_session is deprecated! Use connect_session instead.")
        return self.connect_session(
            client=client,
            user_info=user_info,
            existing_session_id=existing_session_id,
            session_id_override=session_id_override,
        )

    def close_session(self, session_id: str) -> None:
        """Close and completely shut down a session.

        This differs from disconnect_session in that it always completely shuts down a
        session, permanently losing any associated state (session state, uploaded files,
        etc.).

        This function may be called multiple times for the same session,
        which is not an error. (Subsequent calls just no-op.)

        Parameters
        ----------
        session_id
            The session's unique ID.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """
        session_info = self._session_mgr.get_session_info(session_id)
        if session_info:
            self._session_mgr.close_session(session_id)
        self._on_session_disconnected()

    def disconnect_session(self, session_id: str) -> None:
        """Disconnect a session. It will stop producing ForwardMsgs.

        Differs from close_session because disconnected sessions can be reconnected to
        for a brief window (depending on the SessionManager/SessionStorage
        implementations used by the runtime).

        This function may be called multiple times for the same session,
        which is not an error. (Subsequent calls just no-op.)

        Parameters
        ----------
        session_id
            The session's unique ID.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """
        session_info = self._session_mgr.get_active_session_info(session_id)
        if session_info:
            self._session_mgr.disconnect_session(session_id)
        self._on_session_disconnected()

    def handle_backmsg(self, session_id: str, msg: BackMsg) -> None:
        """Send a BackMsg to an active session.

        Parameters
        ----------
        session_id
            The session's unique ID.
        msg
            The BackMsg to deliver to the session.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """
        if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
            raise RuntimeStoppedError(f"Can't handle_backmsg (state={self._state})")

        session_info = self._session_mgr.get_active_session_info(session_id)
        if session_info is None:
            _LOGGER.debug(
                "Discarding BackMsg for disconnected session (id=%s)", session_id
            )
            return

        session_info.session.handle_backmsg(msg)

    def handle_backmsg_deserialization_exception(
        self, session_id: str, exc: BaseException
    ) -> None:
        """Handle an Exception raised during deserialization of a BackMsg.

        Parameters
        ----------
        session_id
            The session's unique ID.
        exc
            The Exception.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """
        if self._state in (RuntimeState.STOPPING, RuntimeState.STOPPED):
            raise RuntimeStoppedError(
                f"Can't handle_backmsg_deserialization_exception (state={self._state})"
            )

        session_info = self._session_mgr.get_active_session_info(session_id)
        if session_info is None:
            _LOGGER.debug(
                "Discarding BackMsg Exception for disconnected session (id=%s)",
                session_id,
            )
            return

        session_info.session.handle_backmsg_exception(exc)

    @property
    async def is_ready_for_browser_connection(self) -> tuple[bool, str]:
        if self._state not in (
            RuntimeState.INITIAL,
            RuntimeState.STOPPING,
            RuntimeState.STOPPED,
        ):
            return True, "ok"

        return False, "unavailable"

    async def does_script_run_without_error(self) -> tuple[bool, str]:
        """Load and execute the app's script to verify it runs without an error.

        Returns
        -------
        (True, "ok") if the script completes without error, or (False, err_msg)
        if the script raises an exception.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """
        # NOTE: We create an AppSession directly here instead of using the
        # SessionManager intentionally. This isn't a "real" session and is only being
        # used to test that the script runs without error.
        session = AppSession(
            script_data=ScriptData(self._main_script_path, self._is_hello),
            uploaded_file_manager=self._uploaded_file_mgr,
            script_cache=self._script_cache,
            message_enqueued_callback=self._enqueued_some_message,
            user_info={"email": "test@example.com"},
        )

        try:
            session.request_rerun(None)

            now = time.perf_counter()
            while (  # noqa: ASYNC110
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
        _LOGGER.debug("Runtime state: %s -> %s", self._state, new_state)
        self._state = new_state

    async def _loop_coroutine(self) -> None:
        """The main Runtime loop.

        This function won't exit until `stop` is called.

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """

        async_objs = self._get_async_objs()

        try:
            if self._state == RuntimeState.INITIAL:
                self._set_state(RuntimeState.NO_SESSIONS_CONNECTED)
            elif self._state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED:
                pass
            else:
                raise RuntimeError(f"Bad Runtime state at start: {self._state}")  # noqa: TRY301

            # Signal that we're started and ready to accept sessions
            async_objs.started.set_result(None)

            while not async_objs.must_stop.is_set():
                if self._state == RuntimeState.NO_SESSIONS_CONNECTED:  # type: ignore[comparison-overlap]
                    # mypy 1.4 incorrectly thinks this if-clause is unreachable,
                    # because it thinks self._state must be INITIAL | ONE_OR_MORE_SESSIONS_CONNECTED.

                    # Wait for new websocket connections (new sessions):
                    done_tasks, pending_tasks = await asyncio.wait(  # type: ignore[unreachable]
                        (
                            asyncio.create_task(async_objs.must_stop.wait()),
                            asyncio.create_task(async_objs.has_connection.wait()),
                        ),
                        return_when=asyncio.FIRST_COMPLETED,
                        # On Windows, use a timeout to ensure signal handlers can be processed
                        timeout=_SIGNAL_CHECK_INTERVAL,
                    )
                    # Clean up pending tasks to avoid memory leaks
                    for task in pending_tasks:
                        task.cancel()

                    # If we timed out (Windows only), continue the loop to check must_stop
                    if not done_tasks and _SIGNAL_CHECK_INTERVAL is not None:
                        continue
                elif self._state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED:
                    async_objs.need_send_data.clear()

                    for active_session_info in self._session_mgr.list_active_sessions():
                        msg_list = active_session_info.session.flush_browser_queue()
                        for msg in msg_list:
                            try:
                                self._send_message(active_session_info, msg)
                            except SessionClientDisconnectedError:
                                self._session_mgr.disconnect_session(
                                    active_session_info.session.id
                                )

                            # Yield for a tick after sending a message.
                            await asyncio.sleep(0)

                    # Yield for a few milliseconds between session message
                    # flushing.
                    await asyncio.sleep(0.01)
                else:
                    # Break out of the thread loop if we encounter any other state.
                    break

                # Wait for new proto messages that need to be sent out:
                done_tasks, pending_tasks = await asyncio.wait(
                    (
                        asyncio.create_task(async_objs.must_stop.wait()),
                        asyncio.create_task(async_objs.need_send_data.wait()),
                    ),
                    return_when=asyncio.FIRST_COMPLETED,
                    # On Windows, use a timeout to ensure signal handlers can be processed
                    timeout=_SIGNAL_CHECK_INTERVAL,
                )
                # We need to cancel the pending tasks (the `must_stop` one in most situations).
                # Otherwise, this would stack up one waiting task per loop
                # (e.g. per forward message). These tasks cannot be garbage collected
                # causing an increase in memory (-> memory leak).
                for task in pending_tasks:
                    task.cancel()

                # If we timed out (Windows only), continue to check must_stop
                if not done_tasks and _SIGNAL_CHECK_INTERVAL is not None:
                    continue

            # Shut down all AppSessions.
            for session_info in self._session_mgr.list_sessions():
                # NOTE: We want to fully shut down sessions when the runtime stops for
                # now, but this may change in the future if/when our notion of a session
                # is no longer so tightly coupled to a browser tab.
                self._session_mgr.close_session(session_info.session.id)

            self._set_state(RuntimeState.STOPPED)
            async_objs.stopped.set_result(None)

        except Exception as e:
            async_objs.stopped.set_exception(e)
            traceback.print_exc()
            _LOGGER.info(
                """
Please report this bug at https://github.com/streamlit/streamlit/issues.
"""
            )

    def _send_message(self, session_info: ActiveSessionInfo, msg: ForwardMsg) -> None:
        """Send a message to a client.
        If the client is likely to have already cached the message, we may
        instead send a "reference" message that contains only the hash of the
        message.

        Parameters
        ----------
        session_info : ActiveSessionInfo
            The ActiveSessionInfo associated with websocket
        msg : ForwardMsg
            The message to send to the client

        Notes
        -----
        Threading: UNSAFE. Must be called on the eventloop thread.
        """

        # If this was a `script_finished` message, we increment the
        # script_run_count for this session
        if msg.WhichOneof("type") == "script_finished" and (
            msg.script_finished == ForwardMsg.FINISHED_SUCCESSFULLY
        ):
            session_info.script_run_count += 1

        # Ship it off!
        session_info.client.write_forward_msg(msg)

    def _enqueued_some_message(self) -> None:
        """Callback called by AppSession after the AppSession has enqueued a
        message. Sets the "needs_send_data" event, which causes our core
        loop to wake up and flush client message queues.

        Notes
        -----
        Threading: SAFE. May be called on any thread.
        """
        async_objs = self._get_async_objs()
        async_objs.eventloop.call_soon_threadsafe(async_objs.need_send_data.set)

    def _get_async_objs(self) -> AsyncObjects:
        """Return our AsyncObjects instance. If the Runtime hasn't been
        started, this will raise an error.
        """
        if self._async_objs is None:
            raise RuntimeError("Runtime hasn't started yet!")
        return self._async_objs

    def _on_session_disconnected(self) -> None:
        """Set the runtime state to NO_SESSIONS_CONNECTED if the last active
        session was disconnected.
        """
        if (
            self._state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED
            and self._session_mgr.num_active_sessions() == 0
        ):
            self._get_async_objs().has_connection.clear()
            self._set_state(RuntimeState.NO_SESSIONS_CONNECTED)
