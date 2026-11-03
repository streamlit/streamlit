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

"""Tests for the MCP endpoint's messages and its `get_data` tool."""

from __future__ import annotations

import asyncio
import base64
import datetime as dt
import decimal
import json
from typing import TYPE_CHECKING, Any, Final
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pyarrow as pa
import pytest

from streamlit import dataframe_util, version
from streamlit.elements.lib import agent_data
from streamlit.runtime.agent import errors, mcp
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.media_file_storage import MediaFileKind
from streamlit.runtime.memory_media_file_storage import (
    MemoryMediaFileStorage,
    get_extension_for_mimetype,
)
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from pytest_benchmark.fixture import BenchmarkFixture

_FILE_ID: Final = "0123456789abcdef0123456789abcdef"
_ARROW: Final = agent_data.ARROW_MIMETYPE


@pytest.fixture
def storage() -> MemoryMediaFileStorage:
    return MemoryMediaFileStorage("/media")


@pytest.fixture
def media(storage: MemoryMediaFileStorage) -> MediaFileManager:
    return MediaFileManager(storage)


def _store(storage: MemoryMediaFileStorage, content: bytes, mimetype: str) -> str:
    """Store a file and return its URL as a snapshot shows it."""
    file_id = storage.load_and_get_id(content, mimetype, MediaFileKind.MEDIA)
    return f"../../media/{file_id}{get_extension_for_mimetype(mimetype)}"


def _arrow(frame: pd.DataFrame) -> bytes:
    return dataframe_util.convert_pandas_df_to_arrow_bytes(frame)


def _get_data(media: MediaFileManager, url: str, **arguments: Any) -> dict[str, Any]:
    """Call `get_data` and return its tool result."""
    parsed = mcp.parse_get_data_arguments(
        {"session_id": "s_1", "url": url, **arguments}
    )
    response = json.loads(mcp.render_get_data(7, media, parsed))
    assert response["id"] == 7
    result: dict[str, Any] = response["result"]
    return result


def _page(media: MediaFileManager, url: str, **arguments: Any) -> dict[str, Any]:
    """Call `get_data` on a table and return its page."""
    result = _get_data(media, url, **arguments)
    assert result["isError"] is False, result
    [content] = result["content"]
    assert content["type"] == "text"
    page: dict[str, Any] = json.loads(content["text"])
    return page


def _refused(result: dict[str, Any], code: str) -> str:
    """The message of a refused call, checked for its code."""
    assert result["isError"] is True
    [content] = result["content"]
    body = json.loads(content["text"])
    assert body["error"]["code"] == code
    message: str = body["error"]["message"]
    return message


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        (
            {"jsonrpc": "2.0", "id": 1, "method": "ping"},
            mcp.Message("request", 1, "ping"),
        ),
        (
            {"jsonrpc": "2.0", "id": "a", "method": "tools/list", "params": {"x": 1}},
            mcp.Message("request", "a", "tools/list", {"x": 1}),
        ),
        (
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            mcp.Message("notification", method="notifications/initialized"),
        ),
        ({"jsonrpc": "2.0", "id": 1, "result": {}}, mcp.Message("response")),
        ({"jsonrpc": "2.0", "id": None, "error": {}}, mcp.Message("response")),
        ([{"jsonrpc": "2.0", "id": 1, "method": "ping"}], mcp.Message("batch")),
        ([], mcp.Message("batch")),
        ({"jsonrpc": "1.0", "id": 1, "method": "ping"}, mcp.Message("invalid")),
        ({"id": 1, "method": "ping"}, mcp.Message("invalid")),
        ({"jsonrpc": "2.0", "id": 1, "method": 5}, mcp.Message("invalid")),
        ({"jsonrpc": "2.0", "id": True, "method": "ping"}, mcp.Message("invalid")),
        ({"jsonrpc": "2.0", "id": 1.5, "method": "ping"}, mcp.Message("invalid")),
        ({"jsonrpc": "2.0", "id": None, "method": "ping"}, mcp.Message("invalid")),
        ({"jsonrpc": "2.0", "id": "\ud800", "method": "ping"}, mcp.Message("invalid")),
        ({"jsonrpc": "2.0", "id": 1}, mcp.Message("invalid")),
        ("ping", mcp.Message("invalid")),
    ],
    ids=[
        "request",
        "request_with_params",
        "notification",
        "result",
        "error_without_id",
        "batch",
        "empty_batch",
        "wrong_version",
        "no_version",
        "method_not_text",
        "bool_id",
        "float_id",
        "null_id",
        "lone_surrogate_id",
        "neither",
        "not_an_object",
    ],
)
def test_classify_reads_each_message_kind(message: Any, expected: mcp.Message) -> None:
    """A request has a string or integer id, never null; a message without a
    method is a response only with an id and a result or error.
    """
    assert mcp.classify(message) == expected


@pytest.mark.parametrize(
    ("requested", "expected"),
    [
        ("2025-06-18", "2025-06-18"),
        ("2025-11-25", "2025-11-25"),
        ("2025-03-26", "2025-11-25"),
        ("2026-07-28", "2025-11-25"),
        (None, "2025-11-25"),
        (20250618, "2025-11-25"),
    ],
)
def test_negotiate_answers_a_supported_revision(requested: Any, expected: str) -> None:
    """A supported revision is echoed; anything else gets the newest."""
    assert mcp.negotiate(requested) == expected


def _request(method: str, params: Any = None) -> mcp.Message:
    return mcp.Message("request", 3, method, params)


@pytest.mark.parametrize("header", [None, "2025-11-25", "2026-07-28"])
def test_discover_is_always_refused_with_400_echoing_the_id(header: str | None) -> None:
    """`server/discover` gets -32600 at 400, the answer a `2026-07-28` client
    falls back to `initialize` from, whatever revision its header names.
    """
    refused = mcp.request_refusal(_request("server/discover"), header)

    assert refused is not None
    status, response = refused
    assert status == 400
    assert response["id"] == 3
    assert response["error"]["code"] == mcp.INVALID_REQUEST
    # No `data.supported`, which a client would read as a modern refusal.
    assert "data" not in response["error"]


@pytest.mark.parametrize(
    ("method", "header", "expected"),
    [
        ("tools/list", None, None),
        ("tools/list", "2025-06-18", None),
        ("tools/call", "2026-07-28", 400),
        ("ping", "2025-03-26", 400),
        ("initialize", "2026-07-28", None),
        ("resources/list", None, 200),
        ("resources/list", "2026-07-28", 200),
    ],
)
def test_request_refusal_reads_the_method_then_the_version_header(
    method: str, header: str | None, expected: int | None
) -> None:
    """A missing header is the newest revision. An unsupported one refuses an
    implemented method other than `initialize`, which negotiates in its body;
    an unknown method is -32601 whatever the header.
    """
    refused = mcp.request_refusal(_request(method), header)

    if expected is None:
        assert refused is None
        return
    assert refused is not None
    status, response = refused
    assert status == expected
    assert response["id"] == 3
    assert response["error"]["code"] == (
        mcp.METHOD_NOT_FOUND if expected == 200 else mcp.INVALID_REQUEST
    )
    assert method not in response["error"]["message"]


def test_initialize_reports_the_server_without_an_app_title() -> None:
    """`initialize` negotiates, advertises tools only, and names Streamlit."""
    response = mcp.answer(
        _request("initialize", {"protocolVersion": "2025-06-18"}),
        instructions="Read me.",
        tools=[],
    )

    assert response == {
        "jsonrpc": "2.0",
        "id": 3,
        "result": {
            "protocolVersion": "2025-06-18",
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {
                "name": "streamlit",
                "version": version.STREAMLIT_VERSION_STRING,
            },
            "instructions": "Read me.",
        },
    }


def test_initialize_params_must_be_an_object() -> None:
    """Missing `params` negotiate the newest revision; other values are -32602."""
    missing = mcp.answer(_request("initialize"), instructions="", tools=[])
    malformed = mcp.answer(_request("initialize", []), instructions="", tools=[])

    assert missing["result"]["protocolVersion"] == "2025-11-25"
    assert malformed["error"]["code"] == mcp.INVALID_PARAMS


def test_ping_and_tools_list_answer_without_running_anything() -> None:
    """`ping` is an empty result, and `tools/list` the tools it was given."""
    tools = [{"name": "interact"}]

    ping = mcp.answer(_request("ping"), instructions="", tools=tools)
    listed = mcp.answer(_request("tools/list"), instructions="", tools=tools)

    assert ping["result"] == {}
    assert listed["result"] == {"tools": tools}


def test_answer_refuses_a_method_that_runs_something() -> None:
    """`tools/call` is never answered as if it were `initialize`."""
    with pytest.raises(ValueError, match="run nothing"):
        mcp.answer(_request("tools/call"), instructions="", tools=[])


@pytest.mark.parametrize(
    ("params", "expected"),
    [
        ({"name": "interact"}, mcp.ToolCall("interact", {})),
        ({"name": "interact", "arguments": None}, mcp.ToolCall("interact", {})),
        (
            {"name": "get_data", "arguments": {"url": "x"}},
            mcp.ToolCall("get_data", {"url": "x"}),
        ),
        ({"name": "interact", "arguments": []}, None),
        ({"name": "interact", "arguments": "{}"}, None),
        ({"name": "browse"}, None),
        ({"name": ["interact"]}, None),
        ({}, None),
        (None, None),
    ],
    ids=[
        "no_arguments",
        "null_arguments",
        "arguments",
        "list_arguments",
        "text_arguments",
        "unknown_tool",
        "name_not_text",
        "no_name",
        "no_params",
    ],
)
def test_tool_call_reads_the_tool_and_its_arguments(
    params: Any, expected: mcp.ToolCall | None
) -> None:
    """A call without arguments has `{}`; anything but an object of
    arguments for one of the two tools is refused.
    """
    assert mcp.tool_call(_request("tools/call", params)) == expected


@pytest.mark.parametrize(
    "url",
    [
        _FILE_ID,
        f"{_FILE_ID}.png",
        f"../../media/{_FILE_ID}",
        f"../../media/{_FILE_ID}.png",
        # An extension from the platform's MIME database, not only letters.
        f"../../media/{_FILE_ID}.sfd-hdstx",
        f"media/{_FILE_ID}.csv",
        f"/base/media/{_FILE_ID}",
        f"https://host.example/~/+/media/{_FILE_ID}.png?x=1#f",
    ],
)
def test_media_file_id_reads_an_id_bare_or_in_a_media_url(url: str) -> None:
    """A bare id or a media URL, relative or absolute, names the same file."""
    assert mcp.media_file_id(url) == _FILE_ID


@pytest.mark.parametrize(
    "url",
    [
        "",
        "logo.png",
        "https://cdn.example.com/media/hero.png",
        "data:image/png;base64,iVBORw0KGgo=",
        f"../../app/static/{_FILE_ID}.png",
        f"../../media/{_FILE_ID}.tar.gz",
        f"../../media/{_FILE_ID.upper()}",
        f"../../media/{_FILE_ID[:-1]}",
        f"../../media/{_FILE_ID}0",
        f"../../media/{_FILE_ID}/",
        f"{_FILE_ID}.png?x=1",
        f"http://[::1/media/{_FILE_ID}",
    ],
    ids=[
        "empty",
        "file_name",
        "external_url",
        "data_url",
        "static_file",
        "two_extensions",
        "uppercase",
        "too_short",
        "too_long",
        "trailing_slash",
        "bare_with_query",
        "unclosed_ipv6_host",
    ],
)
def test_media_file_id_rejects_anything_else(url: str) -> None:
    """Static files, external URLs, and names that are not a media-file id
    are not media files.
    """
    assert mcp.media_file_id(url) is None


@pytest.mark.parametrize(
    "arguments",
    [
        {},
        {"url": "x"},
        {"session_id": None, "url": "x"},
        {"session_id": 1, "url": "x"},
        {"session_id": "s_1"},
        {"session_id": "s_1", "url": None},
        {"session_id": "s_1", "url": "x", "format": "csv"},
    ],
    ids=[
        "empty",
        "no_session",
        "null_session",
        "session_not_text",
        "no_url",
        "null_url",
        "unknown_field",
    ],
)
def test_get_data_arguments_are_refused_unless_well_formed(
    arguments: dict[str, Any],
) -> None:
    """A missing or malformed `session_id` or `url`, or an unknown field, is
    `invalid_request`; a missing `session_id` never means a new session.
    """
    with pytest.raises(errors.AgentRequestError) as raised:
        mcp.parse_get_data_arguments(arguments)

    assert raised.value.code == "invalid_request"


def test_get_data_keeps_offset_and_limit_as_sent_and_null_as_the_default() -> None:
    """Bounds are read only for a table, so parsing accepts any value, and
    `null` is the default, as omitting a bound is.
    """
    parsed = mcp.parse_get_data_arguments(
        {"session_id": "s_1", "url": "x", "limit": 0, "offset": "a"}
    )
    defaults = mcp.parse_get_data_arguments({"session_id": "s_1", "url": "x"})
    nulls = mcp.parse_get_data_arguments(
        {"session_id": "s_1", "url": "x", "offset": None, "limit": None}
    )

    assert (parsed.offset, parsed.limit) == ("a", 0)
    assert (defaults.offset, defaults.limit) == (0, mcp.PAGE_ROWS)
    assert (nulls.offset, nulls.limit) == (0, mcp.PAGE_ROWS)


@patch_config_options({"server.agentSessionTTL": 120})
def test_unknown_session_message_never_says_to_omit_the_session() -> None:
    """`get_data` cannot start a session, so its message points at `interact`,
    and it states the configured session TTL.
    """
    message = mcp.unknown_session_message()

    assert "2 minutes" in message
    assert "Call `interact` without `session_id`" in message
    assert "Omit" not in message


def test_table_page_matches_the_specs_example(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A page is compact JSON in the documented field order, here the product
    spec's example, so the text is exactly what `json.dumps` writes for it.
    """
    frame = pd.DataFrame(
        {
            "country": ["Germany", "France"] * 2500,
            "net_revenue": [284000, 197250] * 2500,
        }
    )
    url = _store(storage, _arrow(frame), _ARROW)

    result = _get_data(media, url, offset=100, limit=2)

    [content] = result["content"]
    page = json.loads(content["text"])
    assert list(page) == list(mcp.PAGE_FIELDS)
    assert page["rows"] == [["Germany", 284000], ["France", 197250]]
    assert (page["row_count"], page["offset"], page["next_offset"]) == (5000, 100, 102)
    assert content["text"] == json.dumps(
        page, ensure_ascii=False, separators=(",", ":")
    )
    assert "structuredContent" not in result


def test_table_pages_follow_next_offset_to_the_end(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """Pages from the preview's end hold `limit` rows, the last ends with a
    null `next_offset`, and an offset past the end is an empty page.
    """
    url = _store(storage, _arrow(pd.DataFrame({"n": range(1100)})), _ARROW)

    first = _page(media, url, offset=100)
    last = _page(media, url, offset=first["next_offset"])
    past = _page(media, url, offset=5000, limit=10)

    assert len(first["rows"]) == mcp.PAGE_ROWS
    assert first["next_offset"] == 600
    assert [row[0] for row in last["rows"]] == list(range(600, 1100))
    assert last["next_offset"] is None
    assert past == {
        "columns": first["columns"],
        "row_count": 1100,
        "offset": 5000,
        "rows": [],
        "next_offset": None,
    }


def test_a_wide_table_page_ends_within_the_character_budget(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """The budget cuts a wide table's page short, `next_offset` is the first
    row not returned, and following it loses no row.
    """
    frame = pd.DataFrame(
        {
            f"column_{i}": [f"value {i} {n:05}" * 3 for n in range(400)]
            for i in range(33)
        }
    )
    url = _store(storage, _arrow(frame), _ARROW)
    expected = agent_data.arrow_rows(
        agent_data.read_arrow_stream(_arrow(frame)), limit=400
    )

    rows: list[list[Any]] = []
    offset: int | None = 0
    pages = 0
    while offset is not None:
        result = _get_data(media, url, offset=offset)
        text = result["content"][0]["text"]
        page = json.loads(text)
        assert len(text) <= mcp.PAGE_CHARACTERS
        assert 0 < len(page["rows"]) < mcp.PAGE_ROWS
        assert page["next_offset"] in {offset + len(page["rows"]), None}
        rows.extend(page["rows"])
        offset = page["next_offset"]
        pages += 1

    assert rows == expected
    assert pages > 1


def test_a_page_holds_at_least_one_row(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A row past the character budget is still returned, alone."""
    frame = pd.DataFrame({"text": ["x" * 50_000, "y"]})
    url = _store(storage, _arrow(frame), _ARROW)

    page = _page(media, url)

    assert page["rows"] == [["x" * 50_000]]
    assert page["next_offset"] == 1


def test_a_page_of_large_cells_converts_few_rows_past_it(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """Rows are converted in chunks that grow from one row, so a page that
    ends after one large row converts only a few of the rows after it.
    """
    frame = pd.DataFrame({"text": [f"{n:03}" + "x" * 30_000 for n in range(300)]})
    url = _store(storage, _arrow(frame), _ARROW)

    with patch.object(
        agent_data, "arrow_rows", wraps=agent_data.arrow_rows
    ) as arrow_rows:
        page = _page(media, url, offset=10)

    assert page["rows"] == [[f"010{'x' * 30_000}"]]
    assert page["next_offset"] == 11
    assert sum(call.kwargs["limit"] for call in arrow_rows.call_args_list) <= 3


def test_a_row_past_the_size_cap_is_refused_by_its_offset(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A row that makes the response pass 5 MB is refused rather than cut,
    and the message says where to read on.
    """
    frame = pd.DataFrame({"text": ["small", "x" * mcp.MAX_RESULT_BYTES, "small"]})
    url = _store(storage, _arrow(frame), _ARROW)

    message = _refused(_get_data(media, url, offset=1), "result_too_large")

    assert "row at offset 1" in message
    assert "offset 2" in message
    assert _page(media, url, offset=2)["rows"] == [["small"]]


def test_columns_past_the_size_cap_are_refused_as_the_whole_file(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """When a table's columns alone make the response pass 5 MB, the refusal
    does not blame a row and point to the next offset, since every page
    repeats the columns.
    """
    name_length = 10_000
    names = [
        f"{index:04d}{'c' * name_length}"
        for index in range(mcp.MAX_RESULT_BYTES // name_length + 1)
    ]
    frame = pd.DataFrame([range(len(names))], columns=names)
    url = _store(storage, _arrow(frame), _ARROW)

    message = _refused(_get_data(media, url), "result_too_large")

    assert "offset" not in message
    assert "neither a retry nor a smaller `limit` helps" in message


@pytest.mark.parametrize(
    ("offset", "limit"),
    # Infinity is what `json.loads` makes of a number too large for a float,
    # such as `1e999`.
    [
        (-1, 10),
        (True, 10),
        (1.5, 10),
        (float("inf"), 10),
        ("1", 10),
        (0, 0),
        (0, False),
    ],
)
def test_table_bounds_must_be_integers(
    storage: MemoryMediaFileStorage, media: MediaFileManager, offset: Any, limit: Any
) -> None:
    """On a table, `offset` and `limit` are integers of at least 0 and 1."""
    url = _store(storage, _arrow(pd.DataFrame({"n": range(3)})), _ARROW)

    _refused(_get_data(media, url, offset=offset, limit=limit), "invalid_request")


def test_null_table_bounds_read_the_first_page(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """`null` for `offset` and `limit` pages a table as omitting them does."""
    url = _store(storage, _arrow(pd.DataFrame({"n": range(3)})), _ARROW)

    assert _page(media, url, offset=None, limit=None) == _page(media, url)


def test_integral_floats_count_as_integers(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """`1.0` counts as `1`, as JSON Schema's `integer` has it."""
    url = _store(storage, _arrow(pd.DataFrame({"n": range(3)})), _ARROW)

    page = _page(media, url, offset=1.0, limit=1.0)

    assert (page["offset"], page["rows"], page["next_offset"]) == (1, [[1]], 2)


def test_table_pages_match_the_snapshots_preview_encoding(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A page encodes every cell as `data.preview` does, and lists the same
    columns, an unnamed index included.
    """
    frame = pd.DataFrame(
        {
            "date": [dt.date(2026, 1, 2)] * 3,
            "when": pd.to_datetime(["2026-01-02T03:04:05"] * 3),
            "ratio": [1.5, np.nan, float("inf")],
            "price": [decimal.Decimal("1.10")] * 3,
            "blob": [b"abc"] * 3,
            "period": pd.period_range("2024-01", periods=3, freq="M"),
            "interval": pd.interval_range(0, 3),
            "big": pd.array([2**60, None, 1], dtype="Int64"),
        },
        index=pd.Index(["a", "b", "c"]),
    )
    arrow_bytes = _arrow(frame)
    url = _store(storage, arrow_bytes, _ARROW)

    page = _page(media, url, offset=1)
    summary = agent_data.summarize_arrow(arrow_bytes)

    assert summary is not None
    assert page["columns"] == summary["columns"]
    assert page["columns"][-1]["name"] == "__index_level_0__"
    assert page["rows"] == summary["preview"]["rows"][1:]
    assert page["rows"][0][2] is None


def test_a_table_without_columns_still_has_its_rows(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A table with rows but no columns pages as empty rows."""
    table = pa.table({"a": [1, 2, 3]}).drop_columns(["a"])
    url = _store(
        storage, dataframe_util.convert_arrow_table_to_arrow_bytes(table), _ARROW
    )

    page = _page(media, url, offset=1)

    assert (page["rows"], page["next_offset"]) == ([[], []], None)


_PNG: Final = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
)


@pytest.mark.parametrize(
    ("mimetype", "content_type", "mime_type"),
    [
        ("image/png", "image", "image/png"),
        ("image/jpeg", "image", "image/jpeg"),
        ("image/gif", "image", "image/gif"),
        ("image/webp", "image", "image/webp"),
        ("IMAGE/PNG; foo=bar", "image", "image/png"),
        ("audio/wav", "audio", "audio/wav"),
        ("audio/x-wav", "audio", "audio/x-wav"),
        ("audio/mpeg", "audio", "audio/mpeg"),
        ("audio/mp3", "audio", "audio/mp3"),
    ],
)
def test_images_and_audio_that_models_accept_are_media_content(
    storage: MemoryMediaFileStorage,
    media: MediaFileManager,
    mimetype: str,
    content_type: str,
    mime_type: str,
) -> None:
    """The image and audio types model inputs accept come back as base64
    content, and `limit` and `offset` are ignored, invalid values included.
    """
    url = _store(storage, _PNG, mimetype)

    result = _get_data(media, url, limit=0, offset=-3)

    assert result == {
        "content": [
            {
                "type": content_type,
                "data": base64.b64encode(_PNG).decode(),
                "mimeType": mime_type,
            }
        ],
        "isError": False,
    }


@pytest.mark.parametrize(
    ("mimetype", "content"),
    [
        ("text/csv; charset=utf-8", "a,b\n1,ä\n"),
        ("text/plain", "hello"),
        ("application/json", '{"a": 1}'),
        ("image/svg+xml", "<svg/>"),
    ],
)
def test_text_files_are_text_content(
    storage: MemoryMediaFileStorage,
    media: MediaFileManager,
    mimetype: str,
    content: str,
) -> None:
    """Text, JSON, and SVG come back whole, as text."""
    url = _store(storage, content.encode(), mimetype)

    assert _get_data(media, url)["content"] == [{"type": "text", "text": content}]


@pytest.mark.parametrize(
    ("mimetype", "content"),
    [
        ("image/bmp", _PNG),
        ("audio/ogg", b"OggS"),
        ("application/pdf", b"%PDF-1.7"),
        ("text/plain", b"\xff\xfe not utf-8"),
        (_ARROW, b"not an arrow stream"),
    ],
    ids=["bmp", "ogg", "pdf", "not_utf8_text", "arrow_type_not_arrow"],
)
def test_other_files_are_embedded_resources(
    storage: MemoryMediaFileStorage,
    media: MediaFileManager,
    mimetype: str,
    content: bytes,
) -> None:
    """Every other file, and text that is not UTF-8 or an Arrow-typed file
    that does not decode, is an embedded resource named by a URN, and ignores
    `limit`.
    """
    url = _store(storage, content, mimetype)
    file_id = mcp.media_file_id(url)

    result = _get_data(media, url, limit=0)

    assert result["content"] == [
        {
            "type": "resource",
            "resource": {
                "uri": f"urn:streamlit:media:{file_id}",
                "mimeType": mimetype,
                "blob": base64.b64encode(content).decode(),
            },
        }
    ]


def test_a_file_past_the_cap_is_refused_before_encoding(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A binary whose base64 passes 5 MB is refused without being encoded,
    though the file itself is smaller; one just within the cap is returned.
    """
    too_large = _store(storage, b"\0" * 3_750_001, "image/png")
    within = _store(storage, b"\1" * 3_740_000, "image/png")

    with patch.object(mcp.base64, "b64encode") as encode:
        message = _refused(_get_data(media, too_large), "result_too_large")
    encode.assert_not_called()
    result = _get_data(media, within)

    assert "5 MB" in message
    assert result["isError"] is False


def test_a_large_text_file_is_refused_whole(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A text file whose response passes 5 MB is refused, not truncated."""
    url = _store(storage, b'"' * 3_000_000, "text/plain")

    _refused(_get_data(media, url), "result_too_large")


def test_unknown_file_says_whether_url_is_a_media_file(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A media URL whose file is gone points at the latest result; anything
    else is not a media file, and calling again would fail the same way.
    """
    url = _store(storage, _PNG, "image/png")
    storage.delete_file(mcp.media_file_id(url) or "")

    gone = _refused(_get_data(media, url), "unknown_file")
    not_media = _refused(_get_data(media, "logo.png"), "unknown_file")

    assert "latest result" in gone
    assert "do not call `get_data` for it again" not in gone
    assert "do not call `get_data` for it again" in not_media


def test_a_storage_that_cannot_return_files_refuses_every_url() -> None:
    """A storage a host plugs in cannot be read back, so every URL, even one
    that is no media URL, is `read_unsupported` rather than `unknown_file`.
    """
    media = MediaFileManager(MagicMock())

    for url in (f"../../media/{_FILE_ID}", "logo.png"):
        message = _refused(_get_data(media, url), "read_unsupported")
        assert "no retry helps" in message


def test_an_unexpected_failure_hides_its_cause(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A read that fails unexpectedly is logged, and the result names no cause."""
    url = _store(storage, _arrow(pd.DataFrame({"n": range(3)})), _ARROW)

    with (
        patch.object(mcp, "table_page", side_effect=RuntimeError("secret detail")),
        patch.object(mcp._LOGGER, "exception") as log_exception,
    ):
        result = _get_data(media, url)

    message = _refused(result, "internal_error")
    assert "secret detail" not in message
    log_exception.assert_called_once()


def test_rows_that_cannot_be_converted_say_so_without_a_traceback(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """A table whose rows neither Python nor Arrow can convert, as its
    snapshot preview could not, is refused with what to do, and is not
    logged as an unexpected failure on every read.
    """
    unknown_zone = pa.timestamp("s", tz="Not/AZone")
    table = pa.table({"at": pa.array([0, None], unknown_zone)})
    url = _store(
        storage, dataframe_util.convert_arrow_table_to_arrow_bytes(table), _ARROW
    )

    with patch.object(mcp._LOGGER, "exception") as log_exception:
        message = _refused(_get_data(media, url), "internal_error")

    assert "cannot convert to JSON" in message
    assert "Report that" in message
    log_exception.assert_not_called()


def test_the_documented_size_cap_is_the_enforced_one() -> None:
    """The error catalog states the cap `get_data` enforces."""
    megabytes = f"{mcp.MAX_RESULT_BYTES // 1_000_000} MB"

    assert megabytes in errors.MCP_ERROR_CATALOG["result_too_large"]


# Four int64 columns of six million rows: an Arrow stream of about 192 MB,
# near the 200 MB `server.maxMessageSize` a served table inherits.
_LARGE_TABLE_ROWS: Final = 6_000_000


@pytest.fixture(scope="module")
def large_table() -> tuple[MediaFileManager, mcp.GetDataArguments]:
    """A stored table near the size limit, and arguments for a middle page."""
    storage = MemoryMediaFileStorage("/media")
    values = np.arange(_LARGE_TABLE_ROWS, dtype=np.int64)
    table = pa.table(dict.fromkeys("abcd", values))
    url = _store(
        storage, dataframe_util.convert_arrow_table_to_arrow_bytes(table), _ARROW
    )
    arguments = mcp.parse_get_data_arguments(
        {"session_id": "s_1", "url": url, "offset": _LARGE_TABLE_ROWS // 2}
    )
    return MediaFileManager(storage), arguments


@pytest.mark.usefixtures("benchmark")
def test_a_page_of_a_large_table_performance(
    benchmark: BenchmarkFixture,
    large_table: tuple[MediaFileManager, mcp.GetDataArguments],
) -> None:
    """Reading a page costs what the page does, not what the file does."""
    media, arguments = large_table

    body = benchmark(mcp.render_get_data, 1, media, arguments)

    page = json.loads(json.loads(body)["result"]["content"][0]["text"])
    assert len(page["rows"]) == mcp.PAGE_ROWS


@pytest.mark.usefixtures("benchmark")
def test_concurrent_pages_of_a_large_table_performance(
    benchmark: BenchmarkFixture,
    large_table: tuple[MediaFileManager, mcp.GetDataArguments],
) -> None:
    """Eight reads at once, each in a worker thread as the route runs them."""
    media, arguments = large_table

    async def read_concurrently() -> list[bytes]:
        return await asyncio.gather(
            *(
                asyncio.to_thread(mcp.render_get_data, n, media, arguments)
                for n in range(8)
            )
        )

    bodies = benchmark(lambda: asyncio.run(read_concurrently()))

    assert len({body.split(b',"result"', 1)[1] for body in bodies}) == 1


@patch_config_options({"server.agentPreviewRows": 2})
def test_pages_start_where_the_preview_ends(
    storage: MemoryMediaFileStorage, media: MediaFileManager
) -> None:
    """Starting at the length of `data.preview.rows` continues the preview."""
    arrow_bytes = _arrow(pd.DataFrame({"n": range(5)}))
    summary = agent_data.summarize_arrow(arrow_bytes)
    url = _store(storage, arrow_bytes, _ARROW)

    assert summary is not None
    preview = summary["preview"]["rows"]
    page = _page(media, url, offset=len(preview))

    assert preview + page["rows"] == [[n] for n in range(5)]
