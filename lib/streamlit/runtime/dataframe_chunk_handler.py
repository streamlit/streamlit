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

"""Handler for lazy dataframe chunk requests.

This handler processes BackendOperationRequest messages with dataframe_chunk
payloads, validates the source/generation, and returns Arrow data chunks.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Final

from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import (
    BackendOperationResponse,
    DataframeChunkResponsePayload,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.proto.BackMsg_pb2 import BackendOperationRequest
    from streamlit.runtime.dataframe_source_manager import DataframeSourceManager

_LOGGER: Final = get_logger(__name__)


class DataframeChunkHandler:
    """Handler for lazy dataframe chunk requests.

    Implements the BackendOperationHandler protocol for dataframe chunks.
    Validates session/source/generation, executes the source's load_rows
    in a worker thread, and returns Arrow data.
    """

    def __init__(
        self, get_source_manager: Callable[[str], DataframeSourceManager | None]
    ) -> None:
        """Initialize the handler.

        Parameters
        ----------
        get_source_manager : Callable[[str], DataframeSourceManager | None]
            A callable that returns the DataframeSourceManager for a given
            session_id, or None if the session doesn't exist.
        """
        self._get_source_manager = get_source_manager

    async def handle(
        self,
        request: BackendOperationRequest,
        session_id: str,
    ) -> BackendOperationResponse:
        """Handle a dataframe chunk request.

        Parameters
        ----------
        request : BackendOperationRequest
            The incoming request with dataframe_chunk payload.
        session_id : str
            The session ID for this request.

        Returns
        -------
        BackendOperationResponse
            The response containing Arrow data or an error message.
        """
        # Import here to avoid importing pyarrow/numpy at module load time
        from streamlit.dataframe_sources.source import (
            MAX_CHUNK_LIMIT,
            sort_state_to_config,
        )

        payload = request.dataframe_chunk

        # Validate session and get source manager
        source_manager = self._get_source_manager(session_id)
        if source_manager is None:
            _LOGGER.warning(
                "Chunk request %s: session %s not found",
                request.request_id,
                session_id,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Session not found",
            )

        # Validate source exists and generation matches
        source = source_manager.get_source(payload.source_id, payload.generation)
        if source is None:
            _LOGGER.debug(
                "Chunk request %s: source %s not found or stale generation",
                request.request_id,
                payload.source_id,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Source not found or stale generation",
            )

        # Enforce maximum chunk limit
        limit = min(payload.limit, MAX_CHUNK_LIMIT)
        if payload.limit > MAX_CHUNK_LIMIT:
            _LOGGER.warning(
                "Chunk request %s: requested limit %d exceeds max %d, clamping",
                request.request_id,
                payload.limit,
                MAX_CHUNK_LIMIT,
            )

        # Convert sort state if present
        sort_config = None
        if payload.HasField("sort"):
            sort_config = sort_state_to_config(payload.sort)

        try:
            # Execute load_rows in a worker thread to avoid blocking the event loop
            arrow_bytes = await asyncio.to_thread(
                source.load_rows,
                payload.offset,
                limit,
                sort=sort_config,
            )

            _LOGGER.debug(
                "Chunk request %s: loaded %d bytes for source %s at offset %d",
                request.request_id,
                len(arrow_bytes),
                payload.source_id,
                payload.offset,
            )

            # Import ArrowData here to construct the response payload
            from streamlit.proto.ArrowData_pb2 import ArrowData

            return BackendOperationResponse(
                request_id=request.request_id,
                dataframe_chunk=DataframeChunkResponsePayload(
                    source_id=payload.source_id,
                    offset=payload.offset,
                    generation=payload.generation,
                    end_of_stream=False,  # Always False for known-size sources in Phase 1
                    arrow_data=ArrowData(data=arrow_bytes),
                ),
            )

        except Exception:
            _LOGGER.exception(
                "Chunk request %s: error loading rows for source %s",
                request.request_id,
                payload.source_id,
            )
            return BackendOperationResponse(
                request_id=request.request_id,
                error_msg="Failed to load dataframe chunk",
            )
