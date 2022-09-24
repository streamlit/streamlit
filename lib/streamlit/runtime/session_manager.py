# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from abc import abstractmethod
from typing_extensions import Protocol

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from .app_session import AppSession


class SessionClientDisconnectedError(Exception):
    """Raised by operations on a disconnected SessionClient."""


class SessionClient(Protocol):
    """Interface for sending data to a session's client."""

    @abstractmethod
    def write_forward_msg(self, msg: ForwardMsg) -> None:
        """Deliver a ForwardMsg to the client.

        If the SessionClient has been disconnected, it should raise a
        SessionClientDisconnectedError.
        """
        raise NotImplementedError


class SessionInfo:
    """Type stored in our _session_info_by_id dict.

    For each AppSession, the Runtime tracks that session's
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
