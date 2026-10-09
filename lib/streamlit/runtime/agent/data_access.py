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

"""Read a file a snapshot references, for clients that cannot fetch its URL.

An MCP chat client often cannot reach a `data.url` or a media URL: its model
does not know the URL the connection uses, its fetch tool may refuse a URL it
did not see in full, and its code sandbox may have no network. So the MCP
endpoint serves those files through the connection itself.

Only files the session's latest snapshot references are served, which gives
them the same lifetime as the URL and brings the session's identity binding
along. A table comes back as rows, in pages, because a model reads rows but not
an Arrow stream; any other file comes back as itself.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final, cast

from streamlit.runtime.agent import snapshot as snapshot_module
from streamlit.runtime.agent.errors import AgentRequestError
from streamlit.runtime.media_file_storage import MediaFileStorageError

if TYPE_CHECKING:
    from streamlit.runtime import Runtime
    from streamlit.runtime.agent.interaction import AgentSessionRegistry
    from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage

ARROW_MIMETYPE: Final = "application/vnd.apache.arrow.stream"

# A response is bounded rather than truncated: a cut-off image or table page
# is useless, and the caller can always ask for fewer rows.
MAX_RESULT_BYTES: Final = 5 * 1024 * 1024
DEFAULT_ROW_LIMIT: Final = 1000

_ARGUMENTS: Final = {"session_id", "url", "offset", "limit"}


@dataclass(frozen=True)
class FileContent:
    """A file to return, with what a transport needs to label it."""

    file_id: str
    mimetype: str
    # A page of a table, as JSON; or the file's own bytes.
    table: dict[str, Any] | None = None
    content: bytes = b""


def get_data(
    runtime: Runtime,
    registry: AgentSessionRegistry,
    arguments: dict[str, Any],
    *,
    user_info: dict[str, Any],
) -> FileContent:
    """Resolve ``arguments["url"]`` against the session and read the file."""
    if unknown := set(arguments) - _ARGUMENTS:
        raise AgentRequestError(
            "invalid_request", f"Unknown arguments: {', '.join(sorted(unknown))}."
        )
    session_id = arguments.get("session_id")
    url = arguments.get("url")
    if not isinstance(session_id, str) or not isinstance(url, str):
        raise AgentRequestError(
            "invalid_request", "`session_id` and `url` are required strings."
        )
    offset = _whole_number(arguments.get("offset", 0), "offset", minimum=0)
    limit = _whole_number(arguments.get("limit", DEFAULT_ROW_LIMIT), "limit", minimum=1)

    session = registry.get(session_id, user_info)
    file_id = snapshot_module.media_file_id(url)
    if file_id not in session.media_ids:
        raise AgentRequestError(
            "unknown_file",
            "This session's latest result references no file at that URL. Pass a "
            "URL exactly as the latest result shows it.",
        )
    # The in-memory storage the server always configures, as its media route
    # also assumes.
    storage = cast("MemoryMediaFileStorage", runtime.media_file_mgr._storage)
    try:
        stored = storage.get_file(file_id)
    except MediaFileStorageError as exc:
        raise AgentRequestError(
            "unknown_file",
            "That file is no longer stored. Interact again for a fresh result.",
        ) from exc

    if stored.mimetype == ARROW_MIMETYPE:
        table = _table_page(stored.content, offset, limit)
        size = len(json.dumps(table, allow_nan=False))
        if size > MAX_RESULT_BYTES:
            raise AgentRequestError(
                "result_too_large",
                f"{limit} rows from offset {offset} are {size} bytes, over the "
                f"{MAX_RESULT_BYTES}-byte limit. Request fewer rows with `limit`.",
            )
        return FileContent(file_id=file_id, mimetype=stored.mimetype, table=table)

    if len(stored.content) > MAX_RESULT_BYTES:
        raise AgentRequestError(
            "result_too_large",
            f"The file is {len(stored.content)} bytes of {stored.mimetype}, over "
            f"the {MAX_RESULT_BYTES}-byte limit.",
        )
    return FileContent(
        file_id=file_id, mimetype=stored.mimetype, content=stored.content
    )


def _table_page(arrow_bytes: bytes, offset: int, limit: int) -> dict[str, Any]:
    """``limit`` rows from ``offset``, in the shape of a snapshot's preview."""
    import pyarrow as pa

    table = pa.RecordBatchStreamReader(arrow_bytes).read_all()
    rows = snapshot_module.arrow_rows(table, offset, limit)
    end = offset + len(rows)
    return {
        "columns": snapshot_module.arrow_columns(table),
        "row_count": table.num_rows,
        "offset": offset,
        "rows": rows,
        "next_offset": end if end < table.num_rows else None,
    }


def _whole_number(value: Any, name: str, *, minimum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise AgentRequestError(
            "invalid_request", f"`{name}` must be a whole number of at least {minimum}."
        )
    return value
