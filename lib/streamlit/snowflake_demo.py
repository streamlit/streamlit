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

This module is *not thread safe*. Functions here should be called only
on a single thread.

(Please don't release this into production :))
"""
import threading
from typing import NamedTuple

import tornado
import tornado.ioloop

import streamlit
from streamlit.bootstrap import _fix_sys_path, _fix_matplotlib_crash, \
    _fix_tornado_crash, _fix_sys_argv, _fix_pydeck_mapbox_api_warning, \
    _install_config_watchers, _set_up_signal_handler, _on_server_start
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

    def push_forward_msg(self, msg: ForwardMsg) -> None:
        raise NotImplementedError


class SnowflakeSessionCtx(NamedTuple):
    """Contains session-specific state. Create a new instance for
    each session.
    """

    queue: SnowflakeSessionMessageQueue


def start(config: SnowflakeConfig) -> None:
    """Start the Streamlit server. Must be called once, before
    any other functions are called.
    """

    command_line = f"streamlit run {config.script_path}"

    # Set a global flag indicating that we're "within" streamlit.
    streamlit._is_running_with_streamlit = True

    # Create an event. The Streamlit thread will set this event
    # when the server is initialized, and we'll return from this function
    # once that happens.
    streamlit_ready_event = threading.Event()

    def on_streamlit_started(server: Server) -> None:
        _on_server_start(server)
        streamlit_ready_event.set()

    def run_streamlit() -> None:
        _fix_sys_path(main_script_path)
        _fix_matplotlib_crash()
        _fix_tornado_crash()
        _fix_sys_argv(main_script_path, args)
        _fix_pydeck_mapbox_api_warning()
        _install_config_watchers(flag_options)

        # Install a signal handler that will shut down the ioloop
        # and close all our threads
        _set_up_signal_handler()

        ioloop = tornado.ioloop.IOLoop.current()

        # Create and start the server.
        server = Server(ioloop, main_script_path, command_line)
        server.start(_on_server_start)

        # Start the ioloop. This function will not return until the
        # server is shut down.
        ioloop.start()

    # Start the Streamlit thread
    streamlit_thread = threading.Thread(
        target=run_streamlit,
        name="StreamlitMain"
    )
    streamlit_thread.start()

    # Wait until Streamlit has been started before returning.
    streamlit_ready_event.wait()


def session_created(ctx: SnowflakeSessionCtx) -> None:
    """Called when a new session starts. Streamlit will create
    its own session machinery internally.
    """
    pass


def handle_backmsg(ctx: SnowflakeSessionCtx, msg: BackMsg) -> None:
    """Called when a BackMsg arrives for a given session.
    """
    pass


def session_closed(ctx: SnowflakeSessionCtx) -> None:
    """Called when a session has closed.

    Streamlit will dispose of internal session-related resources here.

    Must be called on the same thread as `start()`.
    """
    pass
