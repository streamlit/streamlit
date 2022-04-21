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

from typing import NamedTuple

import streamlit
from streamlit import bootstrap
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


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

    # check_credentials()

    bootstrap.run(
        main_script_path=config.script_path,
        command_line=command_line,
        args=[],
        flag_options={},
    )


def session_created(ctx: SnowflakeSessionCtx) -> None:
    """Called when a new session starts. Streamlit will create
    its own session machinery internally.

    Must be called on the same thread as `start()`.
    """
    pass


def handle_backmsg(ctx: SnowflakeSessionCtx, msg: BackMsg) -> None:
    """Called when a BackMsg arrives for a given session.

    Must be called on the same thread as `start()`.
    """
    pass


def session_closed(ctx: SnowflakeSessionCtx) -> None:
    """Called when a session has closed.

    Streamlit will dispose of internal session-related resources here.

    Must be called on the same thread as `start()`.
    """
    pass
