# Copyright 2018-2020 Streamlit Inc.
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

from typing import Callable, List, Optional, Union

from streamlit import config
from streamlit import net_util
from streamlit import type_util
from streamlit import url_util
from streamlit.forward_msg_cache import populate_hash_if_needed

# Largest message that can be sent via the WebSocket connection.
# (Limit was picked arbitrarily)
# TODO: Break message in several chunks if too large.
MESSAGE_SIZE_LIMIT = 50 * 1e6  # 50MB


def is_cacheable_msg(msg):
    """True if the given message qualifies for caching.

    Parameters
    ----------
    msg : ForwardMsg

    Returns
    -------
    bool
        True if we should cache the message.

    """
    if msg.WhichOneof("type") in {"ref_hash", "initialize"}:
        # Some message types never get cached
        return False
    return msg.ByteSize() >= config.get_option("global.minCachedMessageSize")


def serialize_forward_msg(msg):
    """Serialize a ForwardMsg to send to a client.

    If the message is too large, it will be converted to an exception message
    instead.

    Parameters
    ----------
    msg : ForwardMsg
        The message to serialize

    Returns
    -------
    str
        The serialized byte string to send

    """
    populate_hash_if_needed(msg)
    msg_str = msg.SerializeToString()

    if len(msg_str) > MESSAGE_SIZE_LIMIT:
        import streamlit.elements.exception_proto as exception_proto

        error = RuntimeError(
            f"Data of size {len(msg_str)/1e6:.1f}MB exceeds write limit of {MESSAGE_SIZE_LIMIT/1e6}MB"
        )
        # Overwrite the offending ForwardMsg.delta with an error to display.
        # This assumes that the size limit wasn't exceeded due to metadata.
        exception_proto.marshall(msg.delta.new_element.exception, error)
        msg_str = msg.SerializeToString()

    return msg_str


def is_url_from_allowed_origins(url):
    """Return True if URL is from allowed origins (for CORS purpose).

    Allowed origins:
    1. localhost
    2. The internal and external IP addresses of the machine where this
       function was called from.
    3. The cloud storage domain configured in `s3.bucket`.

    If `server.enableCORS` is False, this allows all origins.

    Parameters
    ----------
    url : str
        The URL to check

    Returns
    -------
    bool
        True if URL is accepted. False otherwise.

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
        _get_s3_url_host_if_manually_set,
        # Then try the options that depend on HTTP requests or opening sockets.
        net_util.get_internal_ip,
        net_util.get_external_ip,
        lambda: config.get_option("s3.bucket"),
    ]

    for allowed_domain in allowed_domains:
        if callable(allowed_domain):
            allowed_domain = allowed_domain()

        if allowed_domain is None:
            continue

        if hostname == allowed_domain:
            return True

    return False


def _get_server_address_if_manually_set() -> Optional[str]:
    if config.is_manually_set("browser.serverAddress"):
        return url_util.get_hostname(config.get_option("browser.serverAddress"))
    return None


def _get_s3_url_host_if_manually_set() -> Optional[str]:
    if config.is_manually_set("s3.url"):
        return url_util.get_hostname(config.get_option("s3.url"))
    return None


def make_url_path_regex(*path, **kwargs):
    """Get a regex of the form ^/foo/bar/baz/?$ for a path (foo, bar, baz)."""
    path = [x.strip("/") for x in path if x]  # Filter out falsy components.
    path_format = r"^/%s/?$" if kwargs.get("trailing_slash", True) else r"^/%s$"
    return path_format % "/".join(path)
