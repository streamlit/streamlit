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

"""Backend operation handler for lazy ``st.dataframe`` row chunk requests."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Final

from streamlit.dataframe.source import SortSpec
from streamlit.logger import get_logger
from streamlit.proto.Dataframe_pb2 import SortState
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DataframeChunkResponsePayload,
)
from streamlit.runtime.backend_operation_handler import BackendOperationHandler
from streamlit.runtime.dataframe_source_manager import DataframeSourceError

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.dataframe_source_manager import DataframeSourceManager

_LOGGER: Final = get_logger(__name__)


def _sort_from_proto(request: BackendOperationRequest) -> SortSpec | None:
    """Convert the optional proto ``SortState`` into a :class:`SortSpec`."""
    chunk = request.dataframe_chunk
    if not chunk.HasField("sort"):
        return None
    sort = chunk.sort
    if not sort.column:
        return None
    descending = sort.direction == SortState.SortDirection.DESCENDING
    return SortSpec(column=sort.column, descending=descending)


class DataframeChunkHandler(BackendOperationHandler):
    """Handles ``dataframe_chunk`` backend operation requests.

    Loads the requested row range from the session's registered lazy dataframe
    source in a worker thread (so slow queries don't block the event loop) and
    returns the rows as Arrow IPC bytes.
    """

    def __init__(self, get_source_mgr: Callable[[], DataframeSourceManager]) -> None:
        self._get_source_mgr = get_source_mgr

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        payload = request.dataframe_chunk
        sort = _sort_from_proto(request)

        try:
            arrow_bytes, offset = await asyncio.to_thread(
                self._get_source_mgr().load_chunk,
                session_id,
                payload.source_id,
                payload.generation,
                payload.offset,
                payload.limit,
                sort,
            )
        except DataframeSourceError as err:
            # Expected validation failures (stale generation, unknown source,
            # etc.). The message is safe to surface to the frontend.
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg=str(err),
            )
        except Exception:
            _LOGGER.exception(
                "Error loading dataframe chunk for source %s (offset=%s, limit=%s)",
                payload.source_id,
                payload.offset,
                payload.limit,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to load dataframe chunk.",
            )

        response = BackendOperationResponse(request_id=request.request_id)
        chunk_response = DataframeChunkResponsePayload(
            source_id=payload.source_id,
            offset=offset,
            generation=payload.generation,
            end_of_stream=False,
        )
        chunk_response.arrow_data.data = arrow_bytes
        response.dataframe_chunk.CopyFrom(chunk_response)
        return response
