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
from enum import Enum
from typing import NamedTuple, List, Any, Dict, Optional

import tornado
import tornado.ioloop

import streamlit
import streamlit.bootstrap as bootstrap
from streamlit import config
from streamlit.app_session import AppSession
from streamlit.logger import get_logger
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.server import Server

LOGGER = get_logger(__name__)


class SnowflakeConfig(NamedTuple):
    """Passed to `start()`. Contains config options."""

    script_path: str


class SnowflakeSessionMessageQueue:
    """A queue of ForwardMsgs for a single session.

    When Streamlit has a ForwardMsg for a session, it will push it
    to this queue.

    (This is just an interface - Snowflake should create a concrete
    implementation and pass it to Streamlit within SessionCtx.)
    """

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Add a new ForwardMsg to the queue.
        Note that this will be called on the Streamlit server thread,
        not the main thread!
        """
        raise NotImplementedError


class SnowflakeSessionCtx(NamedTuple):
    """Contains session-specific state. Create a new instance for
    each session.
    """

    queue: SnowflakeSessionMessageQueue


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
        self._ioloop: Optional[tornado.ioloop.IOLoop] = None
        self._server: Optional[Server] = None
        self._sessions: Dict[SnowflakeSessionCtx, AppSession] = {}

    def start(self) -> None:
        """Start the Streamlit server. Must be called once, before
        any other functions are called.
        """

        if self._state is not _SnowflakeDemoState.NOT_STARTED:
            LOGGER.warning("`start()` may not be called multiple times")
            return

        # Force ForwardMsg caching off (we need the cache endpoint to exist
        # for this to work)
        config.set_option("global.maxCachedMessageAge", -1)

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
        """Stop the Streamlit server."""
        if self._state is not _SnowflakeDemoState.RUNNING:
            LOGGER.warning("Can't stop (bad state: %s)", self._state)
            return

        def stop_handler() -> None:
            assert self._server is not None
            self._server.stop(from_signal=False)

        assert self._ioloop is not None
        self._ioloop.add_callback(stop_handler)
        self._state = _SnowflakeDemoState.STOPPED

    def _run_streamlit_thread(self, on_started: threading.Event) -> None:
        """The Streamlit thread entry point. This function won't exit
        until Streamlit is shut down.

        `on_started` will be set when the Server is up and running.
        """

        # This function is basically a copy-paste of bootstrap.run

        command_line = f"streamlit run {self._config.script_path}"
        args: List[Any] = []
        flag_options: Dict[str, Any] = {}
        main_script_path = self._config.script_path

        bootstrap._fix_sys_path(main_script_path)
        bootstrap._fix_matplotlib_crash()
        bootstrap._fix_tornado_crash()
        bootstrap._fix_sys_argv(main_script_path, args)
        bootstrap._fix_pydeck_mapbox_api_warning()
        bootstrap._install_config_watchers(flag_options)

        # Because we're running Streamlit from another thread, we don't
        # install our signal handlers. Streamlit must be stopped explicitly.
        # bootstrap._set_up_signal_handler()

        # Create our ioloop, and make it the ioloop for this thread.
        self._ioloop = tornado.ioloop.IOLoop(make_current=True)

        def on_server_started(server: Server) -> None:
            bootstrap._on_server_start(server)
            on_started.set()

        # Create and start the server.
        self._server = Server(self._ioloop, main_script_path, command_line)
        self._server.start(on_server_started)

        # Start the ioloop. This function will not return until the
        # server is shut down.
        self._ioloop.start()

        LOGGER.info("Streamlit thread exited normally")

    def session_created(self, ctx: SnowflakeSessionCtx) -> None:
        """Called when a new session starts. Streamlit will create
        its own session machinery internally.
        """
        if self._state is not _SnowflakeDemoState.RUNNING:
            LOGGER.warning("Can't register session (bad state: %s)", self._state)
            return

        LOGGER.info("Registering SnowflakeSessionCtx (%s)...", id(ctx))

        def session_created_handler() -> None:
            if ctx in self._sessions:
                LOGGER.warning(
                    "SnowflakeSessionCtx already registered! Not re-registering (%s)",
                    id(ctx),
                )
                return

            assert self._server is not None
            session = self._server.create_demo_app_session(ctx.queue.write_forward_msg)
            self._sessions[ctx] = session
            LOGGER.info("SnowflakeSessionCtx registered! (%s)", id(ctx))

        assert self._ioloop is not None
        self._ioloop.spawn_callback(session_created_handler)

    def handle_backmsg(self, ctx: SnowflakeSessionCtx, msg: BackMsg) -> None:
        """Called when a BackMsg arrives for a given session."""
        if self._state is not _SnowflakeDemoState.RUNNING:
            LOGGER.warning("Can't handle BackMsg (bad state: %s)", self._state)
            return

        def backmsg_handler() -> None:
            session = self._sessions.get(ctx, None)
            if session is None:
                LOGGER.warning(
                    "SnowflakeSessionCtx not registered! Ignoring BackMsg (%s)", id(ctx)
                )
                return

            self._sessions[ctx].handle_backmsg(msg)

        assert self._ioloop is not None
        self._ioloop.spawn_callback(backmsg_handler)

    def session_closed(self, ctx: SnowflakeSessionCtx) -> None:
        """Called when a session has closed.
        Streamlit will dispose of internal session-related resources here.
        """
        if self._state is not _SnowflakeDemoState.RUNNING:
            LOGGER.warning("Can't handle BackMsg (bad state: %s)", self._state)
            return

        def session_closed_handler() -> None:
            session = self._sessions.get(ctx, None)
            if session is None:
                LOGGER.warning(
                    "SnowflakeSessionCtx not registered! Ignoring session_closed request (%s)",
                    id(ctx),
                )
                return

            del self._sessions[ctx]
            assert self._server is not None
            self._server._close_app_session(session.id)

        assert self._ioloop is not None
        self._ioloop.spawn_callback(session_closed_handler)
