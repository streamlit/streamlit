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

"""Handler system for backend operations.

Backend operations are server-side operations that don't require a script rerun,
such as lazy dataframe chunk loading, server-side validation, and autocompletion.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Final, Protocol

from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DeferredFileResponsePayload,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.media_file_manager import MediaFileManager

_LOGGER: Final = get_logger(__name__)


class BackendOperationHandler(Protocol):
    """Protocol for backend operation request handlers."""

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Handle a backend operation request and return a response."""
        ...


class BackendOperationDispatcher:
    """Dispatches backend operation requests to registered handlers."""

    def __init__(self) -> None:
        self._handlers: dict[str, BackendOperationHandler] = {}

    def register(self, payload_type: str, handler: BackendOperationHandler) -> None:
        """Register a handler for a specific payload type (e.g., "deferred_file")."""
        self._handlers[payload_type] = handler

    async def dispatch(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Dispatch a request to the appropriate handler."""
        payload_type = request.WhichOneof("payload")

        if payload_type is None:
            _LOGGER.warning(
                "Backend operation request %s has no payload", request.request_id
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="No payload specified in request",
            )

        handler = self._handlers.get(payload_type)
        if handler is None:
            _LOGGER.warning(
                "No handler registered for backend operation payload type: %s",
                payload_type,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg=f"No handler registered for payload type: {payload_type}",
            )

        try:
            return await handler.handle(request, session_id)
        except Exception:
            _LOGGER.exception(
                "Error handling backend operation request %s (type: %s)",
                request.request_id,
                payload_type,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to process backend operation",
            )


class DeferredFileHandler(BackendOperationHandler):
    """Handler for deferred file download requests."""

    def __init__(self, get_media_file_mgr: Callable[[], MediaFileManager]) -> None:
        """Initialize with a callable that returns the MediaFileManager."""
        self._get_media_file_mgr = get_media_file_mgr

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,  # noqa: ARG002
    ) -> BackendOperationResponse:
        """Execute the deferred callable and return the generated file URL."""
        payload = request.deferred_file
        file_id = payload.file_id

        try:
            # Execute in a separate thread to avoid blocking the event loop
            url = await asyncio.to_thread(
                self._get_media_file_mgr().execute_deferred,
                file_id,
            )

            return BackendOperationResponse(
                request_id=request.request_id,
                deferred_file=DeferredFileResponsePayload(url=url),
            )
        except Exception:
            _LOGGER.exception(
                "Error executing deferred callable for file_id %s", file_id
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to generate file for download",
            )
