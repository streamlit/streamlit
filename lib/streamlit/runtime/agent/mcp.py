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

"""The agent API as an MCP server: its JSON-RPC messages and its ``get_data`` tool.

The route at ``/_stcore/agent/mcp`` implements MCP's Streamable HTTP transport
in its simplest form: one JSON-RPC message per ``POST``, answered with a JSON
body, with no event stream and no MCP session. It answers ``initialize``,
``ping``, ``tools/list``, and ``tools/call``. Its two tools are fixed, because
MCP does not let a tool list change during a connection while an app's action
space changes after every run: ``interact`` is the agent API's one operation,
and ``get_data`` reads the media files a result points to, for clients that
cannot fetch a URL.

This module classifies messages, answers the methods that run nothing, and
reads files for ``get_data``. The route applies the agent API's checks and runs
``interact``, and ``protocol`` describes both tools to the model.
"""

from __future__ import annotations

import base64
import re
from typing import TYPE_CHECKING, Any, Final, Literal, NamedTuple, TypeAlias
from urllib.parse import urlsplit

from streamlit import config, version
from streamlit.elements.lib import agent_data
from streamlit.logger import get_logger
from streamlit.runtime.agent import errors, interaction, json_encoding
from streamlit.runtime.agent.errors import AgentRequestError

if TYPE_CHECKING:
    from collections.abc import Iterator, Mapping

    import pyarrow as pa

    from streamlit.runtime.media_file_manager import MediaFileManager
    from streamlit.runtime.memory_media_file_storage import MemoryFile

_LOGGER: Final = get_logger(__name__)

# The `initialize` handshake revisions the common clients speak, newest first.
# A client that asks for any other revision is offered the first, and then
# continues with it or disconnects.
PROTOCOL_VERSIONS: Final = ("2025-11-25", "2025-06-18")
PROTOCOL_VERSION_HEADER: Final = "MCP-Protocol-Version"

_SERVER_NAME: Final = "streamlit"
TOOL_NAMES: Final = ("interact", "get_data")

# JSON-RPC 2.0's error codes.
PARSE_ERROR: Final = -32700
INVALID_REQUEST: Final = -32600
METHOD_NOT_FOUND: Final = -32601
INVALID_PARAMS: Final = -32602
INTERNAL_ERROR: Final = -32603

_METHODS: Final = frozenset({"initialize", "ping", "tools/list", "tools/call"})

# The `2026-07-28` revision's probe. `request_refusal` answers it with HTTP 400
# and -32600, which `2026-07-28` clients read as "fall back to `initialize`".
# They do not fall back from a -32022 that lists a revision of that era, or
# from a 401, 403, or 5xx.
_DISCOVER_METHOD: Final = "server/discover"

# What `get_data` returns at most: rows per table page, characters in a page's
# text, and bytes in the encoded response. The page budget keeps a wide
# table's page within what clients pass to a model; the response cap refuses a
# file rather than cut it off.
PAGE_ROWS: Final = 500
PAGE_CHARACTERS: Final = 40_000
MAX_RESULT_BYTES: Final = 5_000_000

GET_DATA_FIELDS: Final = ("session_id", "url", "offset", "limit")
# A table page's fields, in the order its text lists them.
PAGE_FIELDS: Final = ("columns", "row_count", "offset", "rows", "next_offset")

# Rows converted at a time while a page fills, so a large `limit` on a wide
# table converts little more than the rows that fit.
_ROW_CHUNK: Final = 100

# What media storage names a file by: a 32-character hex digest, followed in a
# URL by the extension of its type, if the type has one. Extensions come from
# the platform's MIME database and can hold more than letters and digits, such
# as `.sfd-hdstx`.
_MEDIA_FILE_NAME: Final = re.compile(r"(?P<id>[0-9a-f]{32})(?:\.[^./?#]+)?")

# Content types by a file's media type. Images and audio are the formats
# Anthropic's and OpenAI's model inputs accept: one block a model rejects can
# fail a whole turn in some clients, so other types go as embedded resources.
_IMAGE_TYPES: Final = frozenset({"image/png", "image/jpeg", "image/gif", "image/webp"})
_AUDIO_TYPES: Final = frozenset({"audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"})
# `image/svg+xml` is XML text.
_TEXT_TYPES: Final = frozenset({"application/json", "image/svg+xml"})

_DISCOVER_MESSAGE: Final = (
    "This server does not implement `server/discover`. Connect with "
    f"`initialize`, at protocol revision {' or '.join(PROTOCOL_VERSIONS)}."
)
_VERSION_MESSAGE: Final = (
    f"Unsupported `{PROTOCOL_VERSION_HEADER}`. This server speaks protocol "
    f"revisions {' and '.join(PROTOCOL_VERSIONS)}, negotiated with `initialize`."
)
_METHOD_MESSAGE: Final = (
    "Method not found. This server implements `initialize`, `ping`, "
    "`tools/list`, and `tools/call`."
)
_TOOL_CALL_MESSAGE: Final = (
    "`params` must name a tool of this server, `interact` or `get_data`, and "
    "give its `arguments` as an object."
)
_NOT_A_MEDIA_FILE_MESSAGE: Final = (
    "`url` is not a media file this app stores, such as a static file, an "
    "external URL, or a `data:` URL, so do not call `get_data` for it again: "
    "the same argument fails the same way."
)
_GONE_MESSAGE: Final = (
    "No stored file has this id: a later run may have replaced it, or a run "
    "in progress has not re-created it yet. Pass `url` as the latest result "
    "shows it. If a run is still in progress, call `interact` with only "
    "`session_id` to collect it first. Do not call `interact` just to "
    "re-create a file."
)
_FILE_TOO_LARGE_MESSAGE: Final = (
    f"This file makes a result past {MAX_RESULT_BYTES // 1_000_000} MB, which "
    "`get_data` does not return, so neither a retry nor a smaller `limit` helps."
)

MessageKind: TypeAlias = Literal[
    "request", "notification", "response", "batch", "invalid"
]


class Message(NamedTuple):
    """A JSON-RPC message, as ``classify`` read it."""

    kind: MessageKind
    # A request's id and params as sent, and the method of a request or a
    # notification. None where the message has none.
    id: str | int | None = None
    method: str | None = None
    params: Any = None


class ToolCall(NamedTuple):
    """The tool a ``tools/call`` request names, and its arguments."""

    name: str
    arguments: dict[str, Any]


class GetDataArguments(NamedTuple):
    """The arguments of a ``get_data`` call."""

    session_id: str
    url: str
    # As sent, or the default when omitted or null: they are checked only for
    # a table, since every other file ignores them, invalid values included.
    offset: Any
    limit: Any


class ReadRefusedError(Exception):
    """A ``get_data`` read refused with one of the MCP-only error codes."""

    def __init__(self, code: errors.McpErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def classify(message: Any) -> Message:
    """Read what kind of JSON-RPC message a parsed body is.

    A request has a string or integer ``id``, never ``null``, as MCP requires.
    An ``id`` that is not valid Unicode, which JSON allows as a lone surrogate
    escape, makes the message invalid, since a response could not carry it.
    """
    if isinstance(message, list):
        return Message("batch")
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return Message("invalid")
    if "method" not in message:
        is_response = "id" in message and ("result" in message or "error" in message)
        return Message("response" if is_response else "invalid")
    method = message["method"]
    if not isinstance(method, str):
        return Message("invalid")
    if "id" not in message:
        return Message("notification", method=method)
    request_id = message["id"]
    if not _is_request_id(request_id):
        return Message("invalid")
    return Message("request", request_id, method, message.get("params"))


def _is_request_id(value: Any) -> bool:
    """Whether ``value`` can be a request's ``id``: an integer, or text a
    response can carry.
    """
    if isinstance(value, int):
        return not isinstance(value, bool)
    if not isinstance(value, str):
        return False
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return True


def negotiate(requested: Any) -> str:
    """The protocol revision to answer an ``initialize`` that asked for ``requested``."""
    return requested if requested in PROTOCOL_VERSIONS else PROTOCOL_VERSIONS[0]


def request_refusal(
    message: Message, version_header: str | None
) -> tuple[int, dict[str, Any]] | None:
    """The HTTP status and JSON-RPC error for a request this server does not
    answer, or None for one it does.

    ``version_header`` is the request's ``MCP-Protocol-Version``. Without one,
    a request is read at the newest revision: some clients omit it after
    ``initialize``, and with no MCP session there is no negotiated revision to
    recall. ``initialize`` is never refused for it, since the handshake
    negotiates in its body, and a client falling back from the ``2026-07-28``
    probe may still send that probe's header.
    """
    if message.method == _DISCOVER_METHOD:
        return 400, jsonrpc_error(message.id, INVALID_REQUEST, _DISCOVER_MESSAGE)
    if message.method not in _METHODS:
        return 200, jsonrpc_error(message.id, METHOD_NOT_FOUND, _METHOD_MESSAGE)
    if (
        message.method != "initialize"
        and version_header is not None
        and version_header not in PROTOCOL_VERSIONS
    ):
        return 400, jsonrpc_error(message.id, INVALID_REQUEST, _VERSION_MESSAGE)
    return None


def answer(
    message: Message, *, instructions: str, tools: list[dict[str, Any]]
) -> dict[str, Any]:
    """The response to ``initialize``, ``ping``, or ``tools/list``, none of
    which runs anything.

    Raises
    ------
    ValueError
        For any other method.
    """
    if message.method == "ping":
        return jsonrpc_result(message.id, {})
    if message.method == "tools/list":
        return jsonrpc_result(message.id, {"tools": tools})
    if message.method != "initialize":
        raise ValueError("Only `initialize`, `ping`, and `tools/list` run nothing.")
    params = {} if message.params is None else message.params
    if not isinstance(params, dict):
        return jsonrpc_error(message.id, INVALID_PARAMS, "`params` must be an object.")
    return jsonrpc_result(
        message.id,
        {
            "protocolVersion": negotiate(params.get("protocolVersion")),
            "capabilities": {"tools": {"listChanged": False}},
            # No title: Streamlit has no reliable source for an app's title.
            "serverInfo": {
                "name": _SERVER_NAME,
                "version": version.STREAMLIT_VERSION_STRING,
            },
            "instructions": instructions,
        },
    )


def tool_call(message: Message) -> ToolCall | None:
    """The tool a ``tools/call`` request names and its arguments, or None
    when its ``params`` name no tool of this server or give arguments that
    are not an object.

    A call without ``arguments``, or with ``null`` for them, has ``{}``.
    """
    params = message.params
    if not isinstance(params, dict) or params.get("name") not in TOOL_NAMES:
        return None
    arguments = params.get("arguments")
    if arguments is None:
        arguments = {}
    if not isinstance(arguments, dict):
        return None
    return ToolCall(params["name"], arguments)


def tool_call_refusal(message: Message) -> dict[str, Any]:
    """The JSON-RPC error for a ``tools/call`` that ``tool_call`` refused."""
    return jsonrpc_error(message.id, INVALID_PARAMS, _TOOL_CALL_MESSAGE)


def jsonrpc_result(
    request_id: str | int | None, result: dict[str, Any]
) -> dict[str, Any]:
    """A JSON-RPC response with ``result``."""
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def jsonrpc_error(
    request_id: str | int | None, code: int, message: str
) -> dict[str, Any]:
    """A JSON-RPC error response. ``request_id`` is None when it cannot be read."""
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def tool_result(text: str, *, is_error: bool) -> dict[str, Any]:
    """A tool result of one text block.

    Text only, without ``structuredContent``: every client reads text, and
    one that passes both to the model would pay for each result twice.
    """
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def tool_error(
    code: errors.AgentErrorCode | errors.McpErrorCode, message: str
) -> dict[str, Any]:
    """A refused tool call, whose text is an agent API error body."""
    return tool_result(
        json_encoding.dumps(errors.error_body(code, message)), is_error=True
    )


def parse_get_data_arguments(arguments: Mapping[str, Any]) -> GetDataArguments:
    """Read a ``get_data`` call's arguments.

    ``null`` for ``offset`` or ``limit`` is the same as omitting it, as
    ``null`` in any field of an ``interact`` request but ``session_id`` is.
    Error messages never echo the caller's values, which may be untrusted or
    not valid Unicode.

    Raises
    ------
    AgentRequestError
        ``invalid_request`` for an unknown field, or a missing or non-string
        ``session_id`` or ``url``. Omitting ``session_id`` never creates a
        session: ``get_data`` runs no app code.
    """
    if not set(arguments).issubset(GET_DATA_FIELDS):
        raise AgentRequestError(
            "invalid_request",
            "`get_data` takes only `session_id`, `url`, `offset`, and `limit`.",
        )
    session_id = arguments.get("session_id")
    if not isinstance(session_id, str):
        raise AgentRequestError(
            "invalid_request",
            "`session_id` must be the string an `interact` result carries. "
            "`get_data` cannot start a session: call `interact` without "
            "`session_id` to start one.",
        )
    url = arguments.get("url")
    if not isinstance(url, str):
        raise AgentRequestError(
            "invalid_request",
            "`url` must be a string: a media URL as an `interact` result shows it.",
        )
    offset = arguments.get("offset")
    limit = arguments.get("limit")
    return GetDataArguments(
        session_id=session_id,
        url=url,
        offset=0 if offset is None else offset,
        limit=PAGE_ROWS if limit is None else limit,
    )


def unknown_session_message() -> str:
    """The ``unknown_session`` message of ``get_data``, which, unlike
    ``interact``, cannot start a session. It states ``server.agentSessionTTL``.
    """
    session_ttl = float(config.get_option("server.agentSessionTTL"))
    return (
        "This session does not exist or has expired: sessions end after "
        f"{interaction.format_duration(session_ttl)} without a call. `get_data` "
        "cannot start a session. Call `interact` without `session_id` to start "
        "one, and read the files its result lists."
    )


def media_file_id(url: str) -> str | None:
    """The media-file id ``url`` names, or None if it names none.

    Read from its shape alone, never fetched or joined to a path: a bare id,
    or the last segment of a URL, relative or absolute, whose path ends in
    ``media/<id>``, each with at most one extension. So
    ``../../media/<id>.png``, that URL resolved behind any prefix, and
    ``<id>`` name the same file. Only the id grants access, so reading it
    from an absolute URL adds no exposure.
    """
    if "/" in url:
        segments = urlsplit(url).path.split("/")
        if len(segments) < 2 or segments[-2] != "media":
            return None
        url = segments[-1]
    match = _MEDIA_FILE_NAME.fullmatch(url)
    return match["id"] if match else None


def render_get_data(
    request_id: str | int | None,
    media: MediaFileManager,
    arguments: GetDataArguments,
) -> bytes:
    """Read the file a ``get_data`` call names, and render the response.

    Runs in a worker thread, since a page of a large table or a large file
    takes a while to read and encode. The caller has already checked the
    call's session.

    Every refusal is a tool result, so a client that hides protocol errors
    from the model still shows it the next step. A response past
    ``MAX_RESULT_BYTES`` is refused whole rather than cut short, so no cell
    value is silently lost.
    """
    table_offset: int | None = None
    try:
        result, table_offset = _read(media, arguments)
    except (AgentRequestError, ReadRefusedError) as exc:
        result = tool_error(exc.code, exc.message)
    except Exception:
        _LOGGER.exception("The MCP endpoint's get_data tool failed to read a file.")
        # The cause is in the server log; the result does not name it.
        result = tool_error("internal_error", "The file could not be read.")
    body = json_encoding.response_body(jsonrpc_result(request_id, result))
    if len(body) <= MAX_RESULT_BYTES:
        return body
    if table_offset is None:
        message = _FILE_TOO_LARGE_MESSAGE
    else:
        # Only a page's first row can pass the cap: a page of several rows
        # stays within its character budget, far below it.
        message = (
            f"The table row at offset {table_offset} alone makes a result "
            f"past {MAX_RESULT_BYTES // 1_000_000} MB, so neither a retry "
            f"nor a smaller `limit` helps. Read on from offset {table_offset + 1}."
        )
    return json_encoding.response_body(
        jsonrpc_result(request_id, tool_error("result_too_large", message))
    )


def _read(
    media: MediaFileManager, arguments: GetDataArguments
) -> tuple[dict[str, Any], int | None]:
    """The tool result for a file, and the offset of its page if it is a table."""
    # Checked before the argument is read, so an id in a custom storage's own
    # format is never called "not a media file".
    if not media.can_read_files:
        # The catalog's meaning is the whole message: nothing in the call
        # changes what the model should do.
        raise ReadRefusedError(
            "read_unsupported", errors.MCP_ERROR_CATALOG["read_unsupported"]
        )
    file_id = media_file_id(arguments.url)
    if file_id is None:
        raise ReadRefusedError("unknown_file", _NOT_A_MEDIA_FILE_MESSAGE)
    stored = media.read_file(file_id)
    if stored is None:
        raise ReadRefusedError("unknown_file", _GONE_MESSAGE)

    # The type the file was stored with, compared as the content-type check
    # compares it: without regard to case, and without parameters.
    media_type = stored.mimetype.split(";", 1)[0].strip().lower()
    if media_type == agent_data.ARROW_MIMETYPE:
        table = _arrow_table(stored.content)
        if table is not None:
            offset = _page_bound(arguments.offset, name="offset", minimum=0)
            limit = _page_bound(arguments.limit, name="limit", minimum=1)
            text = table_page(table, offset=offset, limit=limit)
            return tool_result(text, is_error=False), offset
    content = _file_content(stored, file_id, media_type)
    return {"content": [content], "isError": False}, None


def _arrow_table(content: bytes) -> pa.Table | None:
    """The table an Arrow-typed file holds, or None for bytes that do not
    decode, such as a download an app offers with that type.
    """
    try:
        return agent_data.read_arrow_stream(content)
    except Exception:
        return None


def _page_bound(value: Any, *, name: str, minimum: int) -> int:
    """A table page's ``offset`` or ``limit``.

    A number without a fraction is an integer, as in JSON Schema, so ``100.0``
    is ``100``; a boolean is not one.

    Raises
    ------
    AgentRequestError
        ``invalid_request`` for anything else, or one below ``minimum``.
    """
    is_integral = (isinstance(value, int) and not isinstance(value, bool)) or (
        isinstance(value, float) and value.is_integer()
    )
    if not is_integral or value < minimum:
        raise AgentRequestError(
            "invalid_request",
            f"On a table, `{name}` must be an integer of at least {minimum}.",
        )
    return int(value)


def table_page(table: pa.Table, *, offset: int, limit: int) -> str:
    """The JSON text of a table page: up to ``limit`` rows from ``offset`` on.

    Rows are in the stream's column order, encoded as ``data.preview`` encodes
    them, so a page matches the snapshot's ``columns`` and preview. The page
    ends before the row that would put its text past ``PAGE_CHARACTERS``, but
    holds at least one row. ``next_offset`` is the first row not returned, or
    ``null`` after the last, so a shorter page loses nothing.

    The text is what ``json_encoding.dumps`` renders for the page's fields in
    ``PAGE_FIELDS`` order. It is assembled from rows encoded one at a time, so
    each row's length counts toward the budget exactly once.
    """
    row_count = table.num_rows
    columns = json_encoding.dumps(agent_data.arrow_columns(table))
    head = f'{{"columns":{columns},"row_count":{row_count},"offset":{offset},"rows":['
    # Room for the longest tail, so the text stays within the budget whatever
    # `next_offset` turns out to be.
    tail = len('],"next_offset":}') + max(len("null"), len(str(row_count)))
    room = PAGE_CHARACTERS - len(head) - tail
    rows: list[str] = []
    used = 0
    for text in _encoded_rows(table, start=offset, end=min(row_count, offset + limit)):
        # Every row after the first also costs its separating comma.
        cost = len(text) + (1 if rows else 0)
        if rows and used + cost > room:
            break
        rows.append(text)
        used += cost
    following = offset + len(rows)
    next_offset = following if following < row_count else None
    return f'{head}{",".join(rows)}],"next_offset":{json_encoding.dumps(next_offset)}}}'


def _encoded_rows(table: pa.Table, *, start: int, end: int) -> Iterator[str]:
    """The JSON text of each row from ``start`` up to ``end``, converted
    ``_ROW_CHUNK`` rows at a time as the caller consumes them.
    """
    for chunk_start in range(start, end, _ROW_CHUNK):
        chunk = agent_data.arrow_rows(
            table, offset=chunk_start, limit=min(end - chunk_start, _ROW_CHUNK)
        )
        for row in chunk:
            yield json_encoding.dumps(row)


def _file_content(stored: MemoryFile, file_id: str, media_type: str) -> dict[str, Any]:
    """A file other than a table as one content block, chosen by its type."""
    content = stored.content
    if media_type in _IMAGE_TYPES or media_type in _AUDIO_TYPES:
        return {
            "type": "image" if media_type in _IMAGE_TYPES else "audio",
            "data": _base64(content),
            "mimeType": media_type,
        }
    is_text = media_type.startswith("text/") or media_type in _TEXT_TYPES
    if is_text and len(content) <= MAX_RESULT_BYTES:
        try:
            return {"type": "text", "text": content.decode("utf-8")}
        except UnicodeDecodeError:
            # MCP text must be Unicode, so these bytes go as a resource.
            pass
    return {
        "type": "resource",
        "resource": {
            # MCP requires an absolute URI, and the app cannot always know its
            # public URL, so this names the file and is never fetched.
            "uri": f"urn:streamlit:media:{file_id}",
            "mimeType": stored.mimetype,
            "blob": _base64(content),
        },
    }


def _base64(content: bytes) -> str:
    """``content`` as base64, refused before encoding if it is past the cap,
    so a result too large to send never costs its encoded copy.
    """
    # Four characters for every three bytes, the last group padded.
    encoded_size = 4 * -(-len(content) // 3)
    if encoded_size > MAX_RESULT_BYTES:
        raise ReadRefusedError("result_too_large", _FILE_TOO_LARGE_MESSAGE)
    return base64.b64encode(content).decode("ascii")
