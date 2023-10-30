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
    """DOC HERE"""

    @abstractmethod
    def add_message(
        self, msg: ForwardMsg, session: "AppSession", script_run_count: int
    ) -> ForwardMsg:
        """DOC HERE"""

        raise NotImplementedError

    @abstractmethod
    def remove_refs_for_session(self, session: "AppSession") -> None:
        """DOC HERE"""
        raise NotImplementedError

    @abstractmethod
    def remove_expired_entries_for_session(
        self, session: "AppSession", script_run_count: int
    ) -> None:
        """DOC HERE"""
        raise NotImplementedError

    def clear(self) -> None:
        """DOC HERE"""
        pass

    def get_message(self, hash: str) -> Optional[ForwardMsg]:  # noqa
        """DOC HERE"""
        return None
