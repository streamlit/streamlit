# Copyright 2018-2021 Streamlit Inc.
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

"""Server related utility functions"""

from typing import Optional, Any

from streamlit import config
from streamlit import net_util
from streamlit import url_util
from streamlit.forward_msg_cache import populate_hash_if_needed
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.errors import MarkdownFormattedException


class MessageSizeError(MarkdownFormattedException):
    """Exception raised when a websocket message is larger than the configured limit."""

    def __init__(self, failed_msg_str: Any):
        msg = self._get_message(failed_msg_str)
        super(MessageSizeError, self).__init__(msg)

    def _get_message(self, failed_msg_str: Any) -> str:
        # This needs to have zero indentation otherwise the markdown will render incorrectly.
        return (
            (
                """
**Data of size {message_size_mb:.1f} MB exceeds the message size limit of {message_size_limit_mb} MB.**

This is often caused by a large chart or dataframe. Please decrease the amount of data sent
to the browser, or increase the limit by setting the config option `server.maxMessageSize`.
[Click here to learn more about config options](https://docs.streamlit.io/library/advanced-features/configuration#set-configuration-options).

_Note that increasing the limit may lead to long loading times and large memory consumption
of the client's browser and the Streamlit server._
"""
            )
            .format(
                message_size_mb=len(failed_msg_str) / 1e6,
                message_size_limit_mb=(get_max_message_size_bytes() / 1e6),
            )
            .strip("\n")
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
    populate_hash_if_needed(msg)
    msg_str = msg.SerializeToString()

    if len(msg_str) > get_max_message_size_bytes():
        import streamlit.elements.exception as exception

        # Overwrite the offending ForwardMsg.delta with an error to display.
        # This assumes that the size limit wasn't exceeded due to metadata.
        exception.marshall(msg.delta.new_element.exception, MessageSizeError(msg_str))
        msg_str = msg.SerializeToString()

    return msg_str


def is_url_from_allowed_origins(url: str) -> bool:
    """Return True if URL is from allowed origins (for CORS purpose).

    Allowed origins:
    1. localhost
    2. The internal and external IP addresses of the machine where this
       function was called from.

    If `server.enableCORS` is False, this allows all origins.
    """
    if not config.get_option("server.enableCORS"):
        # Allow everything when CORS is disabled.
        return True

    hostname = url_util.get_hostname(url)

    allowed_domains = [  # List[Union[str, Callable[[], Optional[str]]]]
        # Check localhost first.
        "localhost",
        "0.0.0.0",
        "127.0.0.1",
        # Try to avoid making unecessary HTTP requests by checking if the user
        # manually specified a server address.
        _get_server_address_if_manually_set,
        # Then try the options that depend on HTTP requests or opening sockets.
        net_util.get_internal_ip,
        net_util.get_external_ip,
    ]

    for allowed_domain in allowed_domains:
        if callable(allowed_domain):
            allowed_domain = allowed_domain()

        if allowed_domain is None:
            continue

        if hostname == allowed_domain:
            return True

    return False


# This needs to be initialized lazily to avoid calling config.get_option() and
# thus initializing config options when this file is first imported.
_max_message_size_bytes = None


def get_max_message_size_bytes() -> int:
    """Returns the max websocket message size in bytes.

    This will lazyload the value from the config and store it in the global symbol table.
    """
    global _max_message_size_bytes

    if _max_message_size_bytes is None:
        _max_message_size_bytes = config.get_option("server.maxMessageSize") * int(1e6)

    return _max_message_size_bytes  # type: ignore


def _get_server_address_if_manually_set() -> Optional[str]:
    if config.is_manually_set("browser.serverAddress"):
        return url_util.get_hostname(config.get_option("browser.serverAddress"))
    return None


def make_url_path_regex(*path, **kwargs) -> str:
    """Get a regex of the form ^/foo/bar/baz/?$ for a path (foo, bar, baz)."""
    path = [x.strip("/") for x in path if x]  # Filter out falsy components.
    path_format = r"^/%s/?$" if kwargs.get("trailing_slash", True) else r"^/%s$"
    return path_format % "/".join(path)
