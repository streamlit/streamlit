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

from __future__ import annotations

import json
from typing import Any

import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.echarts_chart import (
    EChartsChartSelectionSerde,
    EChartsMixin,
    _normalize_options,
    _resolve_content_height,
    _resolve_content_width,
    _serialize_options,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.EChartsChart_pb2 import EChartsChart as EChartsChartProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase

_BASIC_OPTIONS: dict[str, Any] = {
    "xAxis": {"type": "category", "data": ["A", "B", "C"]},
    "yAxis": {"type": "value"},
    "series": [{"type": "bar", "data": [5, 20, 36]}],
}


class _FakeEChart:
    """Duck-typed pyecharts-like chart exposing ``dump_options``."""

    def __init__(self, options: dict[str, Any], width: str = "", height: str = ""):
        self._options = options
        self.width = width
        self.height = height

    def dump_options(self) -> str:
        return json.dumps(self._options)


class EChartsChartTest(DeltaGeneratorTestCase):
    """Test st.echarts_chart."""

    def test_dict_input(self):
        """A dict option is serialized into a JSON spec with theme/renderer set."""
        st.echarts_chart(_BASIC_OPTIONS)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == _BASIC_OPTIONS
        assert el.theme == "streamlit"
        assert el.renderer == EChartsChartProto.Renderer.CANVAS
        # Display-only charts do not get an element ID.
        assert el.id == ""
        assert el.form_id == ""

    def test_json_string_input(self):
        """A JSON string option is parsed and re-serialized into the spec."""
        st.echarts_chart(json.dumps(_BASIC_OPTIONS))

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == _BASIC_OPTIONS

    def test_pyecharts_duck_typed_input(self):
        """A duck-typed pyecharts chart is converted via ``dump_options``."""
        chart = _FakeEChart({"series": [{"type": "pie", "data": [1, 2, 3]}]})
        st.echarts_chart(chart)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == {"series": [{"type": "pie", "data": [1, 2, 3]}]}

    def test_dataset_source_dataframe(self):
        """A dataframe ``dataset.source`` is converted to records + dimensions."""
        df = pd.DataFrame({"product": ["a", "b"], "2015": [43.3, 85.8]})
        st.echarts_chart({"dataset": {"source": df}, "series": [{"type": "bar"}]})

        el = self.get_delta_from_queue().new_element.echarts_chart
        spec = json.loads(el.spec)
        assert spec["dataset"]["source"] == [
            {"product": "a", "2015": 43.3},
            {"product": "b", "2015": 85.8},
        ]
        assert spec["dataset"]["dimensions"] == ["product", "2015"]

    def test_dataset_source_dataframe_preserves_user_dimensions(self):
        """A user-provided ``dimensions`` is not overwritten by column order."""
        df = pd.DataFrame({"product": ["a"], "2015": [43.3]})
        st.echarts_chart(
            {
                "dataset": {"source": df, "dimensions": ["product"]},
                "series": [{"type": "bar"}],
            }
        )

        el = self.get_delta_from_queue().new_element.echarts_chart
        spec = json.loads(el.spec)
        assert spec["dataset"]["dimensions"] == ["product"]

    def test_dataset_source_list_of_datasets(self):
        """A list of datasets converts each dataframe ``source``."""
        df = pd.DataFrame({"x": [1], "y": [2]})
        st.echarts_chart({"dataset": [{"source": df}], "series": [{"type": "bar"}]})

        el = self.get_delta_from_queue().new_element.echarts_chart
        spec = json.loads(el.spec)
        assert spec["dataset"][0]["source"] == [{"x": 1, "y": 2}]
        assert spec["dataset"][0]["dimensions"] == ["x", "y"]

    def test_dataset_source_datetime_and_nan_normalized(self):
        """Datetimes become ISO strings and missing values become ``null``."""
        df = pd.DataFrame(
            {"t": [pd.Timestamp("2020-01-01")], "v": [None]}, dtype="object"
        )
        df["t"] = pd.to_datetime(df["t"])
        st.echarts_chart({"dataset": {"source": df}})

        el = self.get_delta_from_queue().new_element.echarts_chart
        record = json.loads(el.spec)["dataset"]["source"][0]
        assert record["t"].startswith("2020-01-01")
        assert record["v"] is None

    @parameterized.expand(
        [
            ("streamlit", "streamlit"),
            (None, ""),
        ]
    )
    def test_theme(self, theme_value, proto_value):
        """The theme parameter maps to the proto theme field."""
        st.echarts_chart(_BASIC_OPTIONS, theme=theme_value)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.theme == proto_value

    def test_bad_theme(self):
        """An invalid theme raises a helpful exception."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart(_BASIC_OPTIONS, theme="bad_theme")

    @parameterized.expand(
        [
            ("canvas", EChartsChartProto.Renderer.CANVAS),
            ("svg", EChartsChartProto.Renderer.SVG),
        ]
    )
    def test_renderer(self, renderer_value, proto_value):
        """The renderer parameter maps to the proto renderer field."""
        st.echarts_chart(_BASIC_OPTIONS, renderer=renderer_value)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.renderer == proto_value

    def test_bad_renderer(self):
        """An invalid renderer raises a helpful exception."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart(_BASIC_OPTIONS, renderer="webgl")

    def test_invalid_on_select(self):
        """An invalid on_select value raises an exception."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart(_BASIC_OPTIONS, on_select="invalid")

    @parameterized.expand(
        [
            ("rerun", [0, 1, 2]),
            ("ignore", []),
            (lambda: None, [0, 1, 2]),
        ]
    )
    def test_valid_on_select(self, on_select, proto_value):
        """on_select controls whether selection modes are activated."""
        st.echarts_chart(_BASIC_OPTIONS, on_select=on_select)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert sorted(el.selection_mode) == proto_value

    def test_selection_mode_parsing(self):
        """The selection_mode parameter is parsed into proto enum values."""
        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun", selection_mode="points")
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert list(el.selection_mode) == [EChartsChartProto.SelectionMode.POINTS]

        st.echarts_chart(
            _BASIC_OPTIONS, on_select="rerun", selection_mode=("points", "lasso")
        )
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert sorted(el.selection_mode) == [
            EChartsChartProto.SelectionMode.POINTS,
            EChartsChartProto.SelectionMode.LASSO,
        ]

        # Deactivated selections yield an empty mode list regardless of the param.
        st.echarts_chart(
            _BASIC_OPTIONS, on_select="ignore", selection_mode={"box", "lasso"}
        )
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert list(el.selection_mode) == []

    def test_invalid_selection_mode(self):
        """An invalid selection mode raises a helpful exception."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart(
                _BASIC_OPTIONS, on_select="rerun", selection_mode=["invalid", "box"]
            )

    def test_on_select_initial_returns(self):
        """st.echarts_chart returns an empty selection as the initial result."""
        selection = st.echarts_chart(
            _BASIC_OPTIONS, on_select="rerun", key="echarts_chart"
        )

        assert selection.selection.points == []
        assert selection.selection.box == []
        assert selection.selection.lasso == []
        assert selection.selection.point_indices == []

        # The selection state is exposed through session state.
        assert st.session_state.echarts_chart.selection.points == []
        assert st.session_state.echarts_chart.selection.point_indices == []

    @parameterized.expand([("rerun",), ("ignore",)])
    def test_inside_form(self, on_select):
        """The form ID is marshalled correctly inside a form."""
        from unittest.mock import MagicMock, patch

        with patch("streamlit.runtime.Runtime.exists", MagicMock(return_value=True)):
            with st.form("form"):
                st.echarts_chart(_BASIC_OPTIONS, on_select=on_select)

        form_proto = self.get_delta_from_queue(0).add_block
        echarts_proto = self.get_delta_from_queue(1).new_element.echarts_chart

        if on_select == "rerun":
            assert echarts_proto.form_id == form_proto.form.form_id
        else:
            # Display-only charts never populate the form ID.
            assert echarts_proto.form_id == ""

    def test_non_serializable_object_raises(self):
        """An arbitrary Python object raises instead of being enqueued."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart({"series": object()})

    def test_js_callback_string_raises(self):
        """A JSON string with a bare ``function`` callback raises a helpful error."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart('{"tooltip": {"formatter": function (p) { return p; }}}')

        assert "JavaScript callbacks" in str(exc.value)

    def test_lambda_in_dict_raises(self):
        """A callable embedded in the option dict raises instead of stringifying."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart({"series": [{"data": [lambda: None]}]})

    @parameterized.expand([(float("nan"),), (float("inf"),), (float("-inf"),)])
    def test_non_finite_values_rejected(self, value):
        """NaN/Infinity values are rejected (allow_nan=False)."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart({"series": [{"data": [value]}]})

    def test_no_id_for_display_only(self):
        """Display-only charts (on_select='ignore') have no element ID."""
        st.echarts_chart(_BASIC_OPTIONS)
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.id == ""

    def test_id_present_when_selection_activated(self):
        """A widget ID is computed when selections are activated."""
        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun")
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.id != ""

    def test_id_changes_when_selection_mode_changes(self):
        """The widget ID changes when selection_mode changes (no key)."""
        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun", selection_mode="points")
        id_points = self.get_delta_from_queue().new_element.echarts_chart.id

        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun", selection_mode="box")
        id_box = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_points != id_box

    def test_id_changes_when_renderer_changes(self):
        """The widget ID changes when renderer changes (no key)."""
        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun", renderer="canvas")
        id_canvas = self.get_delta_from_queue().new_element.echarts_chart.id

        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun", renderer="svg")
        id_svg = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_canvas != id_svg

    def test_id_changes_when_spec_changes_without_key(self):
        """The widget ID changes when the option data changes and no key is set."""
        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        other_options = {**_BASIC_OPTIONS, "series": [{"type": "bar", "data": [1]}]}
        st.echarts_chart(other_options, on_select="rerun")
        id_b = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_a != id_b

    def test_id_stable_with_key_when_only_data_changes(self):
        """With a key, the widget ID is stable across data-only changes."""
        st.echarts_chart(_BASIC_OPTIONS, on_select="rerun", key="stable")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        # Simulate a fresh run so the same key can be reused.
        self.script_run_ctx.shared.reset()
        self.clear_queue()

        other_options = {**_BASIC_OPTIONS, "series": [{"type": "bar", "data": [9, 9]}]}
        st.echarts_chart(other_options, on_select="rerun", key="stable")
        id_b = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_a == id_b

    @parameterized.expand(
        [
            ("stretch", "use_stretch", True),
            ("content", "pixel_width", 700),
            (500, "pixel_width", 500),
        ]
    )
    def test_width_combinations(self, width, expected_spec, expected_value):
        """The width parameter maps to the element width config."""
        st.echarts_chart(_BASIC_OPTIONS, width=width)

        el = self.get_delta_from_queue().new_element
        assert el.width_config.WhichOneof("width_spec") == expected_spec
        assert getattr(el.width_config, expected_spec) == expected_value

    @parameterized.expand(
        [
            ("content", "pixel_height", 400),
            ("stretch", "use_stretch", True),
            (300, "pixel_height", 300),
        ]
    )
    def test_height_combinations(self, height, expected_spec, expected_value):
        """The height parameter maps to the element height config."""
        st.echarts_chart(_BASIC_OPTIONS, height=height)

        el = self.get_delta_from_queue().new_element
        assert el.height_config.WhichOneof("height_spec") == expected_spec
        assert getattr(el.height_config, expected_spec) == expected_value

    def test_pyecharts_content_dimensions(self):
        """Content sizing uses a pyecharts chart's own width/height when present."""
        chart = _FakeEChart(_BASIC_OPTIONS, width="820px", height="480px")
        st.echarts_chart(chart, width="content", height="content")

        el = self.get_delta_from_queue().new_element
        assert el.width_config.pixel_width == 820
        assert el.height_config.pixel_height == 480

    @parameterized.expand([("invalid",), (0,), (-100,)])
    def test_width_validation_errors(self, invalid_value):
        """Invalid width values raise validation errors."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart(_BASIC_OPTIONS, width=invalid_value)

    @parameterized.expand([("invalid",), (0,), (-100,)])
    def test_height_validation_errors(self, invalid_value):
        """Invalid height values raise validation errors."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart(_BASIC_OPTIONS, height=invalid_value)


@pytest.mark.require_integration
def test_dataset_source_polars_dataframe() -> None:
    """A Polars dataframe ``dataset.source`` is converted to records + dimensions."""
    import polars as pl

    option = _normalize_options(
        {"dataset": {"source": pl.DataFrame({"a": [1, 2], "b": [3, 4]})}}
    )
    assert option["dataset"]["source"] == [{"a": 1, "b": 3}, {"a": 2, "b": 4}]
    assert option["dataset"]["dimensions"] == ["a", "b"]


def test_normalize_options_deep_copies_mapping() -> None:
    """A mapping input is deep-copied so the user's object is left untouched."""
    original = {"series": [{"data": [1, 2, 3]}]}
    option = _normalize_options(original)
    option["series"][0]["data"].append(4)

    assert original["series"][0]["data"] == [1, 2, 3]


def test_normalize_options_invalid_type_raises() -> None:
    """A non-mapping, non-string, non-pyecharts input raises."""
    with pytest.raises(StreamlitAPIException):
        _normalize_options(12345)  # type: ignore[arg-type]


def test_normalize_options_non_object_json_raises() -> None:
    """A JSON string that is not an object (e.g. a list) raises."""
    with pytest.raises(StreamlitAPIException):
        _normalize_options("[1, 2, 3]")


def test_serialize_options_rejects_arbitrary_object() -> None:
    """Arbitrary objects are not silently stringified into the spec."""

    class _Custom:
        def __str__(self) -> str:  # pragma: no cover - must not be reached
            return "SHOULD_NOT_APPEAR"

    with pytest.raises(StreamlitAPIException):
        _serialize_options({"series": _Custom()})


def test_serde_deserialize_none_returns_empty_selection() -> None:
    """Deserializing ``None`` returns the empty selection state."""
    serde = EChartsChartSelectionSerde()
    state = serde.deserialize(None)

    assert state["selection"]["points"] == []
    assert state["selection"]["point_indices"] == []
    assert state["selection"]["box"] == []
    assert state["selection"]["lasso"] == []


def test_serde_round_trip() -> None:
    """A serialized selection state round-trips back to the same values."""
    serde = EChartsChartSelectionSerde()
    state: dict[str, Any] = {
        "selection": {
            "points": [{"series_index": 0, "data_index": 3, "value": 80}],
            "point_indices": [3],
            "box": [],
            "lasso": [],
        }
    }

    payload = serde.serialize(state)  # type: ignore[arg-type]
    assert isinstance(payload, str)

    restored = serde.deserialize(payload)
    assert restored["selection"]["point_indices"] == [3]
    assert restored["selection"]["points"][0]["data_index"] == 3
    # Attribute-style access is also supported (via AttributeDictionary).
    assert restored.selection.point_indices == [3]


def test_resolve_content_width_passthrough() -> None:
    """Non-content widths pass through unchanged."""
    assert _resolve_content_width("stretch", options={}) == "stretch"
    assert _resolve_content_width(500, options={}) == 500


def test_resolve_content_width_defaults_to_700() -> None:
    """Raw options with no intrinsic width resolve to the 700px default."""
    assert _resolve_content_width("content", options={}) == 700


def test_resolve_content_width_uses_pyecharts_width() -> None:
    """A pyecharts chart's own width is used for content width."""
    chart = _FakeEChart(_BASIC_OPTIONS, width="640px")
    assert _resolve_content_width("content", options=chart) == 640


def test_resolve_content_height_passthrough() -> None:
    """Non-content heights pass through unchanged."""
    assert _resolve_content_height("stretch", options={}) == "stretch"
    assert _resolve_content_height(300, options={}) == 300


def test_resolve_content_height_defaults_to_400() -> None:
    """Raw options with no intrinsic height resolve to the 400px default."""
    assert _resolve_content_height("content", options={}) == 400


def test_resolve_content_height_uses_pyecharts_height() -> None:
    """A pyecharts chart's own height is used for content height."""
    chart = _FakeEChart(_BASIC_OPTIONS, height="360px")
    assert _resolve_content_height("content", options=chart) == 360


def test_echarts_mixin_dg_returns_self() -> None:
    """``EChartsMixin.dg`` returns the mixin instance."""

    class _OnlyECharts(EChartsMixin):
        pass

    echarts_mixin = _OnlyECharts()
    assert echarts_mixin.dg is echarts_mixin
