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

"""The `data` block: a table's schema, a bounded preview, and where the rest is."""

from __future__ import annotations

import base64
import datetime as dt
import decimal
import json
import math
import re
from typing import TYPE_CHECKING, Any, get_args
from unittest.mock import patch

import altair as alt
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import pyarrow as pa
import pydeck as pdk
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import dataframe_util
from streamlit.elements.lib import agent_spec, data_offload
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime import runtime_util
from streamlit.runtime.agent import snapshot
from streamlit.runtime.agent.snapshot import UnavailableReason, summarize_arrow
from streamlit.testing.v1.util import patch_config_options
from tests.streamlit.runtime.agent.snapshot_test_case import (
    SnapshotCase,
    _assert_data_resolves,
    _by_type,
    _one,
    _walk,
)

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamlit.runtime.memory_media_file_storage import (
        MemoryFile,
        MemoryMediaFileStorage,
    )

_MEDIA_URL = re.compile(r"/media/[0-9a-f]+")
_FRAME = pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]})
_OTHER = pd.DataFrame({"a": [7], "b": [8]})
_CSV = "https://example.com/points.csv"


def _line(data: Any) -> alt.Chart:
    return alt.Chart(data).mark_line().encode(x="a:Q", y="b:Q")


# (name, chart call, unavailable reason or None when the chart has one table)
_VEGA_CASES: list[tuple[str, Callable[[], object], str | None]] = [
    ("builtin", lambda: st.line_chart(_FRAME, x="a", y="b"), None),
    ("builtin_wide", lambda: st.line_chart(_FRAME), None),
    ("altair", lambda: st.altair_chart(_line(_FRAME)), None),
    (
        "layered_one_frame",
        lambda: st.altair_chart(_line(_FRAME) + _line(_FRAME).mark_point()),
        None,
    ),
    (
        "layered_two_frames",
        lambda: st.altair_chart(_line(_FRAME) + _line(_OTHER)),
        "multiple_datasets",
    ),
    ("url", lambda: st.altair_chart(_line(_CSV)), "external_url"),
    (
        "url_layer_beside_a_frame",
        lambda: st.altair_chart(_line(_FRAME) + _line(_CSV)),
        "external_url",
    ),
    (
        "inline_values",
        lambda: st.vega_lite_chart(
            {
                "data": {"values": [{"a": 1}, {"a": 2}]},
                "mark": "point",
                "encoding": {"x": {"field": "a", "type": "quantitative"}},
            }
        ),
        None,
    ),
]


def _arrow(table: pa.Table) -> bytes:
    return dataframe_util.convert_arrow_table_to_arrow_bytes(table)


def _arrow_files(storage: MemoryMediaFileStorage) -> list[bytes]:
    """Contents of every Arrow file in media storage."""
    return [
        file.content
        for file in storage._files_by_id.values()
        if file.mimetype == data_offload.ARROW_MIMETYPE
    ]


def _names(data: dict[str, Any]) -> list[str]:
    return [column["name"] for column in data["columns"]]


def _frame(rows: int) -> pd.DataFrame:
    return pd.DataFrame({"n": range(rows), "label": [f"row {i}" for i in range(rows)]})


def test_summarize_arrow_keeps_duplicate_column_names() -> None:
    """A `pa.Table` may repeat a name. Both columns and both values stay, by position."""
    table = pa.Table.from_arrays(
        [pa.array([1, 2]), pa.array(["x", "y"])], names=["a", "a"]
    )

    summary = summarize_arrow(_arrow(table))

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

    float_rows = summarize_arrow(_arrow(floats))
    decimal_rows = summarize_arrow(
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

    summary = summarize_arrow(_arrow(table))

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

    summary = summarize_arrow(arrow_bytes)

    assert summary is not None
    assert summary["row_count"] == 5
    assert summary["complete"] is True
    assert summary["preview"]["rows"] == [[]] * 5

    with patch_config_options({"server.agentPreviewRows": 2}):
        bounded = summarize_arrow(arrow_bytes)
    assert bounded is not None
    assert bounded["complete"] is False
    assert bounded["preview"]["rows"] == [[]] * 2


def test_summarize_arrow_keeps_the_schema_when_its_preview_fails() -> None:
    """A column pyarrow cannot convert leaves the schema and size, marked incomplete."""
    with patch.object(snapshot, "_arrow_rows", side_effect=NotImplementedError):
        summary = summarize_arrow(_arrow(pa.table({"n": [1, 2]})))

    assert summary is not None
    assert summary["columns"] == [{"name": "n", "type": "int64"}]
    assert summary["row_count"] == 2
    assert summary["complete"] is False
    assert summary["preview"]["rows"] == []


@pytest.mark.parametrize("arrow_bytes", [b"", b"not an arrow stream"])
def test_summarize_arrow_returns_none_for_unreadable_bytes(arrow_bytes: bytes) -> None:
    """Empty or malformed bytes have no summary, and summarizing them does not raise."""
    assert summarize_arrow(arrow_bytes) is None


def _bar_figure_spec(**layout: Any) -> str:
    """A Plotly spec whose y values are a little-endian float64 typed array."""
    values = np.array([1.5, np.nan, 3.0], dtype="<f8")
    return json.dumps(
        {
            "data": [
                {
                    "type": "bar",
                    "x": ["a", "b", "c"],
                    "y": {
                        "dtype": "f8",
                        "bdata": base64.b64encode(values.tobytes()).decode(),
                    },
                }
            ],
            "layout": layout,
        }
    )


class SnapshotDataTest(SnapshotCase):
    """The data block each table, chart, and map element reports."""

    def _served(self, url: str) -> MemoryFile:
        return self.media_file_storage.get_file(url.rsplit("/", 1)[-1])

    def _data(self, element_type: str) -> dict[str, Any]:
        return _one(self._build().document, element_type)["data"]

    def test_a_long_table_reports_a_bounded_preview_and_a_url(self) -> None:
        """150 rows: 100 previewed, the rest behind a URL serving the payload's bytes."""
        st.dataframe(_frame(150))

        data = self._data("dataframe")

        assert _names(data) == ["n", "label"]
        assert data["row_count"] == 150
        assert data["column_count"] == 2
        assert data["complete"] is False
        assert len(data["preview"]["rows"]) == 100
        assert data["preview"]["rows"][3] == [3, "row 3"]
        assert _MEDIA_URL.fullmatch(data["url"])
        assert "unavailable" not in data
        # The served copy is exactly what the browser receives.
        payload = self.get_delta_from_queue().new_element.dataframe.arrow_data.data
        served = self._served(data["url"])
        assert served.content == payload
        assert served.mimetype == data_offload.ARROW_MIMETYPE

    def test_a_short_table_is_complete_and_keeps_its_url(self) -> None:
        """Four rows are all in the preview, and the URL is still reported."""
        st.dataframe(
            pd.DataFrame(
                {
                    "quarter": ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"],
                    "revenue": [284000, 301500, 297250, 318000],
                }
            )
        )

        data = self._data("dataframe")

        assert data["complete"] is True
        assert data["preview"]["rows"] == [
            ["2026-Q1", 284000],
            ["2026-Q2", 301500],
            ["2026-Q3", 297250],
            ["2026-Q4", 318000],
        ]
        assert _MEDIA_URL.fullmatch(data["url"])
        assert "unavailable" not in data

    @parameterized.expand(
        [
            ("range_index", pd.RangeIndex(2), ["v"]),
            ("named_index", pd.Index([10, 11], name="id"), ["v", "id"]),
            ("unnamed_index", pd.Index(["r1", "r2"]), ["v", "__index_level_0__"]),
            (
                "multi_index",
                pd.MultiIndex.from_tuples([("a", 1), ("b", 2)], names=[None, "n"]),
                ["v", "__index_level_0__", "n"],
            ),
        ]
    )
    def test_the_columns_include_the_index_columns_the_payload_carries(
        self, _name: str, index: pd.Index, expected: list[str]
    ) -> None:
        """An index is a column when the payload carries one, even if it is hidden.

        A RangeIndex is metadata, not a column.
        """
        st.dataframe(pd.DataFrame({"v": [1, 2]}, index=index), hide_index=True)

        assert _names(self._data("dataframe")) == expected

    def test_preview_rows_follow_server_agent_preview_rows(self) -> None:
        """The preview holds that many rows; zero or less holds none, with a URL."""
        st.dataframe(_frame(5))
        with patch_config_options({"server.agentPreviewRows": 2}):
            data = self._data("dataframe")
        assert data["preview"]["rows"] == [[0, "row 0"], [1, "row 1"]]
        assert data["complete"] is False

        self.clear_queue()
        st.dataframe(_frame(1))
        for limit in (0, -5):
            with patch_config_options({"server.agentPreviewRows": limit}):
                data = self._data("dataframe")
            assert data["preview"]["rows"] == []
            assert data["complete"] is False
            assert "url" in data

    def test_a_table_over_the_size_limit_is_too_large_to_serve(self) -> None:
        """Above `server.maxMessageSize` nothing is served, and the block says why.

        A complete table over the limit needs nothing more, so it has no reason.
        """
        with patch.object(runtime_util, "get_max_message_size_bytes", return_value=16):
            st.dataframe(_frame(150), key="long")
            st.dataframe(_frame(3), key="short")

        document = self._build().document
        long_data, short_data = (
            node["data"] for node in _by_type(document, "dataframe")
        )
        assert long_data["unavailable"] == "too_large_to_serve"
        assert long_data["complete"] is False
        assert "url" not in long_data
        assert short_data["complete"] is True
        assert "url" not in short_data
        assert "unavailable" not in short_data
        assert _arrow_files(self.media_file_storage) == []

    def test_a_lazy_dataframe_reports_its_first_chunk(self) -> None:
        """The preview is the first `agentPreviewRows` rows of the loaded chunk, the
        source's count is the row count, and nothing is served. Without a known
        count there is no row count.
        """
        st.dataframe(pd.DataFrame({"a": np.arange(5_000)}), lazy=True)
        lazy_message = self.get_message_from_queue()
        assert lazy_message.delta.new_element.dataframe.HasField("lazy_data")

        data = self._data("dataframe")

        assert data["complete"] is False
        assert data["unavailable"] == "lazy_loading"
        assert data["row_count"] == 5_000
        assert 0 < len(data["preview"]["rows"]) <= 100
        assert "url" not in data
        assert _arrow_files(self.media_file_storage) == []

        unknown = ForwardMsg()
        unknown.CopyFrom(lazy_message)
        unknown.delta.new_element.dataframe.lazy_data.ClearField("row_count")
        self.clear_queue()
        unknown_data = _one(self._build(unknown).document, "dataframe")["data"]
        assert "row_count" not in unknown_data
        assert unknown_data["unavailable"] == "lazy_loading"

    def test_table_and_data_editor_carry_their_data(self) -> None:
        """`st.table` and `st.data_editor` report the same block as a dataframe."""
        st.table(_frame(3))
        st.data_editor(_frame(3), key="editor")

        document = self._build().document
        table = _one(document, "table")
        editor = _one(document, "data_editor")
        for node in (table, editor):
            assert node["data"]["row_count"] == 3
            assert node["data"]["complete"] is True
            assert _MEDIA_URL.fullmatch(node["data"]["url"])
        assert editor["support"] == "action_unsupported"

    def test_plotly_drops_its_theme_and_expands_typed_arrays(self) -> None:
        """A figure is complete: its theme is dropped and named, its arrays are numbers."""
        st.plotly_chart(
            go.Figure(go.Scatter(x=[1, 2, 3], y=np.array([1.5, np.nan, 3.0])))
        )

        data = self._data("plotly_chart")

        assert data["complete"] is True
        assert data["spec_omitted"] == ["layout.template"]
        assert "template" not in data["spec"]["layout"]
        assert data["spec"]["data"][0]["y"] == [1.5, None, 3.0]
        assert "url" not in data

    def test_plotly_expands_a_two_dimensional_array_in_its_shape(self) -> None:
        """A heatmap's matrix comes back as rows of numbers, not one flat list."""
        st.plotly_chart(go.Figure(go.Heatmap(z=np.arange(6).reshape(2, 3))))

        assert self._data("plotly_chart")["spec"]["data"][0]["z"] == [
            [0, 1, 2],
            [3, 4, 5],
        ]

    def test_a_table_whose_summary_fails_still_reports_its_url(self) -> None:
        """The registered copy still serves the whole table, so it is not dropped."""
        st.dataframe(_frame(5))

        with patch.object(snapshot, "summarize_arrow", return_value=None):
            data = self._data("dataframe")

        assert data.keys() == {"complete", "url"}
        assert data["complete"] is False
        assert _MEDIA_URL.fullmatch(data["url"])

    def test_plotly_keeps_template_content(self) -> None:
        """Content a template adds, such as an annotation, stays; the rest is named."""
        message = ForwardMsg()
        message.metadata.delta_path[:] = [0, 0]
        message.metadata.agent_props = json.dumps({"type": "plotly_chart"})
        message.delta.new_element.plotly_chart.spec = _bar_figure_spec(
            template={
                "data": {"bar": [{"marker": {"color": "red"}}]},
                "layout": {
                    "annotations": [{"text": "DRAFT"}],
                    "font": {"family": "Serif"},
                },
            },
            title={"text": "Sales"},
        )

        data = _one(self._build(message).document, "plotly_chart")["data"]

        assert data["spec"]["layout"] == {
            "title": {"text": "Sales"},
            "template": {"layout": {"annotations": [{"text": "DRAFT"}]}},
        }
        assert data["spec_omitted"] == [
            "layout.template.data",
            "layout.template.layout.font",
        ]
        assert data["spec"]["data"][0]["y"] == [1.5, None, 3.0]

    def test_echarts_reports_its_option_as_complete(self) -> None:
        """An ECharts option is its own data."""
        option = {
            "xAxis": {"type": "category", "data": ["a", "b"]},
            "yAxis": {},
            "series": [{"type": "bar", "data": [1, 2]}],
        }
        st.echarts_chart(option)

        data = self._data("echarts_chart")

        assert data == {"spec": option, "complete": True}

    def test_pydeck_reports_its_spec(self) -> None:
        """Inline layers are counted; a layer the browser fetches leaves no count."""
        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=[{"p": [0, 0]}, {"p": [1, 1]}]),
                    pdk.Layer("ScatterplotLayer", data=pd.DataFrame({"p": [2, 3, 4]})),
                ]
            )
        )
        st.pydeck_chart(
            pdk.Deck(
                layers=[
                    pdk.Layer("ScatterplotLayer", data=[{"p": [0, 0]}]),
                    pdk.Layer("GeoJsonLayer", data="https://example.com/a.geojson"),
                ]
            )
        )

        inline, fetched = (
            node["data"] for node in _by_type(self._build().document, "pydeck_chart")
        )
        assert inline["complete"] is True
        assert inline["row_count"] == 5
        assert len(inline["spec"]["layers"]) == 2
        assert fetched["complete"] is True
        assert "row_count" not in fetched
        assert "url" not in fetched

    def test_a_map_reports_its_plotted_columns_without_the_index(self) -> None:
        """Only the plotted columns, with the author's values, and never the index."""
        st.map(
            pd.DataFrame(
                {
                    "lat": [1.0, 2.0],
                    "lon": [3.0, 4.0],
                    "tone": ["#ff0000", "#00ff00"],
                    "email": ["ada@example.com", "bob@example.com"],
                },
                index=pd.Index(["cust-17", "cust-42"], name="customer"),
            ),
            color="tone",
        )

        document = self._build().document
        data = _one(document, "map")["data"]

        assert _names(data) == ["lat", "lon", "tone"]
        assert data["preview"]["rows"] == [[1.0, 3.0, "#ff0000"], [2.0, 4.0, "#00ff00"]]
        assert data["complete"] is True
        assert "spec" not in data
        rendered = json.dumps(document)
        served = self._served(data["url"]).content
        for withheld in ("ada@example.com", "cust-17", "customer"):
            assert withheld not in rendered
            assert withheld.encode() not in served
        assert pa.RecordBatchStreamReader(served).read_all().schema.names == [
            "lat",
            "lon",
            "tone",
        ]

    def test_an_empty_map_reports_an_empty_table(self) -> None:
        """A map without points reports an empty table and serves nothing."""
        st.map()
        st.map(pd.DataFrame({"lat": [], "lon": []}))

        for node in _by_type(self._build().document, "map"):
            assert node["data"]["columns"] == []
            assert node["data"]["row_count"] == 0
            assert node["data"]["complete"] is True
            assert "url" not in node["data"]
            assert "spec" not in node["data"]
        assert _arrow_files(self.media_file_storage) == []

    def test_an_undescribed_table_says_so(self) -> None:
        """A table without a description, as replayed from a cache a browser
        filled, registered nothing, so a long one has no URL and says why.
        """
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        st.dataframe(_frame(150))
        st.dataframe(_frame(3))

        document = self._build().document

        long_data, short_data = (
            node["data"] for node in _by_type(document, "dataframe")
        )
        assert document["undescribed_types"] == ["dataframe"]
        assert long_data["unavailable"] == "undescribed"
        assert "url" not in long_data
        assert short_data["complete"] is True
        assert "unavailable" not in short_data

    def test_every_data_block_resolves(self) -> None:
        """Complete, or a URL, or a known reason; never a URL beside a reason."""
        st.dataframe(_frame(150))
        st.dataframe(_frame(3))
        st.dataframe(pd.DataFrame({"a": np.arange(5_000)}), lazy=True)
        st.table(_frame(3))
        st.data_editor(_frame(150), key="editor")
        for _name, make, _unavailable in _VEGA_CASES:
            make()
        st.plotly_chart(go.Figure(go.Bar(x=["a"], y=[1])))
        st.echarts_chart({"series": [{"type": "bar", "data": [1]}]})
        st.pydeck_chart(pdk.Deck(layers=[pdk.Layer("GeoJsonLayer", data=_CSV)]))
        st.map(pd.DataFrame({"lat": [1.0], "lon": [2.0]}))
        st.map()
        with patch.object(runtime_util, "get_max_message_size_bytes", return_value=16):
            st.dataframe(_frame(150), key="too-large")
        agent_spec.forget_agent_session(self.script_run_ctx.session_id)
        st.dataframe(_frame(150), key="undescribed")

        blocks = [
            node["data"]
            for node in _walk(self._build().document["tree"])
            if "data" in node
        ]

        assert len(blocks) == 20
        for data in blocks:
            _assert_data_resolves(data)
        reasons = {data.get("unavailable") for data in blocks}
        assert reasons == {None, *get_args(UnavailableReason)}


class VegaDataTest(SnapshotCase):
    """A Vega-Lite chart reports its one table, or says why it has none."""

    @parameterized.expand(_VEGA_CASES)
    def test_vega_charts_report_one_table_or_say_why_not(
        self, _name: str, make: Callable[[], object], unavailable: str | None
    ) -> None:
        """One Arrow buffer is summarized and served; anything else serves none.

        The specification is always reported, without the zero sizes the
        built-in charts write for "fill the container".
        """
        make()
        proto = self.get_delta_from_queue().new_element.vega_lite_chart
        node = next(
            node
            for node in _walk(self._build().document["tree"])
            if "data" in node and "spec" in node["data"]
        )
        data = node["data"]

        assert data["spec"].get("width") != 0
        assert data["spec"].get("height") != 0
        _assert_data_resolves(data)
        if unavailable is None:
            [buffer] = agent_spec.vega_arrow_buffers(proto)
            assert (
                data["row_count"]
                == pa.RecordBatchStreamReader(buffer).read_all().num_rows
            )
            assert _arrow_files(self.media_file_storage) == [buffer]
            assert _MEDIA_URL.fullmatch(data["url"])
        else:
            assert data["unavailable"] == unavailable
            assert "url" not in data
            assert "columns" not in data
            assert _arrow_files(self.media_file_storage) == []

    def test_builtin_charts_report_the_dataset_the_browser_receives(self) -> None:
        """A wide built-in chart's data is the long form, under its generated names."""
        st.line_chart(_FRAME)

        data = _one(self._build().document, "line_chart")["data"]

        assert data["row_count"] == 6
        assert all(name.endswith("streamlit-generated") for name in _names(data))
        assert "width" not in data["spec"]
        assert "height" not in data["spec"]

    def test_url_loaded_vega_data_stays_in_the_spec(self) -> None:
        """The URL the browser fetches is reported where the author wrote it."""
        st.altair_chart(_line(_CSV))

        data = _one(self._build().document, "altair_chart")["data"]

        assert data["spec"]["data"] == {"url": _CSV}

    def test_a_chart_without_data_is_complete(self) -> None:
        """Nothing outside the specification means the specification is everything."""
        st.vega_lite_chart({"mark": "point", "encoding": {"x": {"datum": 1}}})

        data = _one(self._build().document, "vega_lite_chart")["data"]

        assert data["complete"] is True
        assert "url" not in data
        assert "columns" not in data

    def test_a_chart_with_selections_keeps_its_data(self) -> None:
        """A selectable chart reports that it cannot be driven, and its data."""
        st.altair_chart(
            _line(_FRAME).add_params(alt.selection_point(name="pick")),
            on_select="rerun",
            key="picked",
        )

        node = _one(self._build().document, "altair_chart")

        assert node["support"] == "action_unsupported"
        assert node["data"]["row_count"] == 3
