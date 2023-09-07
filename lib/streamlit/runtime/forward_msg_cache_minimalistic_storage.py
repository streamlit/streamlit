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

from typing import Dict, Optional

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


class MinimalisticStorage:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self._messages_by_hash: Dict[str, ForwardMsg] = {}

    def add_message(self, msg: ForwardMsg) -> str:
        self._messages_by_hash[msg.hash] = msg
        return f"{self.base_url}?hash={msg.hash}"

    def get_message(self, msg_hash: str) -> Optional[ForwardMsg]:
        return self._messages_by_hash.get(msg_hash)

    def delete_message(self, msg_hash: str) -> None:
        self._messages_by_hash.pop(msg_hash, None)

    def clear(self):
        self._messages_by_hash.clear()
