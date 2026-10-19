# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Serve an element's Arrow data over HTTP instead of inside its message.

The data is registered in the same media-file storage that backs ``st.image``,
``st.audio``, and eager ``st.download_button``, and served from the same
``/media/...`` endpoint. Registration happens while the script runs, so the
file is attributed to the running session and picked up by the existing
lifecycle: ``clear_session_refs`` at the start of each full run drops the
previous run's references, and ``remove_orphaned_files`` at the end collects
whatever is no longer referenced.

The agent API is the only consumer today. Its snapshot reports the schema, row
counts, and a bounded row preview inline, and points at this URL for the
complete data, so a truncated preview always has somewhere to fetch the rest
from. There is no size threshold: completeness is a question about row count,
not bytes, and a mid-size table that falls below a byte threshold is exactly
the case that leaves a client truncated with nowhere to go.

Nothing here is agent-specific beyond the one gate below, which is deliberate.
Sending Arrow over HTTP so browser requests parallelize instead of queueing
behind a single WebSocket is a standing request
(https://github.com/streamlit/streamlit/issues/16378), and that issue
explicitly prefers reusing media-file storage over adding an endpoint. When the
frontend can fetch Arrow, this is the function it should call; the interesting
part of that work is dropping the inline copy from the message, which is where
the win is and which only a fetching frontend makes safe.
"""

from __future__ import annotations

from typing import Final

from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)

# The registered mime type for the Arrow IPC stream format, which is what
# Streamlit's Arrow serializer produces.
ARROW_MIMETYPE: Final = "application/vnd.apache.arrow.stream"


def serve_arrow_over_http(arrow_bytes: bytes, *, coordinates: str) -> str | None:
    """Register Arrow data for HTTP fetch and return its URL.

    Returns ``None`` when nobody in this session would fetch it, or when the
    payload is too large to hold a second copy of.

    Parameters
    ----------
    arrow_bytes
        The serialized Arrow IPC stream.
    coordinates
        A string identifying this data's position in the app, from
        ``DeltaGenerator._get_delta_path_str()``. The media file manager keys
        references by it so data replaced in place does not leak. An element
        with more than one buffer must pass a distinct value per buffer.
    """
    if not arrow_bytes or not agent_spec.is_recording():
        return None

    from streamlit.runtime.runtime_util import get_max_message_size_bytes

    # The bound the app's own WebSocket messages have, so an agent is served no
    # more data than the app could send its browser, and raising one raises
    # both. Above it the element reports no URL and the snapshot says so with
    # `data.unavailable`; a client that needs the data narrows the app's
    # filters instead.
    size = len(arrow_bytes)
    max_size = get_max_message_size_bytes()
    if size > max_size:
        # Debug, not warning: this repeats for the element on every run, and
        # the snapshot already tells the client, through `data.unavailable`.
        _LOGGER.debug(
            "Not serving %s bytes of Arrow data over HTTP: above "
            "`server.maxMessageSize` (%s bytes). Clients will only see the "
            "inline preview.",
            size,
            max_size,
        )
        return None

    from streamlit.runtime import caching, exists, get_instance

    if not exists():
        # No runtime means no media storage and no HTTP server to fetch from,
        # which is the "python myscript.py" and bare-AppTest case.
        return None

    url = get_instance().media_file_mgr.add(arrow_bytes, ARROW_MIMETYPE, coordinates)
    # Recorded like an image's bytes, so an element replayed from an
    # `st.cache_data` result registers its file again: the replayed
    # description carries this URL, and without that the file is collected
    # after the run that replayed it.
    caching.save_media_data(arrow_bytes, ARROW_MIMETYPE, coordinates)
    return url
