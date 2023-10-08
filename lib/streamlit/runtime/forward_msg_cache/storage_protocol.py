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
from typing import Optional, Protocol, TypeAlias

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

RefHash: TypeAlias = str
RefURL: TypeAlias = str


class ForwardMsgCacheStorageProtocol(Protocol):
    @abstractmethod
    def add_message(self, msg: ForwardMsg) -> RefURL:
        """Add message to storage, return message URL
        Message recieved via get request to RefURL should be able to be unpacked
        on frontend via `ForwardMsg.decode(encodedMsg)`.
        """
        raise NotImplementedError

    @abstractmethod
    def delete_message(self, msg_hash: RefHash) -> None:
        """Delete message"""
        raise NotImplementedError

    @abstractmethod
    def clear(self):
        """Clear storage"""
        raise NotImplementedError

    def get_message(self, msg_hash: RefHash) -> Optional[ForwardMsg]:
        """Get message by it hash, return None if message not found"""
        return None
