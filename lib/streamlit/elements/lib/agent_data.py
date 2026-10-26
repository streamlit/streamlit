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

"""Build the ``data`` a table, chart, or map reports to the agent API.

A data command builds its ``data`` block while recording, when it emits the
element, and passes it as ``agent_spec.element(data_block=...)``. The snapshot
copies it. Each builder is decorated with ``builder``, so a browser session
never runs it and a builder that raises reports no ``data`` rather than failing
the command.

``arrow`` builds the block for an element whose complete data is one Arrow IPC
stream from its payload: the schema, the row count, a preview of the first
``server.agentPreviewRows`` rows, and a ``url`` serving all of it. The stream
is registered in the same media-file storage that backs ``st.image``,
``st.audio``, and eager ``st.download_button``, and served from the same
``/media/...`` endpoint. Registration happens while the script runs, so the
file is attributed to the running session and picked up by the existing
lifecycle: ``clear_session_refs`` at the start of each full run drops the
previous run's references, and ``remove_orphaned_files`` at the end collects
whatever is no longer referenced. Every non-empty stream within
``server.maxMessageSize`` is registered, even when its preview is already
complete: completeness is a question about row count, not bytes.

Apart from the recording gate, serving is not agent-specific, so a frontend
that fetches Arrow over HTTP (https://github.com/streamlit/streamlit/issues/16378)
can reuse it.
"""

from __future__ import annotations

import functools
import json
from typing import TYPE_CHECKING, Any, Final, Literal, ParamSpec, TypeAlias

from streamlit import config, runtime, util
from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger
from streamlit.proto.VegaLiteChart_pb2 import VegaLiteChart as VegaLiteChartProto
from streamlit.runtime import runtime_util
from streamlit.runtime.agent import json_encoding

if TYPE_CHECKING:
    from collections.abc import Callable

    from google.protobuf.message import Message

_LOGGER: Final = get_logger(__name__)

_P = ParamSpec("_P")

# The registered mime type for the Arrow IPC stream format, which is what
# Streamlit's Arrow serializer produces. Media storage pins it to no
# extension, so its URL is `/media/<id>`.
ARROW_MIMETYPE: Final = "application/vnd.apache.arrow.stream"

# Why an element's `data` is incomplete and has no `url` serving the rest:
# - ``too_large_to_serve``: above `server.maxMessageSize`.
# - ``multiple_datasets``: a chart over several tables.
# - ``external_url``: a Vega-Lite chart whose specification loads data from a
#   URL, which only a browser fetches.
# - ``lazy_loading``: a lazily loaded dataframe, previewed from the chunk its
#   browser received.
# - ``undescribed``: an element replayed from a cache a browser filled, which
#   registered nothing.
UnavailableReason: TypeAlias = Literal[
    "too_large_to_serve",
    "multiple_datasets",
    "external_url",
    "lazy_loading",
    "undescribed",
]


def builder(
    build: Callable[_P, dict[str, Any] | None],
) -> Callable[_P, dict[str, Any] | None]:
    """Make ``build`` an element's data builder.

    The decorated function returns ``None`` unless this session is recording,
    so a browser session never runs its body. An exception inside it is logged
    at debug level and also returns ``None``: an element without ``data`` costs
    far less than a command that fails in an agent session.

    Parameters
    ----------
    build
        A function that returns an element's ``data`` block, or ``None`` when
        the element has none.

    Returns
    -------
    Callable
        ``build``, gated on recording and returning ``None`` instead of
        raising.
    """

    @functools.wraps(build)
    def build_while_recording(
        *args: _P.args, **kwargs: _P.kwargs
    ) -> dict[str, Any] | None:
        if not agent_spec.is_recording():
            return None
        try:
            return build(*args, **kwargs)
        except Exception:
            _LOGGER.debug("Could not build an element's agent API data.", exc_info=True)
            return None

    return build_while_recording


def unavailable(reason: UnavailableReason) -> dict[str, Any]:
    """A ``data`` block with no preview and nothing serving the data.

    Parameters
    ----------
    reason
        Why nothing serves the element's data.

    Returns
    -------
    dict[str, Any]
        ``{"complete": False, "unavailable": reason}``.
    """
    return {"complete": False, "unavailable": reason}


@builder
def arrow(arrow_bytes: bytes, *, coordinates: str) -> dict[str, Any] | None:
    """The ``data`` of an element whose complete data is one Arrow IPC stream.

    The stream is summarized by ``summarize_arrow`` and registered for HTTP
    fetch. Its ``url`` is reported even when the preview is complete, so every
    table has the same contract, and even when the summary failed, since the
    copy still serves the whole table.

    Parameters
    ----------
    arrow_bytes
        The Arrow IPC stream the element's payload carries, exactly as the
        browser receives it, so ``serve_replayed_arrow`` can read it back from
        a replayed ``st.cache_data`` entry.
    coordinates
        A string identifying this data's position in the app, from
        ``DeltaGenerator._get_write_delta_path_str()``. The media file manager
        keys references by it so data replaced in place does not leak.

    Returns
    -------
    dict[str, Any] | None
        The summary with a ``url``, or with ``unavailable`` when the stream is
        not served and the preview is not all of it. ``None`` outside a
        recording session, for empty bytes, and for a stream that can be
        neither read nor served.
    """
    if not arrow_bytes:
        return None

    data = summarize_arrow(arrow_bytes)
    url = _serve_arrow_over_http(arrow_bytes, coordinates=coordinates)
    if url is not None:
        # A fetch-now handle. The media manager collects the file once the
        # element that produced it stops rendering.
        return {**(data or {"complete": False}), "url": url}
    if data is None:
        return None
    if data["complete"] is False:
        # A recording session has a runtime, so the size bound is the only
        # reason the copy is not registered. A new one in
        # `_serve_arrow_over_http` needs its own `unavailable` value.
        data.update(unavailable("too_large_to_serve"))
    return data


def summarize_arrow(arrow_bytes: bytes) -> dict[str, Any] | None:
    """Describe an Arrow IPC stream: its schema, its size, and a row preview.

    The preview holds the first ``server.agentPreviewRows`` rows, as values in
    column order, and ``complete`` is whether those rows are the whole table.
    Not gated on recording: the snapshot also summarizes an element replayed
    without a description.

    Parameters
    ----------
    arrow_bytes
        An Arrow IPC stream, such as an element payload's ``arrow_data.data``.

    Returns
    -------
    dict[str, Any] | None
        The element's ``data`` without a ``url``, or ``None`` for empty or
        unreadable bytes.
    """
    if not arrow_bytes:
        return None

    import pyarrow as pa

    limit = _preview_row_limit()
    try:
        table = pa.RecordBatchStreamReader(arrow_bytes).read_all()
        columns = _arrow_columns(table)
    except Exception:
        # Any failure, not just a malformed stream: an element without a
        # summary costs far less than a failed snapshot.
        _LOGGER.debug("Could not read an Arrow payload.", exc_info=True)
        return None

    rows: list[list[Any]] | None
    try:
        rows = _arrow_rows(table, limit)
    except Exception:
        # A column pyarrow cannot convert to Python values. The schema and
        # size still describe the table, and the empty preview is incomplete.
        _LOGGER.debug("Could not preview an Arrow payload.", exc_info=True)
        rows = None

    return {
        "columns": columns,
        "row_count": table.num_rows,
        "column_count": len(columns),
        # `complete` sits at the top of `data` because it is the first question
        # a client asks, and it is the only flag: a second one inside `preview`
        # would only ever be its inverse.
        "complete": rows is not None and table.num_rows <= limit,
        "preview": {
            # Rows are values in `columns` order rather than objects, because
            # repeating the column names on every row is most of a preview's
            # size once it gets long.
            "rows": rows or [],
        },
    }


def parse_spec(value: str) -> Any:
    """Parse a chart or map specification for the response.

    `NaN` and infinities become null, as they do in table previews: the
    specifications are written with Python's lenient encoder, so a missing
    value in a layer's data arrives as `NaN`, which strict JSON cannot carry.

    Parameters
    ----------
    value
        The specification's JSON text, as the element's payload carries it.

    Returns
    -------
    Any
        The parsed specification, or ``None`` for empty or malformed text.
    """
    if not value:
        return None
    try:
        return json.loads(value, parse_constant=lambda _constant: None)
    except json.JSONDecodeError:
        return None


def serve_replayed_arrow(
    message: Message, agent_props: str, *, coordinates: str
) -> None:
    """Register an element's Arrow copy again when it is replayed from a cache.

    A replayed description keeps the ``data.url`` of the run that filled the
    cache, but that run's file is collected once nothing renders it. The
    entry stores no copy of its own: the element's payload already holds the
    bytes, and identical bytes register under the same URL.

    Parameters
    ----------
    message
        The replayed element's proto.
    agent_props
        The replayed element's agent description, which only a recording
        session replays.
    coordinates
        Where this replay writes the element, from
        ``DeltaGenerator._get_write_delta_path_str()``. It may differ from
        where the run that filled the cache wrote it.
    """
    data = agent_spec.decode(agent_props).get("data")
    if isinstance(data, dict) and "url" in data:
        _serve_arrow_over_http(_arrow_in_payload(message), coordinates=coordinates)


def _serve_arrow_over_http(arrow_bytes: bytes, *, coordinates: str) -> str | None:
    """Register Arrow data for HTTP fetch and return its URL.

    Returns ``None`` when there is nothing to serve:

    - this session is not recording
    - ``arrow_bytes`` is empty
    - there is no runtime to serve from
    - the payload is larger than ``server.maxMessageSize``
    """
    if not arrow_bytes or not agent_spec.is_recording():
        return None

    # Capped at `server.maxMessageSize`, the app's WebSocket message limit, so
    # raising one raises the other. The check uses the Arrow bytes alone,
    # because the protobuf framing that limit also covers is not built yet.
    # Above it the element reports no URL and its `data` says so with
    # `unavailable`; a client that needs the data narrows the app's filters
    # instead.
    size = len(arrow_bytes)
    max_size = runtime_util.get_max_message_size_bytes()
    if size > max_size:
        # Debug, not warning: this repeats for the element on every run, and
        # the snapshot already tells the client, through `data.unavailable`.
        _LOGGER.debug(
            "Not serving %s bytes of Arrow data over HTTP: above "
            "`server.maxMessageSize` (%s bytes). Clients will only see the "
            "inline preview.",
            size,
            max_size,
        )
        return None

    if not runtime.exists():
        # No runtime means no media storage and no HTTP server to fetch from,
        # which is the "python myscript.py" and bare-AppTest case.
        return None

    # Media storage IDs files over 1 MiB by sampling their bytes, so two
    # equal-size tables that differ outside the samples would share an ID, and
    # the second would be served the first one's bytes. Passing the full
    # digest as the file name, which only downloads read, makes the ID cover
    # every byte.
    return runtime.get_instance().media_file_mgr.add(
        arrow_bytes,
        ARROW_MIMETYPE,
        coordinates,
        file_name=util.calc_hash(arrow_bytes),
    )


def _arrow_in_payload(message: Message) -> bytes:
    """The Arrow data an element's payload carries, or empty bytes.

    A table's payload is its Arrow data. A Vega-Lite chart's is the one buffer
    its data is in, since only a chart with a single buffer registers a copy.
    """
    if isinstance(message, VegaLiteChartProto):
        # Imported here: `vega_charts` imports this module.
        from streamlit.elements import vega_charts

        buffers = vega_charts.arrow_buffers(message)
        return buffers[0] if len(buffers) == 1 else b""
    arrow_data = getattr(message, "arrow_data", None)
    return arrow_data.data if arrow_data is not None else b""


def _preview_row_limit() -> int:
    """Rows included in a `data.preview`, from `server.agentPreviewRows`.

    The default is large enough that most filtered tables are reported complete
    and need no second request, and small enough that a page of them does not
    dominate the response. A negative setting includes no rows.
    """
    return max(0, int(config.get_option("server.agentPreviewRows")))


def _arrow_columns(table: Any) -> list[dict[str, str]]:
    """An Arrow table's columns with their types, by position.

    Every column the bytes behind `data.url` carry, under the same names, so
    the reported schema is the schema of what a client fetches. That includes
    an unnamed, non-range index, which pandas stores as `__index_level_N__` and
    `st.dataframe` displays.
    """
    return [
        {"name": name, "type": str(dtype)}
        for name, dtype in zip(table.schema.names, table.schema.types, strict=True)
    ]


def _arrow_rows(table: Any, limit: int) -> list[list[Any]]:
    """Return up to ``limit`` rows as lists of cell values in column order.

    By position rather than by name, so a table with two columns of the same
    name keeps both.
    """
    if table.num_columns == 0:
        # Zipping no columns yields no rows, but the table still has them.
        return [[] for _ in range(min(table.num_rows, limit))]
    return [
        [json_encoding.to_json_value(cell) for cell in row]
        for row in zip(
            *(column.to_pylist() for column in table.slice(0, limit).columns),
            strict=True,
        )
    ]
