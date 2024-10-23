# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

"""Runtime-related utility functions"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from streamlit import config
from streamlit.errors import MarkdownFormattedException, StreamlitAPIException

if TYPE_CHECKING:
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg


class MessageSizeError(MarkdownFormattedException):
    """Exception raised when a websocket message is larger than the configured limit."""

    def __init__(self, failed_msg_str: Any):
        msg = self._get_message(failed_msg_str)
        super().__init__(msg)

    def _get_message(self, failed_msg_str: Any) -> str:
        # This needs to have zero indentation otherwise the markdown will render incorrectly.
        return (
            f"""
**Data of size {len(failed_msg_str) / 1e6:.1f} MB exceeds the message size limit of {get_max_message_size_bytes() / 1e6} MB.**

This is often caused by a large chart or dataframe. Please decrease the amount of data sent
to the browser, or increase the limit by setting the config option `server.maxMessageSize`.
[Click here to learn more about config options](https://docs.streamlit.io/develop/api-reference/configuration/config.toml).

_Note that increasing the limit may lead to long loading times and large memory consumption
of the client's browser and the Streamlit server._
"""
        ).strip("\n")


class BadDurationStringError(StreamlitAPIException):
    """Raised when a bad duration argument string is passed."""

    def __init__(self, duration: str):
        MarkdownFormattedException.__init__(
            self,
            "TTL string doesn't look right. It should be formatted as"
            f"`'1d2h34m'` or `2 days`, for example. Got: {duration}",
        )


def is_cacheable_msg(msg: ForwardMsg) -> bool:
    """True if the given message qualifies for caching."""
    if msg.WhichOneof("type") in {"ref_hash", "initialize"}:
        # Some message types never get cached
        return False
    return msg.ByteSize() >= int(config.get_option("global.minCachedMessageSize"))


def serialize_forward_msg(msg: ForwardMsg) -> bytes:
    """Serialize a ForwardMsg to send to a client.

    If the message is too large, it will be converted to an exception message
    instead.
    """
    msg_str = msg.SerializeToString()

    if len(msg_str) > get_max_message_size_bytes():
        import streamlit.elements.exception as exception

        # Overwrite the offending ForwardMsg.delta with an error to display.
        # This assumes that the size limit wasn't exceeded due to metadata.
        exception.marshall(msg.delta.new_element.exception, MessageSizeError(msg_str))
        msg_str = msg.SerializeToString()

    return msg_str


# This needs to be initialized lazily to avoid calling config.get_option() and
# thus initializing config options when this file is first imported.
_max_message_size_bytes: int | None = None


def get_max_message_size_bytes() -> int:
    """Returns the max websocket message size in bytes.

    This will lazyload the value from the config and store it in the global symbol table.
    """
    global _max_message_size_bytes

    if _max_message_size_bytes is None:
        _max_message_size_bytes = config.get_option("server.maxMessageSize") * int(1e6)

    return _max_message_size_bytes
