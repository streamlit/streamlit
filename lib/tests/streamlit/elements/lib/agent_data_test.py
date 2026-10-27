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

"""Data blocks are built only for agent sessions, and their Arrow data is served."""

from __future__ import annotations

import datetime as dt
import decimal
import json
import math
import re
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import pandas as pd
import pyarrow as pa
import pytest

import streamlit as st
from streamlit import dataframe_util
from streamlit.elements.lib import agent_data, agent_spec
from streamlit.proto.Dataframe_pb2 import Dataframe as DataframeProto
from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from streamlit.proto.Table_pb2 import Table as TableProto
from streamlit.proto.VegaLiteChart_pb2 import VegaLiteChart as VegaLiteChartProto
from streamlit.runtime import Runtime, runtime_util
from streamlit.runtime.caching.cache_data_api import CACHE_DATA_MESSAGE_REPLAY_CTX
from streamlit.runtime.caching.cached_message_replay import ElementMsgData
from streamlit.testing.v1.util import patch_config_options
from tests.delta_generator_test_case import DeltaGeneratorTestCase

if TYPE_CHECKING:
    from streamlit.runtime.memory_media_file_storage import MemoryFile

_ARROW = dataframe_util.convert_pandas_df_to_arrow_bytes(pd.DataFrame({"n": range(5)}))
# More rows than `server.agentPreviewRows` previews by default.
_LONG_ARROW = dataframe_util.convert_pandas_df_to_arrow_bytes(
    pd.DataFrame({"n": range(150)})
)


def _arrow(table: pa.Table) -> bytes:
    return dataframe_util.convert_arrow_table_to_arrow_bytes(table)


class ArrowDataTest(DeltaGeneratorTestCase):
    """The block for one Arrow stream: its summary, its URL, and its cache record."""

    def tearDown(self) -> None:
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        st.cache_data.clear()
        super().tearDown()

    def _record(self) -> None:
        agent_spec.register_agent_session(self.script_run_ctx.session_id)

    def _stored(self) -> dict[str, MemoryFile]:
        return self.media_file_storage._files_by_id

    def _block(self, arrow_bytes: bytes, coordinates: str = "[0, 0]") -> dict[str, Any]:
        data = agent_data.arrow(arrow_bytes, coordinates=coordinates)
        assert data is not None
        return data

    def _url(self, arrow_bytes: bytes, coordinates: str = "[0, 0]") -> str:
        url = self._block(arrow_bytes, coordinates)["url"]
        assert isinstance(url, str)
        return url

    def test_a_browser_session_registers_no_copy(self) -> None:
        """Outside a recording session no copy is stored, even when called
        directly, as a cache replay does without `agent_spec`'s gate.
        """
        data = agent_data.arrow(_ARROW, coordinates="[0, 0]")

        assert self._stored() == {}
        assert data is not None
        assert "url" not in data

    def test_an_agent_session_registers_the_arrow_bytes(self) -> None:
        """The summary is reported beside a URL with no extension that serves the
        bytes under the Arrow type, even though the preview is already complete.
        """
        self._record()

        data = self._block(_ARROW)

        assert data["row_count"] == 5
        assert data["complete"] is True
        assert re.fullmatch(r"/media/[0-9a-f]+", data["url"])
        assert "unavailable" not in data
        stored = self.media_file_storage.get_file(data["url"].rsplit("/", 1)[-1])
        assert stored.content == _ARROW
        assert stored.mimetype == "application/vnd.apache.arrow.stream"

    def test_the_message_size_limit_bounds_what_is_served(self) -> None:
        """Bytes at the limit are served; one byte more is not, and nothing is kept.

        Above it, an incomplete preview says it is too large to serve, and a
        complete one needs nothing more.
        """
        self._record()

        with patch.object(
            runtime_util, "get_max_message_size_bytes", return_value=len(_LONG_ARROW)
        ):
            assert "url" in self._block(_LONG_ARROW)

        self._stored().clear()
        with patch.object(
            runtime_util, "get_max_message_size_bytes", return_value=len(_ARROW) - 1
        ):
            long_data = self._block(_LONG_ARROW)
            short_data = self._block(_ARROW)
        assert long_data["complete"] is False
        assert long_data["unavailable"] == "too_large_to_serve"
        assert "url" not in long_data
        assert short_data["complete"] is True
        assert short_data.keys().isdisjoint({"url", "unavailable"})
        assert self._stored() == {}

    def test_no_bytes_or_no_runtime_serves_nothing(self) -> None:
        """Empty data has no block, and without a runtime nothing serves it."""
        self._record()

        assert agent_data.arrow(b"", coordinates="[0, 0]") is None

        Runtime._instance = None
        assert "url" not in self._block(_ARROW)

    def test_a_registered_copy_is_kept_when_its_summary_fails(self) -> None:
        """The copy still serves the whole table, so it is reported on its own.

        Without a copy either, there is nothing to report.
        """
        self._record()

        with patch.object(agent_data, "summarize_arrow", return_value=None):
            data = agent_data.arrow(_ARROW, coordinates="[0, 0]")
            with patch.object(
                runtime_util, "get_max_message_size_bytes", return_value=1
            ):
                unserved = agent_data.arrow(_ARROW, coordinates="[0, 1]")

        assert data is not None
        assert data.keys() == {"complete", "url"}
        assert data["complete"] is False
        assert unserved is None

    def test_a_cache_entry_keeps_no_second_copy(self) -> None:
        """An agent-filled cache entry stores no Arrow copy beside the payload,
        which every session hitting the entry, browsers included, would
        otherwise unpickle.
        """
        self._record()

        @st.cache_data(show_spinner=False)
        def fill() -> None:
            st.dataframe(pd.DataFrame({"n": range(5)}))

        fill()

        [message] = CACHE_DATA_MESSAGE_REPLAY_CTX._most_recent_messages
        assert isinstance(message, ElementMsgData)
        assert not message.media_data

    def test_a_replay_registers_only_a_described_data_url(self) -> None:
        """A replayed description whose `data` has a `url` registers the payload
        under that same URL; one without registers nothing.
        """
        self._record()
        url = self._url(_ARROW)
        self._stored().clear()
        payload = DataframeProto()
        payload.arrow_data.data = _ARROW

        for undescribed in (
            {"type": "dataframe"},
            {"type": "dataframe", "data": agent_data.unavailable("lazy_loading")},
        ):
            agent_data.serve_replayed_arrow(
                payload, json.dumps(undescribed), coordinates="[0, 1]"
            )
        assert self._stored() == {}

        agent_data.serve_replayed_arrow(
            payload,
            json.dumps({"type": "dataframe", "data": {"complete": True, "url": url}}),
            coordinates="[0, 1]",
        )
        assert (
            self.media_file_storage.get_file(url.rsplit("/", 1)[-1]).content == _ARROW
        )

    def test_large_tables_that_differ_anywhere_get_their_own_urls(self) -> None:
        """Media storage samples large files for their ID; a table's URL must not.

        The two payloads have the same size and differ only between the
        sampled windows, so a sampled ID would serve the first one's bytes for
        both.
        """
        self._record()
        first = bytes(2_000_000)
        second = first[:300_000] + b"\x01" + first[300_001:]

        first_url = self._url(first, "[0, 0]")
        second_url = self._url(second, "[0, 1]")

        assert first_url != second_url
        served = self.media_file_storage.get_file(second_url.rsplit("/", 1)[-1])
        assert served.content == second


def test_raw_spec_reports_a_chart_specification_as_given() -> None:
    """The parsed specification is complete data; malformed text is none."""
    assert agent_data.raw_spec(
        '{"layers": [{"data": [{"lat": 1.0}]}], "zoom": NaN}'
    ) == {
        "spec": {"layers": [{"data": [{"lat": 1.0}]}], "zoom": None},
        "complete": True,
    }
    assert agent_data.raw_spec("{not json") is None
    assert agent_data.raw_spec("") is None


def test_a_replay_reads_tables_and_single_buffer_charts_from_their_payload() -> None:
    """A replay reads back the bytes a table or a one-buffer chart registered.

    A chart over several buffers registered no copy, so nothing is read back.
    """
    dataframe = DataframeProto()
    dataframe.arrow_data.data = _ARROW
    table = TableProto()
    table.arrow_data.data = _ARROW
    chart = VegaLiteChartProto()
    chart.datasets.add().data.data = _ARROW
    layered = VegaLiteChartProto()
    layered.data.data = _ARROW
    layered.datasets.add().data.data = _ARROW

    assert agent_data._arrow_in_payload(dataframe) == _ARROW
    assert agent_data._arrow_in_payload(table) == _ARROW
    assert agent_data._arrow_in_payload(chart) == _ARROW
    assert agent_data._arrow_in_payload(layered) == b""
    assert agent_data._arrow_in_payload(MarkdownProto(body="no data")) == b""


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (
            '{"x": NaN, "y": [Infinity, -Infinity, 1]}',
            {"x": None, "y": [None, None, 1]},
        ),
        ("", None),
        ("{not json", None),
    ],
)
def test_parse_spec_nulls_non_finite_numbers(text: str, expected: Any) -> None:
    """NaN and infinities read as null; empty or malformed text has no spec."""
    assert agent_data.parse_spec(text) == expected


def test_summarize_arrow_keeps_duplicate_column_names() -> None:
    """A `pa.Table` may repeat a name. Both columns and both values stay, by position."""
    table = pa.Table.from_arrays(
        [pa.array([1, 2]), pa.array(["x", "y"])], names=["a", "a"]
    )

    summary = agent_data.summarize_arrow(_arrow(table))

    assert summary is not None
    assert summary["columns"] == [
        {"name": "a", "type": "int64"},
        {"name": "a", "type": "string"},
    ]
    assert summary["column_count"] == 2
    assert summary["preview"]["rows"] == [[1, "x"], [2, "y"]]


def test_summarize_arrow_reports_non_finite_numbers_as_null() -> None:
    """NaN, infinities, Decimal NaN, and Arrow nulls are null; finite values stay."""
    floats = pa.table({"f": pa.array([1.5, math.nan, math.inf, -math.inf, None])})
    decimals = pd.DataFrame(
        {"d": [decimal.Decimal("0.25"), decimal.Decimal("NaN")]}, dtype=object
    )

    float_rows = agent_data.summarize_arrow(_arrow(floats))
    decimal_rows = agent_data.summarize_arrow(
        dataframe_util.convert_pandas_df_to_arrow_bytes(decimals)
    )

    assert float_rows is not None
    assert float_rows["preview"]["rows"] == [[1.5], [None], [None], [None], [None]]
    assert decimal_rows is not None
    assert decimal_rows["preview"]["rows"] == [["0.25"], [None]]


def test_preview_cells_follow_the_encoding_table() -> None:
    """Each Arrow type's cells read as the JSON the agent API pins for them."""
    berlin_morning = dt.datetime(2026, 1, 1, 9, 30, tzinfo=dt.UTC)
    table = pa.table(
        {
            "tz": pa.array([berlin_morning], pa.timestamp("us", tz="Europe/Berlin")),
            "naive": pa.array([dt.datetime(2026, 1, 1)], pa.timestamp("us")),
            "duration": pa.array([dt.timedelta(hours=1)], pa.duration("us")),
            "decimal": pa.array([decimal.Decimal("0.10")], pa.decimal128(4, 2)),
            "binary": pa.array([b"abc"], pa.binary()),
            "list": pa.array([[1, 2]], pa.list_(pa.int64())),
            "struct": pa.array([{"a": 1}], pa.struct([("a", pa.int64())])),
            "dictionary": pa.array(["x"]).dictionary_encode(),
            "date": pa.array([dt.date(2026, 1, 2)], pa.date32()),
            "time": pa.array([dt.time(9, 30)], pa.time64("us")),
            "big": pa.array([2**63 - 1], pa.int64()),
        }
    )

    summary = agent_data.summarize_arrow(_arrow(table))

    assert summary is not None
    assert summary["preview"]["rows"] == [
        [
            "2026-01-01T10:30:00+01:00",
            "2026-01-01T00:00:00",
            3600.0,
            "0.10",
            {"bytes": 3},
            [1, 2],
            {"a": 1},
            "x",
            "2026-01-02",
            "09:30:00",
            9223372036854775807,
        ]
    ]


def test_summarize_arrow_previews_the_rows_of_a_table_without_columns() -> None:
    """A table with rows and no columns previews one empty row per row it counts.

    Otherwise a preview of no rows would be reported as the complete table.
    """
    arrow_bytes = dataframe_util.convert_pandas_df_to_arrow_bytes(
        pd.DataFrame(index=range(5))
    )

    summary = agent_data.summarize_arrow(arrow_bytes)

    assert summary is not None
    assert summary["row_count"] == 5
    assert summary["complete"] is True
    assert summary["preview"]["rows"] == [[]] * 5

    with patch_config_options({"server.agentPreviewRows": 2}):
        bounded = agent_data.summarize_arrow(arrow_bytes)
    assert bounded is not None
    assert bounded["complete"] is False
    assert bounded["preview"]["rows"] == [[]] * 2


@pytest.mark.parametrize("limit", [0, -5])
def test_summarize_arrow_previews_no_rows_for_a_limit_of_zero_or_less(
    limit: int,
) -> None:
    """Zero or a negative `server.agentPreviewRows` previews nothing, incompletely."""
    with patch_config_options({"server.agentPreviewRows": limit}):
        summary = agent_data.summarize_arrow(_ARROW)

    assert summary is not None
    assert summary["preview"]["rows"] == []
    assert summary["complete"] is False


def test_summarize_arrow_keeps_the_schema_when_its_preview_fails() -> None:
    """A column pyarrow cannot convert leaves the schema and size, marked incomplete."""
    with patch.object(agent_data, "_arrow_rows", side_effect=NotImplementedError):
        summary = agent_data.summarize_arrow(_arrow(pa.table({"n": [1, 2]})))

    assert summary is not None
    assert summary["columns"] == [{"name": "n", "type": "int64"}]
    assert summary["row_count"] == 2
    assert summary["complete"] is False
    assert summary["preview"]["rows"] == []


@pytest.mark.parametrize("arrow_bytes", [b"", b"not an arrow stream"])
def test_summarize_arrow_returns_none_for_unreadable_bytes(arrow_bytes: bytes) -> None:
    """Empty or malformed bytes have no summary, and summarizing them does not raise."""
    assert agent_data.summarize_arrow(arrow_bytes) is None
