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

"""Unit tests for DataframeChunkHandler."""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock

from streamlit.dataframe_sources.source import MAX_CHUNK_LIMIT
from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
from streamlit.proto.Dataframe_pb2 import SortState
from streamlit.runtime.dataframe_chunk_handler import DataframeChunkHandler
from streamlit.runtime.dataframe_source_manager import DataframeSourceManager


def _create_chunk_request(
    *,
    request_id: str = "request-id",
    source_id: str = "source-id",
    generation: str = "generation-id",
    offset: int = 0,
    limit: int = 100,
    sort: SortState | None = None,
) -> BackendOperationRequest:
    """Create a mock BackendOperationRequest with dataframe_chunk payload."""
    request = BackendOperationRequest()
    request.request_id = request_id
    request.dataframe_chunk.source_id = source_id
    request.dataframe_chunk.generation = generation
    request.dataframe_chunk.offset = offset
    request.dataframe_chunk.limit = limit
    if sort is not None:
        request.dataframe_chunk.sort.CopyFrom(sort)
    return request


def _create_mock_source() -> MagicMock:
    """Create a mock DataframeSourceProtocol implementation."""
    source = MagicMock()
    source.row_count = 1000
    source.sortable = True
    source.load_rows.return_value = b"mock_arrow_data"
    return source


def test_handle_returns_error_when_session_not_found() -> None:
    """Test that requests for unknown sessions return an error."""
    handler = DataframeChunkHandler(lambda _: None)
    request = _create_chunk_request()

    response = asyncio.run(handler.handle(request, "unknown-session"))

    assert response.request_id == "request-id"
    assert response.error_msg == "Session not found"
    assert not response.HasField("dataframe_chunk")


def test_handle_returns_error_when_source_not_found() -> None:
    """Test that requests for unknown sources return an error."""
    manager = DataframeSourceManager()
    handler = DataframeChunkHandler(lambda _: manager)
    request = _create_chunk_request(source_id="unknown-source")

    response = asyncio.run(handler.handle(request, "session-id"))

    assert response.request_id == "request-id"
    assert "Source not found or stale generation" in response.error_msg
    assert not response.HasField("dataframe_chunk")


def test_handle_returns_error_when_generation_mismatches() -> None:
    """Test that requests with stale generation return an error."""
    manager = DataframeSourceManager()
    source = _create_mock_source()
    source_id, _ = manager.register_source(source, "delta_path")

    handler = DataframeChunkHandler(lambda _: manager)
    request = _create_chunk_request(source_id=source_id, generation="wrong-gen")

    response = asyncio.run(handler.handle(request, "session-id"))

    assert response.request_id == "request-id"
    assert "Source not found or stale generation" in response.error_msg


def test_handle_returns_arrow_data_for_valid_request() -> None:
    """Test that valid requests return Arrow data."""
    manager = DataframeSourceManager()
    source = _create_mock_source()
    source_id, generation = manager.register_source(source, "delta_path")

    handler = DataframeChunkHandler(lambda _: manager)
    request = _create_chunk_request(
        source_id=source_id,
        generation=generation,
        offset=50,
        limit=100,
    )

    response = asyncio.run(handler.handle(request, "session-id"))

    assert response.request_id == "request-id"
    assert response.error_msg == ""
    assert response.HasField("dataframe_chunk")
    assert response.dataframe_chunk.source_id == source_id
    assert response.dataframe_chunk.offset == 50
    assert response.dataframe_chunk.generation == generation
    assert response.dataframe_chunk.arrow_data.data == b"mock_arrow_data"
    source.load_rows.assert_called_once_with(50, 100, sort=None)


def test_handle_clamps_limit_to_max_chunk_limit() -> None:
    """Test that requests exceeding MAX_CHUNK_LIMIT are clamped."""
    manager = DataframeSourceManager()
    source = _create_mock_source()
    source_id, generation = manager.register_source(source, "delta_path")

    handler = DataframeChunkHandler(lambda _: manager)
    excessive_limit = MAX_CHUNK_LIMIT + 5000
    request = _create_chunk_request(
        source_id=source_id,
        generation=generation,
        limit=excessive_limit,
    )

    response = asyncio.run(handler.handle(request, "session-id"))

    assert response.error_msg == ""
    source.load_rows.assert_called_once_with(0, MAX_CHUNK_LIMIT, sort=None)


def test_handle_passes_sort_config_to_source() -> None:
    """Test that sort state is converted and passed to the source."""
    manager = DataframeSourceManager()
    source = _create_mock_source()
    source_id, generation = manager.register_source(source, "delta_path")

    handler = DataframeChunkHandler(lambda _: manager)

    sort_state = SortState()
    sort_state.column = "my_column"
    sort_state.direction = SortState.SortDirection.DESCENDING

    request = _create_chunk_request(
        source_id=source_id,
        generation=generation,
        sort=sort_state,
    )

    response = asyncio.run(handler.handle(request, "session-id"))

    assert response.error_msg == ""
    call_args = source.load_rows.call_args
    assert call_args.kwargs["sort"].column == "my_column"
    assert call_args.kwargs["sort"].ascending is False


def test_handle_returns_error_when_load_rows_fails() -> None:
    """Test that source exceptions are caught and returned as errors."""
    manager = DataframeSourceManager()
    source = _create_mock_source()
    source.load_rows.side_effect = RuntimeError("load failed")
    source_id, generation = manager.register_source(source, "delta_path")

    handler = DataframeChunkHandler(lambda _: manager)
    request = _create_chunk_request(source_id=source_id, generation=generation)

    response = asyncio.run(handler.handle(request, "session-id"))

    assert response.request_id == "request-id"
    assert response.error_msg == "Failed to load dataframe chunk"
    assert not response.HasField("dataframe_chunk")
