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
from streamlit.elements import echarts_chart as echarts_chart_module
from streamlit.elements.echarts_chart import (
    EChartsChartSelectionSerde,
    EChartsMixin,
    EChartsSelectionState,
    EChartsState,
    _normalize_spec,
    _resolve_content_height,
    _resolve_content_width,
    _serialize_option,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitDuplicateElementKey,
    StreamlitInvalidHeightError,
    StreamlitInvalidParameterTypeError,
    StreamlitInvalidWidthError,
    StreamlitValueError,
)
from streamlit.proto.EChartsChart_pb2 import EChartsChart as EChartsChartProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase

_ECHARTS_LOGGER = echarts_chart_module._LOGGER.name

_BASIC_SPEC: dict[str, Any] = {
    "xAxis": {"type": "category", "data": ["A", "B", "C"]},
    "yAxis": {"type": "value"},
    "series": [{"type": "bar", "data": [5, 20, 36]}],
}


class _FakeEChart:
    """Duck-typed pyecharts-like chart exposing ``dump_options``."""

    def __init__(self, spec: dict[str, Any], width: str = "", height: str = ""):
        self._spec = spec
        self.width = width
        self.height = height

    def dump_options(self) -> str:
        return json.dumps(self._spec)


class EChartsChartTest(DeltaGeneratorTestCase):
    """Test st.echarts_chart."""

    def test_dict_input(self):
        """A dict option is serialized into a JSON spec with theme/renderer set."""
        st.echarts_chart(_BASIC_SPEC)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == _BASIC_SPEC
        assert el.theme == "streamlit"
        assert el.renderer == EChartsChartProto.Renderer.CANVAS
        # Display-only charts do not get an element ID.
        assert el.id == ""
        assert el.form_id == ""

    def test_json_string_input(self):
        """A JSON string option is parsed and re-serialized into the spec."""
        st.echarts_chart(json.dumps(_BASIC_SPEC))

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == _BASIC_SPEC

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

    def test_dataset_source_dataframe_inside_timeline_base_option(self):
        """A dataframe ``dataset.source`` nested under ``baseOption`` is converted."""
        df = pd.DataFrame({"product": ["a"], "2015": [43.3]})
        st.echarts_chart(
            {
                "baseOption": {
                    "timeline": {"data": ["2015"]},
                    "dataset": {"source": df},
                    "series": [{"type": "bar"}],
                },
                "options": [{"title": {"text": "2015"}}],
            }
        )

        spec = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)
        assert spec["baseOption"]["dataset"]["source"] == [
            {"product": "a", "2015": 43.3}
        ]
        assert spec["baseOption"]["dataset"]["dimensions"] == ["product", "2015"]

    def test_dataset_source_dataframe_inside_timeline_options(self):
        """A dataframe ``dataset.source`` in a timeline tick is converted."""
        df = pd.DataFrame({"x": [1], "y": [2]})
        st.echarts_chart(
            {
                "baseOption": {
                    "timeline": {"data": ["2015"]},
                    "series": [{"type": "bar"}],
                },
                "options": [{"dataset": {"source": df}}],
            }
        )

        spec = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)
        assert spec["options"][0]["dataset"]["source"] == [{"x": 1, "y": 2}]
        assert spec["options"][0]["dataset"]["dimensions"] == ["x", "y"]

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
        st.echarts_chart(_BASIC_SPEC, theme=theme_value)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.theme == proto_value

    def test_bad_theme(self):
        """An invalid theme raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_SPEC, theme="bad_theme")

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
        st.echarts_chart(_BASIC_SPEC, renderer=renderer_value)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.renderer == proto_value

    def test_bad_renderer(self):
        """An invalid renderer raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_SPEC, renderer="webgl")

        assert (
            str(exc.value)
            == "Invalid `renderer` value. Supported values: 'canvas', 'svg'."
        )

    def test_invalid_on_select(self):
        """An invalid on_select value raises StreamlitValueError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_SPEC, on_select="invalid")

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
        st.echarts_chart(_BASIC_SPEC, on_select=on_select)

        el = self.get_delta_from_queue().new_element.echarts_chart
        # A widget gets an element ID; a display-only chart does not.
        assert (el.id != "") is is_widget

    def test_on_select_initial_returns(self):
        """st.echarts_chart returns an empty selection as the initial result."""
        selection = st.echarts_chart(
            _BASIC_SPEC, on_select="rerun", key="echarts_chart"
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
                st.echarts_chart(_BASIC_SPEC, on_select=on_select)

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

    def test_dataframe_outside_dataset_points_at_dataset_source(self):
        """A dataframe in ``series.data`` is rejected with an actionable hint.

        Only ``dataset.source`` is converted, so the error has to say where
        dataframes actually work.
        """
        df = pd.DataFrame({"x": [1, 2]})
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"series": [{"type": "bar", "data": df}]})

        assert "dataset.source" in str(exc.value)
        assert exc.value.error_id == "echarts-spec-not-json-serializable"

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

        assert exc.value.error_id == "echarts-spec-invalid-json"

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
        assert exc.value.error_id == "echarts-spec-invalid-json"

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

    @parameterized.expand([("grid3D",), ("geo3D",)])
    def test_gl_components_raise(self, component):
        """ECharts GL components are rejected like their series counterparts."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({component: {}, "series": [{"type": "bar"}]})

        assert "3D or WebGL charts" in str(exc.value)
        assert exc.value.error_id == "echarts-gl-series-not-supported"

    @parameterized.expand(
        [("wordCloud", "echarts-wordcloud"), ("liquidFill", "echarts-liquidfill")]
    )
    def test_unbundled_extension_series_raise(self, series_type, extension):
        """Series needing an unbundled extension raise instead of rendering empty."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"series": [{"type": series_type}]})

        assert extension in str(exc.value)
        assert exc.value.error_id == "echarts-extension-series-not-supported"

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
    def test_map_and_geo_raise(self, _name, spec):
        """Map and geo charts raise, since GeoJSON cannot be registered."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart(spec)

        assert "map charts" in str(exc.value)
        assert exc.value.error_id == "echarts-map-charts-not-supported"

    def test_unsupported_series_detected_inside_timeline_variants(self):
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
        """Display-only charts without a key have no element ID."""
        st.echarts_chart(_BASIC_SPEC)
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.id == ""

    def test_id_for_display_only_with_key(self):
        """A key gives a display-only chart an ID (for st-key-* and identity)."""
        st.echarts_chart(_BASIC_SPEC, key="styled_chart")
        el = self.get_delta_from_queue().new_element.echarts_chart

        assert el.id.endswith("styled_chart")
        # A display-only chart is still not a selection widget.
        assert el.form_id == ""
        assert el.selection_activated is False

    def test_display_only_key_id_stable_across_spec_changes(self):
        """A keyed display-only chart keeps its ID when the spec changes.

        The frontend uses the ID as the element identity, so a stable ID is what
        keeps ECharts from remounting and replaying its entry animation.
        """
        st.echarts_chart(_BASIC_SPEC, key="stable_display")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        self.script_run_ctx.shared.reset()
        self.clear_queue()

        st.echarts_chart(
            {**_BASIC_SPEC, "series": [{"type": "bar", "data": [1, 2, 3]}]},
            key="stable_display",
        )
        id_b = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_a == id_b

    def test_duplicate_key_on_display_only_charts_raises(self):
        """Two display-only charts cannot share a key."""
        st.echarts_chart(_BASIC_SPEC, key="duplicated")

        with pytest.raises(StreamlitDuplicateElementKey):
            st.echarts_chart(_BASIC_SPEC, key="duplicated")

    def test_id_present_when_selection_activated(self):
        """A widget ID is computed when selections are activated."""
        st.echarts_chart(_BASIC_SPEC, on_select="rerun")
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.id != ""
        assert el.selection_activated is True

    def test_id_changes_when_renderer_changes(self):
        """The widget ID changes when renderer changes (no key)."""
        st.echarts_chart(_BASIC_SPEC, on_select="rerun", renderer="canvas")
        id_canvas = self.get_delta_from_queue().new_element.echarts_chart.id

        st.echarts_chart(_BASIC_SPEC, on_select="rerun", renderer="svg")
        id_svg = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_canvas != id_svg

    def test_id_changes_when_theme_changes(self):
        """The widget ID changes when theme changes (no key)."""
        st.echarts_chart(_BASIC_SPEC, on_select="rerun", theme="streamlit")
        id_themed = self.get_delta_from_queue().new_element.echarts_chart.id

        st.echarts_chart(_BASIC_SPEC, on_select="rerun", theme=None)
        id_unthemed = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_themed != id_unthemed

    @parameterized.expand([("renderer", "svg"), ("theme", None)])
    def test_id_stable_with_key_across_render_params(self, parameter, other_value):
        """With a key, neither renderer nor theme participates in the identity.

        Both force a dispose/re-init in the frontend, which re-applies the
        persisted selection, so neither should be treated as a new widget.
        """
        st.echarts_chart(_BASIC_SPEC, on_select="rerun", key="keyed")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        self.script_run_ctx.shared.reset()
        self.clear_queue()

        st.echarts_chart(
            _BASIC_SPEC, on_select="rerun", key="keyed", **{parameter: other_value}
        )
        id_b = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_a == id_b

    def test_id_changes_when_spec_changes_without_key(self):
        """The widget ID changes when the option data changes and no key is set."""
        st.echarts_chart(_BASIC_SPEC, on_select="rerun")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        other_spec = {**_BASIC_SPEC, "series": [{"type": "bar", "data": [1]}]}
        st.echarts_chart(other_spec, on_select="rerun")
        id_b = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_a != id_b

    def test_id_stable_with_key_when_only_data_changes(self):
        """With a key, the widget ID is stable across data-only changes."""
        st.echarts_chart(_BASIC_SPEC, on_select="rerun", key="stable")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        # Simulate a fresh run so the same key can be reused.
        self.script_run_ctx.shared.reset()
        self.clear_queue()

        other_spec = {**_BASIC_SPEC, "series": [{"type": "bar", "data": [9, 9]}]}
        st.echarts_chart(other_spec, on_select="rerun", key="stable")
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
        st.echarts_chart(_BASIC_SPEC, width=width)

        el = self.get_delta_from_queue().new_element
        assert el.width_config.WhichOneof("width_spec") == expected_spec
        assert getattr(el.width_config, expected_spec) == expected_value

    @parameterized.expand(
        [
            ("content", "pixel_height", 350),
            ("stretch", "use_stretch", True),
            (300, "pixel_height", 300),
        ]
    )
    def test_height_combinations(self, height, expected_spec, expected_value):
        """The height parameter maps to the element height config."""
        st.echarts_chart(_BASIC_SPEC, height=height)

        el = self.get_delta_from_queue().new_element
        assert el.height_config.WhichOneof("height_spec") == expected_spec
        assert getattr(el.height_config, expected_spec) == expected_value

    def test_pyecharts_content_dimensions(self):
        """Content sizing uses a pyecharts chart's own width/height when present."""
        chart = _FakeEChart(_BASIC_SPEC, width="820px", height="480px")
        st.echarts_chart(chart, width="content", height="content")

        el = self.get_delta_from_queue().new_element
        assert el.width_config.pixel_width == 820
        assert el.height_config.pixel_height == 480

    def test_warns_when_selection_activated_without_spec_selection(self):
        """A spec that can never emit a selection is logged, not raised.

        Raising would crash apps whose ``series`` list is built from data and is
        momentarily empty, so this stays a console-only diagnostic.
        """
        with self.assertLogs(_ECHARTS_LOGGER, level="WARNING") as logs:
            st.echarts_chart(_BASIC_SPEC, on_select="rerun")

        assert "doesn't enable any" in logs.output[0]
        # The chart still renders as a widget.
        assert self.get_delta_from_queue().new_element.echarts_chart.id != ""

    @parameterized.expand(
        [
            (
                "series_selected_mode",
                {"series": [{"type": "bar", "selectedMode": "multiple"}]},
            ),
            ("brush_component", {"brush": {"toolbox": ["rect"]}, "series": []}),
            (
                "toolbox_brush_feature",
                {"toolbox": {"feature": {"brush": {}}}, "series": []},
            ),
            (
                "timeline_variant",
                {
                    "baseOption": {"timeline": {"data": ["2015"]}},
                    "options": [
                        {"series": [{"type": "bar", "selectedMode": "single"}]}
                    ],
                },
            ),
        ]
    )
    def test_no_warning_when_spec_enables_selection(self, _name, spec):
        """Specs that do enable a selection don't log a warning."""
        with patch.object(echarts_chart_module._LOGGER, "warning") as mock_warning:
            st.echarts_chart(spec, on_select="rerun")

        mock_warning.assert_not_called()

    def test_legend_selected_mode_is_not_data_selection(self):
        """``legend.selectedMode`` is a different feature and doesn't count."""
        with self.assertLogs(_ECHARTS_LOGGER, level="WARNING") as logs:
            st.echarts_chart(
                {"legend": {"selectedMode": "multiple"}, "series": [{"type": "bar"}]},
                on_select="rerun",
            )

        assert "doesn't enable any" in logs.output[0]

    def test_no_warning_for_display_only_chart_without_selection(self):
        """A display-only chart never warns about missing selection config."""
        with patch.object(echarts_chart_module._LOGGER, "warning") as mock_warning:
            st.echarts_chart(_BASIC_SPEC)

        mock_warning.assert_not_called()

    @parameterized.expand([("invalid",), (0,), (-100,)])
    def test_width_validation_errors(self, invalid_value):
        """Invalid width values raise StreamlitInvalidWidthError."""
        with pytest.raises(StreamlitInvalidWidthError):
            st.echarts_chart(_BASIC_SPEC, width=invalid_value)

    @parameterized.expand([("invalid",), (0,), (-100,)])
    def test_height_validation_errors(self, invalid_value):
        """Invalid height values raise StreamlitInvalidHeightError."""
        with pytest.raises(StreamlitInvalidHeightError):
            st.echarts_chart(_BASIC_SPEC, height=invalid_value)


@pytest.mark.require_integration
def test_dataset_source_pyarrow_table() -> None:
    """A PyArrow table ``dataset.source`` is converted to records + dimensions."""
    import pyarrow as pa

    option = _normalize_spec(
        {"dataset": {"source": pa.table({"a": [1, 2], "b": [3, 4]})}}
    )
    assert option["dataset"]["source"] == [{"a": 1, "b": 3}, {"a": 2, "b": 4}]
    assert option["dataset"]["dimensions"] == ["a", "b"]


@pytest.mark.require_integration
def test_dataset_source_polars_dataframe() -> None:
    """A Polars dataframe ``dataset.source`` is converted to records + dimensions."""
    import polars as pl

    option = _normalize_spec(
        {"dataset": {"source": pl.DataFrame({"a": [1, 2], "b": [3, 4]})}}
    )
    assert option["dataset"]["source"] == [{"a": 1, "b": 3}, {"a": 2, "b": 4}]
    assert option["dataset"]["dimensions"] == ["a", "b"]


def test_normalize_spec_deep_copies_mapping() -> None:
    """A mapping input is deep-copied so the user's object is left untouched."""
    original = {"series": [{"data": [1, 2, 3]}]}
    option = _normalize_spec(original)
    option["series"][0]["data"].append(4)

    assert original["series"][0]["data"] == [1, 2, 3]


def test_normalize_spec_invalid_type_raises() -> None:
    """A non-mapping, non-string, non-pyecharts input raises."""
    with pytest.raises(StreamlitInvalidParameterTypeError) as exc:
        _normalize_spec(12345)  # type: ignore[arg-type]

    assert "Invalid `spec` type" in str(exc.value)
    assert "int" in str(exc.value)


def test_normalize_spec_non_object_json_raises() -> None:
    """A JSON string that is not an object (e.g. a list) raises."""
    with pytest.raises(StreamlitInvalidParameterTypeError) as exc:
        _normalize_spec("[1, 2, 3]")

    assert "Invalid `spec` type" in str(exc.value)
    assert "list" in str(exc.value)


def test_serialize_option_rejects_arbitrary_object() -> None:
    """Arbitrary objects are not silently stringified into the spec."""

    class _Custom:
        def __str__(self) -> str:  # pragma: no cover - must not be reached
            return "SHOULD_NOT_APPEAR"

    with pytest.raises(StreamlitAPIException) as exc:
        _serialize_option({"series": _Custom()})

    assert exc.value.error_id == "echarts-spec-not-json-serializable"


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
    assert _resolve_content_width("stretch", spec={}) == "stretch"
    assert _resolve_content_width(500, spec={}) == 500


def test_resolve_content_width_defaults_to_700() -> None:
    """A raw spec with no intrinsic width resolves to the 700px default."""
    assert _resolve_content_width("content", spec={}) == 700


def test_resolve_content_width_uses_pyecharts_width() -> None:
    """A pyecharts chart's own width is used for content width."""
    chart = _FakeEChart(_BASIC_SPEC, width="640px")
    assert _resolve_content_width("content", spec=chart) == 640


def test_resolve_content_ignores_pyecharts_library_defaults() -> None:
    """pyecharts' own InitOpts defaults are not treated as an author's choice.

    pyecharts always fills these in, so honoring them would size a pyecharts
    chart differently from an equivalent dict spec.
    """
    chart = _FakeEChart(_BASIC_SPEC, width="900px", height="500px")

    assert _resolve_content_width("content", spec=chart) == 700
    assert _resolve_content_height("content", spec=chart) == 350


def test_resolve_content_maps_full_size_to_stretch() -> None:
    """A pyecharts chart sized to ``100%`` stretches to the container."""
    chart = _FakeEChart(_BASIC_SPEC, width="100%", height="100%")

    assert _resolve_content_width("content", spec=chart) == "stretch"
    assert _resolve_content_height("content", spec=chart) == "stretch"


def test_resolve_content_warns_and_defaults_on_unsupported_unit() -> None:
    """An unsupported CSS unit falls back to the default with a warning."""
    chart = _FakeEChart(_BASIC_SPEC, width="30em")

    with patch.object(echarts_chart_module._LOGGER, "warning") as mock_warning:
        assert _resolve_content_width("content", spec=chart) == 700

    assert "unsupported" in mock_warning.call_args.args[0]


def test_resolve_content_height_passthrough() -> None:
    """Non-content heights pass through unchanged."""
    assert _resolve_content_height("stretch", spec={}) == "stretch"
    assert _resolve_content_height(300, spec={}) == 300


def test_resolve_content_height_defaults_to_350() -> None:
    """A raw spec with no intrinsic height resolves to the 350px default.

    350px is the frontend's ``defaultChartHeight`` token, which is also the
    rendered height of the Vega-based charts.
    """
    assert _resolve_content_height("content", spec={}) == 350


def test_resolve_content_height_uses_pyecharts_height() -> None:
    """A pyecharts chart's own height is used for content height."""
    chart = _FakeEChart(_BASIC_SPEC, height="360px")
    assert _resolve_content_height("content", spec=chart) == 360


def test_echarts_mixin_dg_returns_self() -> None:
    """``EChartsMixin.dg`` returns the mixin instance."""

    class _OnlyECharts(EChartsMixin):
        pass

    echarts_mixin = _OnlyECharts()
    assert echarts_mixin.dg is echarts_mixin
