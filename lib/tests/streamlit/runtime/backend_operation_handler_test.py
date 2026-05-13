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

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DeferredFileResponsePayload,
)
from streamlit.runtime.backend_operation_handler import (
    BackendOperationDispatcher,
    DeferredFileHandler,
)


def _create_deferred_file_request(
    *,
    request_id: str = "request-id",
    session_id: str = "session-id",
    file_id: str = "file-id",
) -> BackendOperationRequest:
    request = BackendOperationRequest()
    request.request_id = request_id
    request.session_id = session_id
    request.deferred_file.file_id = file_id
    return request


def test_dispatch_returns_error_without_payload() -> None:
    """Test that requests without payloads are rejected."""
    dispatcher = BackendOperationDispatcher()
    request = BackendOperationRequest(request_id="request-id", session_id="session-id")

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert response.request_id == "request-id"
    assert response.error_msg == "No payload specified in request"
    assert not response.HasField("deferred_file")


def test_dispatch_returns_error_without_registered_handler() -> None:
    """Test that unregistered payload types are rejected."""
    dispatcher = BackendOperationDispatcher()
    request = _create_deferred_file_request()

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert response.request_id == "request-id"
    assert "No handler registered" in response.error_msg
    assert not response.HasField("deferred_file")


def test_dispatch_calls_registered_handler() -> None:
    """Test that registered handlers receive matching requests."""

    class Handler:
        called_with: tuple[BackendOperationRequest, str] | None = None

        async def handle(
            self,
            request: BackendOperationRequest,
            session_id: str,
        ) -> BackendOperationResponse:
            self.called_with = (request, session_id)
            return BackendOperationResponse(
                request_id=request.request_id,
                deferred_file=DeferredFileResponsePayload(url="/media/generated"),
            )

    dispatcher = BackendOperationDispatcher()
    handler = Handler()
    request = _create_deferred_file_request()
    dispatcher.register("deferred_file", handler)

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert handler.called_with == (request, "session-id")
    assert response.request_id == "request-id"
    assert response.deferred_file.url == "/media/generated"
    assert response.error_msg == ""


def test_dispatch_returns_error_when_handler_fails() -> None:
    """Test that handler exceptions become error responses."""

    class FailingHandler:
        async def handle(
            self,
            _request: BackendOperationRequest,
            _session_id: str,
        ) -> BackendOperationResponse:
            raise RuntimeError("handler failed")

    dispatcher = BackendOperationDispatcher()
    dispatcher.register("deferred_file", FailingHandler())
    request = _create_deferred_file_request()

    response = asyncio.run(dispatcher.dispatch(request, "session-id"))

    assert response.request_id == "request-id"
    assert response.error_msg == "Failed to process backend operation"
    assert not response.HasField("deferred_file")


def test_deferred_file_handler_returns_generated_url() -> None:
    """Test that deferred file requests execute via the media file manager."""
    media_file_mgr = MagicMock()
    media_file_mgr.execute_deferred.return_value = "/media/generated"
    handler = DeferredFileHandler(lambda: media_file_mgr)

    response = asyncio.run(
        handler.handle(_create_deferred_file_request(file_id="file-123"), "session-id")
    )

    media_file_mgr.execute_deferred.assert_called_once_with("file-123")
    assert response.request_id == "request-id"
    assert response.deferred_file.url == "/media/generated"
    assert response.error_msg == ""


def test_deferred_file_handler_returns_error_response() -> None:
    """Test that deferred file execution errors are returned to the caller."""
    media_file_mgr = MagicMock()
    media_file_mgr.execute_deferred.side_effect = RuntimeError("download failed")
    handler = DeferredFileHandler(lambda: media_file_mgr)

    response = asyncio.run(
        handler.handle(_create_deferred_file_request(file_id="file-123"), "session-id")
    )

    media_file_mgr.execute_deferred.assert_called_once_with("file-123")
    assert response.request_id == "request-id"
    assert response.error_msg == "Failed to generate file for download"
    assert not response.HasField("deferred_file")
