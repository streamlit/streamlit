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
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements.echarts_chart import (
    EChartsChartSelectionSerde,
    EChartsMixin,
    EChartsSelectionState,
    EChartsState,
    _normalize_options,
    _resolve_content_height,
    _resolve_content_width,
    _serialize_options,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitInvalidHeightError,
    StreamlitInvalidParameterTypeError,
    StreamlitInvalidWidthError,
    StreamlitValueError,
)
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

    def test_dataset_source_duplicate_stringified_columns_raises(self):
        """Column labels that collide after ``str()`` are rejected."""
        df = pd.DataFrame([[1, 2]], columns=[1, "1"])
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"dataset": {"source": df}, "series": [{"type": "bar"}]})

        assert exc.value.error_id == "echarts-dataset-duplicate-columns"

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
        """An invalid theme raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_OPTIONS, theme="bad_theme")

        assert (
            str(exc.value)
            == "Invalid `theme` value. Supported values: 'streamlit', None."
        )

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
        """An invalid renderer raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_OPTIONS, renderer="webgl")

        assert (
            str(exc.value)
            == "Invalid `renderer` value. Supported values: 'canvas', 'svg'."
        )

    def test_invalid_on_select(self):
        """An invalid on_select value raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_OPTIONS, on_select="invalid")

        assert (
            str(exc.value)
            == "Invalid `on_select` value. Supported values: 'rerun', 'ignore', "
            "a callback function."
        )

    @parameterized.expand(
        [
            ("rerun", True),
            ("ignore", False),
            (lambda: None, True),
        ]
    )
    def test_valid_on_select(self, on_select, is_widget):
        """on_select controls whether the chart becomes a selection widget."""
        st.echarts_chart(_BASIC_OPTIONS, on_select=on_select)

        el = self.get_delta_from_queue().new_element.echarts_chart
        # A widget gets an element ID; a display-only chart does not.
        assert (el.id != "") is is_widget

    def test_on_select_initial_returns(self):
        """st.echarts_chart returns an empty selection as the initial result."""
        selection = st.echarts_chart(
            _BASIC_OPTIONS, on_select="rerun", key="echarts_chart"
        )

        assert selection.selection.selected == []
        assert selection.selection.areas == []

        # The selection state is exposed through session state.
        assert st.session_state.echarts_chart.selection.selected == []
        assert st.session_state.echarts_chart.selection.areas == []

    @parameterized.expand([("rerun",), ("ignore",)])
    def test_inside_form(self, on_select):
        """The form ID is marshalled correctly inside a form."""
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
        assert exc.value.error_id == "echarts-js-callbacks-not-supported"

    def test_js_callback_sentinel_in_valid_json_raises(self):
        """pyecharts ``dump_options_with_quotes`` embeds ``--x_x--`` in valid JSON."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart(
                '{"tooltip": {"formatter": "--x_x--function (p) { return p; }--x_x--"}}'
            )

        assert exc.value.error_id == "echarts-js-callbacks-not-supported"

    def test_malformed_json_mentioning_function_is_parse_error(self):
        """The word ``function`` in a label is not treated as a JS callback."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart('{ "title": "my function"')

        assert exc.value.error_id == "echarts-options-invalid-json"

    def test_function_word_in_valid_json_is_allowed(self):
        """A title containing the word ``function`` is still valid JSON."""
        st.echarts_chart(
            {"title": {"text": "my function"}, "series": [{"type": "bar", "data": [1]}]}
        )
        spec = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)
        assert spec["title"]["text"] == "my function"

    def test_invalid_json_string_raises(self):
        """A malformed JSON string raises with a parse-failure error_id."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart("{not json")

        assert "could not be parsed as JSON" in str(exc.value)
        assert exc.value.error_id == "echarts-options-invalid-json"

    def test_lambda_in_dict_raises(self):
        """A callable embedded in the option dict raises instead of stringifying."""
        with pytest.raises(StreamlitAPIException):
            st.echarts_chart({"series": [{"data": [lambda: None]}]})

    @parameterized.expand(
        [("bar3D",), ("scatter3D",), ("surface",), ("globe",), ("graphGL",)]
    )
    def test_gl_series_raises(self, series_type):
        """ECharts GL series raise instead of rendering an empty chart."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"series": [{"type": series_type}]})

        assert "3D or WebGL charts" in str(exc.value)
        assert exc.value.error_id == "echarts-gl-series-not-supported"

    def test_custom_series_raises(self):
        """A custom series raises, since ``renderItem`` must be a JS callback."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"series": [{"type": "custom"}]})

        assert "custom series are not supported" in str(exc.value)
        assert exc.value.error_id == "echarts-custom-series-not-supported"

    @parameterized.expand(
        [
            ("map_series", {"series": [{"type": "map", "map": "world"}]}),
            ("geo_component", {"geo": {"map": "world"}, "series": []}),
            (
                "geo_coordinate_system",
                {"series": [{"type": "scatter", "coordinateSystem": "geo"}]},
            ),
        ]
    )
    def test_map_and_geo_raise(self, _name, options):
        """Map and geo charts raise, since GeoJSON cannot be registered."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart(options)

        assert "map charts" in str(exc.value)
        assert exc.value.error_id == "echarts-map-charts-not-supported"

    def test_unsupported_series_detected_inside_timeline_options(self):
        """Timeline specs are scanned in ``baseOption`` and per-tick ``options``."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart(
                {
                    "baseOption": {"timeline": {"data": ["2015"]}},
                    "options": [{"series": [{"type": "bar3D"}]}],
                }
            )

        assert exc.value.error_id == "echarts-gl-series-not-supported"

    def test_supported_series_named_like_gl_are_allowed(self):
        """Ordinary series types are not caught by the GL/geo checks."""
        st.echarts_chart(
            {"series": [{"type": "scatter", "data": [[1, 2]]}, {"type": "lines"}]}
        )

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec)["series"][1]["type"] == "lines"

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
        """Invalid width values raise StreamlitInvalidWidthError."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.echarts_chart(_BASIC_OPTIONS, width=invalid_value)

    @parameterized.expand([("invalid",), (0,), (-100,)])
    def test_height_validation_errors(self, invalid_value):
        """Invalid height values raise StreamlitInvalidHeightError."""
        with pytest.raises(StreamlitInvalidHeightError):
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
    with pytest.raises(StreamlitInvalidParameterTypeError) as exc:
        _normalize_options(12345)  # type: ignore[arg-type]

    assert "Invalid `options` type" in str(exc.value)
    assert "int" in str(exc.value)


def test_normalize_options_non_object_json_raises() -> None:
    """A JSON string that is not an object (e.g. a list) raises."""
    with pytest.raises(StreamlitInvalidParameterTypeError) as exc:
        _normalize_options("[1, 2, 3]")

    assert "Invalid `options` type" in str(exc.value)
    assert "list" in str(exc.value)


def test_serialize_options_rejects_arbitrary_object() -> None:
    """Arbitrary objects are not silently stringified into the spec."""

    class _Custom:
        def __str__(self) -> str:  # pragma: no cover - must not be reached
            return "SHOULD_NOT_APPEAR"

    with pytest.raises(StreamlitAPIException) as exc:
        _serialize_options({"series": _Custom()})

    assert exc.value.error_id == "echarts-options-not-json-serializable"


def test_serde_deserialize_none_returns_empty_selection() -> None:
    """Deserializing ``None`` returns the empty selection state."""
    serde = EChartsChartSelectionSerde()
    state = serde.deserialize(None)

    assert state["selection"]["selected"] == []
    assert state["selection"]["areas"] == []


def test_serde_fills_missing_selection_fields() -> None:
    """Deserialization restores required empty lists in partial payloads."""
    serde = EChartsChartSelectionSerde()

    state = serde.deserialize('{"selection": {"selected": []}}')

    assert state.selection.selected == []
    assert state.selection.areas == []


def test_serde_round_trip() -> None:
    """A serialized selection state round-trips back to the same values."""
    serde = EChartsChartSelectionSerde()
    state: dict[str, Any] = {
        "selection": {
            "selected": [
                {
                    "series_index": 0,
                    "series_id": "sales",
                    "series_name": "Sales",
                    "data_type": "main",
                    "data_indices": [1, 3],
                }
            ],
            "areas": [
                {
                    "brush_index": 0,
                    "brush_type": "rect",
                    "coord_range": [[0, 2], [10, 20]],
                }
            ],
        }
    }

    payload = serde.serialize(state)  # type: ignore[arg-type]
    assert isinstance(payload, str)

    restored = serde.deserialize(payload)
    assert restored["selection"]["selected"][0]["data_indices"] == [1, 3]
    assert restored["selection"]["areas"][0]["brush_type"] == "rect"
    # Attribute-style access is also supported (via ReadOnlyAttributeDictionary).
    assert restored.selection.selected[0]["series_id"] == "sales"


def test_deserialize_returns_read_only_state() -> None:
    """The returned state mirrors dataframe/plotly: typed, attribute-accessible,
    and read-only ``ReadOnlyAttributeDictionary`` subclasses.
    """
    serde = EChartsChartSelectionSerde()
    state = serde.deserialize(None)

    # The event state and its nested selection are the dedicated state classes.
    assert isinstance(state, EChartsState)
    assert isinstance(state["selection"], EChartsSelectionState)
    # Accessing "selection" repeatedly returns the same cached instance.
    assert state["selection"] is state.selection

    # Widget state is read-only; mutations must raise instead of silently
    # editing a value that never round-trips to the frontend.
    with pytest.raises(TypeError):
        state["selection"] = {}  # type: ignore[index]
    with pytest.raises(TypeError):
        state.selection["selected"] = [  # type: ignore[index]
            {"series_index": 0}
        ]


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
