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

"""Unit tests for the lazy dataframe chunk backend operation handler."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pyarrow as pa

from streamlit.dataframe.source import InMemoryDataframeSource
from streamlit.dataframe_util import convert_arrow_bytes_to_pandas_df
from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
from streamlit.proto.Dataframe_pb2 import SortState
from streamlit.runtime.dataframe_chunk_handler import DataframeChunkHandler
from streamlit.runtime.dataframe_source_manager import DataframeSourceManager


def _setup() -> tuple[DataframeChunkHandler, DataframeSourceManager, object]:
    """Create a handler + manager with one registered source."""
    mgr = DataframeSourceManager()
    source = InMemoryDataframeSource(
        pa.table({"a": list(range(1000)), "b": [x * 2 for x in range(1000)]})
    )
    with patch(
        "streamlit.runtime.dataframe_source_manager._get_session_id",
        return_value="s1",
    ):
        reg = mgr.register_source(source, "1.0.0")
    handler = DataframeChunkHandler(lambda: mgr)
    return handler, mgr, reg


def _build_request(
    reg: object, *, offset: int = 0, limit: int = 5
) -> BackendOperationRequest:
    """Build a dataframe_chunk request for a registered source."""
    request = BackendOperationRequest(request_id="r1", session_id=reg.session_id)  # type: ignore[attr-defined]
    request.dataframe_chunk.source_id = reg.source_id  # type: ignore[attr-defined]
    request.dataframe_chunk.offset = offset
    request.dataframe_chunk.limit = limit
    request.dataframe_chunk.generation = reg.generation  # type: ignore[attr-defined]
    return request


def test_handle_returns_chunk() -> None:
    """A valid request returns a dataframe_chunk response with Arrow rows."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg, offset=10, limit=3)

    response = asyncio.run(handler.handle(request, reg.session_id))  # type: ignore[attr-defined]

    assert response.error_msg == ""
    assert response.HasField("dataframe_chunk")
    chunk = response.dataframe_chunk
    assert chunk.source_id == reg.source_id  # type: ignore[attr-defined]
    assert chunk.offset == 10
    assert chunk.generation == reg.generation  # type: ignore[attr-defined]
    assert chunk.end_of_stream is False
    df = convert_arrow_bytes_to_pandas_df(chunk.arrow_data.data)
    assert df["a"].tolist() == [10, 11, 12]


def test_handle_applies_sort() -> None:
    """A request with sort state returns sorted rows."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg, offset=0, limit=3)
    request.dataframe_chunk.sort.column = "a"
    request.dataframe_chunk.sort.direction = SortState.SortDirection.DESCENDING

    response = asyncio.run(handler.handle(request, reg.session_id))  # type: ignore[attr-defined]

    df = convert_arrow_bytes_to_pandas_df(response.dataframe_chunk.arrow_data.data)
    assert df["a"].tolist() == [999, 998, 997]


def test_handle_stale_generation_returns_error() -> None:
    """A stale generation produces an error response, not a chunk."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg)
    request.dataframe_chunk.generation = "stale"

    response = asyncio.run(handler.handle(request, reg.session_id))  # type: ignore[attr-defined]

    assert "stale" in response.error_msg
    assert not response.HasField("dataframe_chunk")


def test_handle_wrong_session_returns_error() -> None:
    """A request from a different session is rejected."""
    handler, _mgr, reg = _setup()
    request = _build_request(reg)

    response = asyncio.run(handler.handle(request, "other-session"))

    assert "does not belong" in response.error_msg
    assert not response.HasField("dataframe_chunk")


def test_handle_unexpected_error_returns_generic_message() -> None:
    """An unexpected loader error returns a generic error response."""
    mgr = DataframeSourceManager()

    class _BrokenManager:
        def load_chunk(self, *_args: object, **_kwargs: object) -> object:
            raise RuntimeError("boom")

    handler = DataframeChunkHandler(lambda: _BrokenManager())  # type: ignore[arg-type,return-value]
    request = BackendOperationRequest(request_id="r1", session_id="s1")
    request.dataframe_chunk.source_id = "sid"
    request.dataframe_chunk.offset = 0
    request.dataframe_chunk.limit = 5
    request.dataframe_chunk.generation = "gen"

    response = asyncio.run(handler.handle(request, "s1"))

    assert response.error_msg == "Failed to load dataframe chunk."
    assert not response.HasField("dataframe_chunk")
    assert mgr.get_source_count() == 0
