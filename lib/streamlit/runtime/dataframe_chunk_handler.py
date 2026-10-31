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
from functools import partial
from typing import TYPE_CHECKING, Final, TypeAlias

from streamlit.dataframe.lazy_df_source import MAX_CHUNK_ROWS, SortSpec
from streamlit.logger import get_logger
from streamlit.proto.Dataframe_pb2 import SortState
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DataframeChunkResponsePayload,
)
from streamlit.runtime.backend_operation_handler import BackendOperationHandler
from streamlit.runtime.dataframe_source_manager import DataframeSourceError
from streamlit.runtime.runtime_util import get_max_message_size_bytes

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.dataframe_source_manager import DataframeSourceManager

_LOGGER: Final = get_logger(__name__)
_MAX_CONCURRENT_REQUESTS_PER_SOURCE: Final = 4

_SourceKey: TypeAlias = tuple[str, str]
_ChunkKey: TypeAlias = tuple[str, str, int, int, str | None, bool]


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
        # Calls for one source are bounded before entering asyncio.to_thread so
        # a modified or over-eager client cannot fill the shared worker pool.
        # Identical requests share one task, which also avoids repeating remote
        # queries and full-table sorts.
        self._source_semaphores: dict[_SourceKey, asyncio.Semaphore] = {}
        self._in_flight: dict[_ChunkKey, asyncio.Task[tuple[bytes, int]]] = {}

    async def _load_chunk(
        self,
        source_key: _SourceKey,
        session_id: str,
        source_id: str,
        offset: int,
        limit: int,
        sort: SortSpec | None,
    ) -> tuple[bytes, int]:
        semaphore = self._source_semaphores.setdefault(
            source_key, asyncio.Semaphore(_MAX_CONCURRENT_REQUESTS_PER_SOURCE)
        )
        async with semaphore:
            return await asyncio.to_thread(
                self._get_source_mgr().load_chunk,
                session_id,
                source_id,
                offset,
                limit,
                sort,
            )

    def _remove_completed_task(
        self, chunk_key: _ChunkKey, task: asyncio.Task[tuple[bytes, int]]
    ) -> None:
        """Remove completed request state while preserving any replacement task."""
        if self._in_flight.get(chunk_key) is task:
            del self._in_flight[chunk_key]
        source_key = chunk_key[:2]
        if not any(key[:2] == source_key for key in self._in_flight):
            self._source_semaphores.pop(source_key, None)

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        payload = request.dataframe_chunk
        sort = _sort_from_proto(request)
        limit = min(max(payload.limit, 0), MAX_CHUNK_ROWS)
        source_key: _SourceKey = (
            session_id,
            payload.source_id,
        )
        chunk_key: _ChunkKey = (
            *source_key,
            payload.offset,
            limit,
            sort.column if sort is not None else None,
            sort.descending if sort is not None else False,
        )

        task = self._in_flight.get(chunk_key)
        if task is None:
            task = asyncio.create_task(
                self._load_chunk(
                    source_key,
                    session_id,
                    payload.source_id,
                    payload.offset,
                    limit,
                    sort,
                )
            )
            self._in_flight[chunk_key] = task
            task.add_done_callback(partial(self._remove_completed_task, chunk_key))

        try:
            # Shield the shared operation so cancellation of one waiter does not
            # cancel the request for every other waiter using the same task.
            arrow_bytes, offset = await asyncio.shield(task)
        except DataframeSourceError as err:
            # Expected validation failures (unknown source, wrong session,
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

        max_message_size = get_max_message_size_bytes()
        if len(arrow_bytes) > max_message_size:
            # A chunk larger than the websocket message-size limit cannot be
            # delivered as-is. Returning it would let serialize_forward_msg()
            # rewrite the oversized ForwardMsg into an exception delta, which
            # clears the shared `backend_operation_response` oneof so the
            # frontend never receives a matching response and the chunk request
            # hangs until it times out. Surface an actionable error instead.
            _LOGGER.warning(
                "Dataframe chunk for source %s (offset=%s, limit=%s) is %.1f MB, "
                "exceeding the message size limit of %.1f MB.",
                payload.source_id,
                payload.offset,
                limit,
                len(arrow_bytes) / 1e6,
                max_message_size / 1e6,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg=(
                    f"Dataframe chunk of size {len(arrow_bytes) / 1e6:.1f} MB "
                    f"exceeds the message size limit of "
                    f"{max_message_size / 1e6:.1f} MB. Reduce the page size or "
                    "increase the `server.maxMessageSize` config option."
                ),
            )

        response = BackendOperationResponse(request_id=request.request_id)
        chunk_response = DataframeChunkResponsePayload(
            source_id=payload.source_id,
            offset=offset,
            end_of_stream=False,
        )
        chunk_response.arrow_data.data = arrow_bytes
        response.dataframe_chunk.CopyFrom(chunk_response)
        return response
