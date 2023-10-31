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
from typing import TYPE_CHECKING, Optional, Protocol

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.stats import CacheStatsProvider

if TYPE_CHECKING:
    from streamlit.runtime.app_session import AppSession


class ForwardMsgCacheProtocol(CacheStatsProvider, Protocol):
    """ForwardMsgCacheProtocol protocol, that should be implemented by the
    concrete ForwardMessageCache.

    It is responsible for:
        - Caching ForwardMsgs, add_message could optionally return ForwardMsgRef instead
            of original message to avoid sending large messages via websocket.
        - Issuing URLs, which will be used by frontend for retrieving original
            cached messages.
        - Maintaining cached messages lifetime, removing expired messages from cache
            based on script_run_count and global.maxCachedMessageAge config option.
        - Optionally retrieving cached messages by hash to be served by
            HTTP MESSAGE_ENDPOINT (only needed for Streamlit open source).
        - Mark original messages as cacheable (in message metadata) to be cached
            by frontend.

    It should be created during Runtime initialization.
    """

    @abstractmethod
    def add_message(
        self, msg: ForwardMsg, session: "AppSession", script_run_count: int
    ) -> ForwardMsg:
        """Add a ForwardMsg to the cache.
        Parameters
        ----------
        msg : ForwardMsg
        session : AppSession
        script_run_count : int
            The number of times the session's script has run
        Returns
        -------
        ForwardMsg
            Either an original message, or ForwardMsg with type ForwardMsgRef
        """

        raise NotImplementedError

    @abstractmethod
    def remove_refs_for_session(self, session: "AppSession") -> None:
        """Remove refs for all entries for the given session.
        This should be called when an AppSession is disconnected or closed.
        Parameters
        ----------
        session : AppSession
        """
        raise NotImplementedError

    @abstractmethod
    def remove_expired_entries_for_session(
        self, session: "AppSession", script_run_count: int
    ) -> None:
        """Remove any cached messages that have expired from the given session.
        This should be called each time a AppSession finishes executing.
        Parameters
        ----------
        session : AppSession
        script_run_count : int
            The number of times the session's script has run
        """
        raise NotImplementedError

    def get_message(self, hash: str) -> Optional[ForwardMsg]:  # noqa
        """Return the message with the given ID if it exists in the cache.
        Parameters
        ----------
        hash : str
            The id of the message to retrieve.
        Returns
        -------
        ForwardMsg | None
        """
        return None
