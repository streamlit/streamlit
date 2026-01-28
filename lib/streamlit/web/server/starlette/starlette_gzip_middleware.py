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

"""Custom GZip middleware that excludes audio/video content from compression."""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

from starlette.datastructures import Headers
from starlette.middleware.gzip import (
    DEFAULT_EXCLUDED_CONTENT_TYPES,
    GZipMiddleware,
    GZipResponder,
    IdentityResponder,
)

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Extended exclusion list: Starlette's default + audio/video prefixes.
# Compressing binary media content breaks playback in browsers,
# especially with range requests.
_EXCLUDED_CONTENT_TYPES: Final = (
    *DEFAULT_EXCLUDED_CONTENT_TYPES,
    "audio/",
    "video/",
)


def _handle_response_start(
    responder: IdentityResponder | GZipResponder, message: Message
) -> None:
    """Handle http.response.start message for media-aware responders.

    This function extracts headers from the response start message and determines
    whether the content should be excluded from compression based on its type.

    Parameters
    ----------
    responder
        The responder instance (either IdentityResponder or GZipResponder)
        to update with response metadata.
    message
        The ASGI "http.response.start" message containing response headers.
    """
    responder.initial_message = message
    headers = Headers(raw=responder.initial_message["headers"])
    responder.content_encoding_set = "content-encoding" in headers
    responder.content_type_is_excluded = headers.get("content-type", "").startswith(
        _EXCLUDED_CONTENT_TYPES
    )


class _MediaAwareIdentityResponder(IdentityResponder):
    """IdentityResponder that excludes audio/video from compression.

    This responder extends Starlette's IdentityResponder to use our extended
    list of excluded content types that includes audio/ and video/ prefixes.
    Used when the client does not support gzip compression.
    """

    async def send_with_compression(self, message: Message) -> None:
        """Process response messages, checking content type for exclusion."""
        if message["type"] == "http.response.start":
            _handle_response_start(self, message)
        else:
            await super().send_with_compression(message)


class _MediaAwareGZipResponder(GZipResponder):
    """GZipResponder that excludes audio/video from compression.

    This responder extends Starlette's GZipResponder to use our extended
    list of excluded content types that includes audio/ and video/ prefixes.
    Used when the client supports gzip compression.
    """

    async def send_with_compression(self, message: Message) -> None:
        """Process response messages, checking content type for exclusion."""
        if message["type"] == "http.response.start":
            _handle_response_start(self, message)
        else:
            await super().send_with_compression(message)


class MediaAwareGZipMiddleware(GZipMiddleware):
    """GZip middleware that excludes audio/video content from compression.

    Extends Starlette's GZipMiddleware to also exclude audio/ and video/
    content types. Avoiding compression for media content provides better
    browser compatibility (some browsers like WebKit have issues with
    explicit identity encoding on media).
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        responder: ASGIApp
        if "gzip" in headers.get("Accept-Encoding", ""):
            responder = _MediaAwareGZipResponder(
                self.app, self.minimum_size, compresslevel=self.compresslevel
            )
        else:
            responder = _MediaAwareIdentityResponder(self.app, self.minimum_size)

        await responder(scope, receive, send)
