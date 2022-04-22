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
from typing import NamedTuple, List, Any, Dict, Optional

import tornado
import tornado.ioloop

import streamlit
import streamlit.bootstrap as bootstrap
from streamlit.app_session import AppSession
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.server.server import Server


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


class SnowflakeDemo:
    """The interface for Snowflake to create, and communicate with,
    a Streamlit server.

    Basic usage:
    ```
    config = SnowflakeConfig()    # populate a config
    demo = SnowflakeDemo(config)  # create a demo instance

    # Start the demo server. (This will spin up a new thread.)
    demo.start()

    # Add a session
    ...
    ```
    """

    def __init__(self, config: SnowflakeConfig):
        self._started = False
        self._config = config
        self._ioloop: Optional[tornado.ioloop.IOLoop] = None
        self._server: Optional[Server] = None
        self._sessions: Dict[SnowflakeSessionCtx, AppSession] = {}

    def start(self) -> None:
        """Start the Streamlit server. Must be called once, before
        any other functions are called.
        """

        assert not self._started, "Start may not be called multiple times"
        self._started = True

        # Set a global flag indicating that we're "within" streamlit.
        streamlit._is_running_with_streamlit = True

        # Create an event. The Streamlit thread will set this event
        # when the server is initialized, and we'll return from this function
        # once that happens.
        streamlit_ready_event = threading.Event()

        # Start the Streamlit thread
        streamlit_thread = threading.Thread(
            target=lambda: self._run_streamlit_thread(streamlit_ready_event),
            name="StreamlitMain",
        )
        streamlit_thread.start()

        # Wait until Streamlit has been started before returning.
        streamlit_ready_event.wait()

    def stop(self) -> None:
        """Stop the Streamlit server."""
        assert self._server is not None, "null Server!"
        self._server.stop(from_signal=False)
        self._server = None
        self._ioloop = None

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

    def session_created(self, ctx: SnowflakeSessionCtx) -> None:
        """Called when a new session starts. Streamlit will create
        its own session machinery internally.
        """
        assert self._ioloop is not None, "null ioloop!"

        def session_created_handler() -> None:
            assert self._server is not None
            assert ctx not in self._sessions, "Session already registered!"
            session = self._server.create_demo_app_session(ctx.queue.write_forward_msg)
            self._sessions[ctx] = session

        self._ioloop.spawn_callback(session_created_handler)

    def handle_backmsg(self, ctx: SnowflakeSessionCtx, msg: BackMsg) -> None:
        """Called when a BackMsg arrives for a given session."""
        assert self._ioloop is not None, "null ioloop!"

        def backmsg_handler() -> None:
            assert ctx in self._sessions, "Session not registered!"
            self._sessions[ctx].handle_backmsg(msg)

        self._ioloop.spawn_callback(backmsg_handler)

    def session_closed(self, ctx: SnowflakeSessionCtx) -> None:
        """Called when a session has closed.
        Streamlit will dispose of internal session-related resources here.
        """
        assert self._ioloop is not None, "null ioloop!"

        def session_closed_handler() -> None:
            assert self._server is not None
            assert ctx in self._sessions, "Session not registered!"

            session = self._sessions[ctx]
            del self._sessions[ctx]
            self._server._close_app_session(session.id)

        self._ioloop.spawn_callback(session_closed_handler)
