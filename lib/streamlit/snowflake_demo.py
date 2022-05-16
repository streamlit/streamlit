# Copyright 2018-2022 Streamlit Inc.
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

"""
Snowflake/Streamlit hacky demo interface.

(Please don't release this into production :))
"""

import threading
import uuid
from enum import Enum
from typing import NamedTuple, List, Any, Dict, Optional, Protocol

import tornado
import tornado.ioloop

from snowflake.snowpark import Session as SnowparkSession  # type: ignore

import streamlit
import streamlit.config
import streamlit.bootstrap as bootstrap
from streamlit.app_session import AppSession
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.server import Server

LOGGER = get_logger(__name__)


class SnowflakeConfig(NamedTuple):
    """Passed to `start()`. Contains config options."""

    # The path of the Streamlit script to run.
    script_path: str


class AsyncMessageContext(Protocol):
    """Each async message-related SnowflakeDemo function takes a
    concrete instance of this protocol.
    """

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Called to add a new ForwardMsg to the queue.

        This will be called on the Streamlit server thread,
        NOT the main thread.
        """

    def on_complete(self, err: Optional[BaseException] = None) -> None:
        """Called when the async message operation is complete.
        `err` is None on success, and holds an Exception describing
        the failure on failure.

        Note that this function does not signal that no more ForwardMsgs
        will be delivered! ForwardMsgs can continue to arrive on this context
        object until the next async operation is called.

        This may be called on the Streamlit server thread OR on the main
        thread.
        """


class _SnowflakeDemoState(Enum):
    NOT_STARTED = "NOT_STARTED"
    RUNNING = "RUNNING"
    STOPPED = "STOPPED"


class SnowflakeDemo:
    """The interface for Snowflake to create, and communicate with,
    a Streamlit server.
    """

    def __init__(self, config: SnowflakeConfig):
        self._state = _SnowflakeDemoState.NOT_STARTED
        self._config = config
        self._sessions: Dict[str, AppSession] = {}

        # Create, but don't start, our server and ioloop
        self._ioloop: Optional[tornado.ioloop.IOLoop] = None
        self._server: Optional[Server] = None

    def start(self) -> None:
        """Start the Streamlit server. Must be called once, before
        any other functions are called. Synchronous.
        """

        if self._state is not _SnowflakeDemoState.NOT_STARTED:
            LOGGER.warning("`start()` may not be called multiple times")
            return

        # Force ForwardMsg caching off (we need the cache endpoint to exist
        # for this to work)
        streamlit.config.set_option("global.maxCachedMessageAge", -1)

        # Set a global flag indicating that we're "within" streamlit.
        streamlit._is_running_with_streamlit = True

        # Create an event. The Streamlit thread will set this event
        # when the server is initialized, and we'll return from this function
        # once that happens.
        streamlit_ready_event = threading.Event()

        LOGGER.info("Starting Streamlit server...")

        # Start the Streamlit thread
        streamlit_thread = threading.Thread(
            target=lambda: self._run_streamlit_thread(streamlit_ready_event),
            name="StreamlitMain",
        )
        streamlit_thread.start()

        # Wait until Streamlit has been started before returning.
        streamlit_ready_event.wait()

        self._state = _SnowflakeDemoState.RUNNING
        LOGGER.info("Streamlit server started!")

    def stop(self) -> None:
        """Stop the Streamlit server. Synchronous."""
        if self._state is not _SnowflakeDemoState.RUNNING:
            LOGGER.warning("Can't stop (bad state: %s)", self._state)
            return

        def stop_handler() -> None:
            self._require_server().stop(from_signal=False)

        self._require_ioloop().add_callback(stop_handler)
        self._state = _SnowflakeDemoState.STOPPED

    def _run_streamlit_thread(self, on_started: threading.Event) -> None:
        """The Streamlit thread entry point. This function won't exit
        until Streamlit is shut down.

        `on_started` will be set when the Server is up and running.
        """

        self._ioloop = tornado.ioloop.IOLoop(make_current=True)
        self._server = Server(self._ioloop, self._main_script_path, self._command_line)

        # This function is basically a copy-paste of bootstrap.run

        args: List[Any] = []
        flag_options: Dict[str, Any] = {}

        bootstrap._fix_sys_path(self._main_script_path)
        bootstrap._fix_matplotlib_crash()
        bootstrap._fix_tornado_crash()
        bootstrap._fix_sys_argv(self._main_script_path, args)
        bootstrap._fix_pydeck_mapbox_api_warning()
        bootstrap._install_config_watchers(flag_options)

        # Because we're running Streamlit from another thread, we don't
        # install our signal handlers. Streamlit must be stopped explicitly.
        # bootstrap._set_up_signal_handler()

        def on_server_started(server: Server) -> None:
            bootstrap._on_server_start(server)
            on_started.set()

        # Start the server.
        self._ioloop.make_current()
        self._server.start(on_server_started)

        # Start the ioloop. This function will not return until the
        # server is shut down.
        self._ioloop.start()

        LOGGER.info("Streamlit thread exited normally")

    def create_session(
        self, ctx: AsyncMessageContext, snowpark_session: Optional[SnowparkSession]
    ) -> str:
        """Create a new Streamlit session. Asynchronous.

        Parameters
        ----------
        ctx: AsyncMessageContext
            Context object for this async operation.

        snowpark_session: snowflake.snowpark.Session
            The optional Snowpark session object associated
            with this Streamlit session.

        Returns
        -------
        str
            The session's unique ID.

        """

        if self._state is not _SnowflakeDemoState.RUNNING:
            ctx.on_complete(
                err=RuntimeError(f"Can't register session (bad state: {self._state})")
            )
            return "invalid_session_id"

        session_id = self._create_session_id()

        LOGGER.info("Registering Snowflake session (id=%s)...", session_id)

        def session_created_handler() -> None:
            try:
                session = self._require_server().create_demo_app_session(
                    ctx.write_forward_msg, snowpark_session
                )
                self._sessions[session_id] = session
                LOGGER.info("Snowflake session registered! (id=%s)", session_id)
            except BaseException as e:
                ctx.on_complete(err=e)
                return

            ctx.on_complete()

        self._require_ioloop().spawn_callback(session_created_handler)

        return session_id

    def handle_backmsg(
        self, session_id: str, msg: BackMsg, ctx: AsyncMessageContext
    ) -> None:
        """Called when a BackMsg arrives for a given session. Asynchronous.

        Parameters
        ----------
        session_id: str
            The session_id returned from `create_session`.

        msg: BackMsg
            The BackMsg to be processed.

        ctx: AsyncMessageContext:
            Context object for this async operation.
        """
        if self._state is not _SnowflakeDemoState.RUNNING:
            ctx.on_complete(
                err=RuntimeError(f"Can't handle BackMsg (bad state: {self._state})")
            )
            return

        def backmsg_handler() -> None:
            try:
                session = self._sessions.get(session_id, None)
                if session is None:
                    raise RuntimeError(
                        f"session_id not registered! Ignoring BackMsg (session_id={session_id})"
                    )

                self._require_server().set_demo_app_session_forward_msg_handler_terrible_hack(
                    session, ctx.write_forward_msg
                )
                session.handle_backmsg(msg)
            except BaseException as e:
                ctx.on_complete(err=e)
                return

            ctx.on_complete()

        self._require_ioloop().spawn_callback(backmsg_handler)

    def session_closed(self, session_id: str) -> None:
        """Called when a session has closed.
        Streamlit will dispose of internal session-related resources here.
        """
        if self._state is not _SnowflakeDemoState.RUNNING:
            raise RuntimeError(f"Can't handle BackMsg (bad state: {self._state})")

        def session_closed_handler() -> None:
            session = self._sessions.get(session_id, None)
            if session is None:
                LOGGER.warning(
                    "SnowflakeSessionCtx not registered! Ignoring session_closed request (%s)",
                    session_id,
                )
                return

            del self._sessions[session_id]
            self._require_server()._close_app_session(session.id)

        self._require_ioloop().spawn_callback(session_closed_handler)

    @property
    def _command_line(self):
        return f"streamlit run {self._config.script_path}"

    @property
    def _main_script_path(self):
        return self._config.script_path

    @staticmethod
    def _create_session_id() -> str:
        """Create a UUID for a session."""
        # This is a bit redundant. AppSessions already have a unique ID,
        # which would work as well. But we don't have access to AppSession
        # from the "create_session" thread, so we're creating this second
        # ID instead. TODO: come up with a better solution!
        return str(uuid.uuid4())

    def _require_server(self) -> Server:
        assert self._server is not None
        return self._server

    def _require_ioloop(self) -> tornado.ioloop.IOLoop:
        assert self._ioloop is not None
        return self._ioloop
