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
from unittest.mock import patch

import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements import echarts_chart as echarts_chart_module
from streamlit.elements.echarts_chart import (
    EChartsMixin,
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

    def test_dataset_source_dataframe_inside_media_option(self):
        """A dataframe ``dataset.source`` in a media override is converted."""
        df = pd.DataFrame({"x": [1], "y": [2]})
        st.echarts_chart(
            {
                "series": [{"type": "bar"}],
                "media": [
                    {
                        "query": {"maxWidth": 500},
                        "option": {"dataset": {"source": df}},
                    }
                ],
            }
        )

        spec = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)
        assert spec["media"][0]["option"]["dataset"]["source"] == [{"x": 1, "y": 2}]
        assert spec["media"][0]["option"]["dataset"]["dimensions"] == ["x", "y"]

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

    def test_dataset_source_infinities_become_null(self):
        """Infinities in a dataframe source become ``null``, like NaN/NaT."""
        df = pd.DataFrame({"x": [1.0, float("inf"), float("-inf")]})
        st.echarts_chart({"dataset": {"source": df}})

        source = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)[
            "dataset"
        ]["source"]
        assert source[0]["x"] == 1.0
        assert source[1]["x"] is None
        assert source[2]["x"] is None

    def test_dataset_source_nullable_numeric_dtypes(self):
        """Nullable and mixed numeric dtypes convert without crashing the inf check."""
        df = pd.DataFrame(
            {
                "i": pd.Series([1, None], dtype="Int64"),
                "f": pd.Series([2.5, 3.5], dtype="Float64"),
            }
        )
        st.echarts_chart({"dataset": {"source": df}})

        source = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)[
            "dataset"
        ]["source"]
        assert source == [{"i": 1, "f": 2.5}, {"i": None, "f": 3.5}]

    def test_dataset_source_nullable_float_infinities_become_null(self):
        """Infinities in a nullable float column become ``null``."""
        df = pd.DataFrame({"x": pd.Series([1.0, float("inf"), None], dtype="Float64")})
        st.echarts_chart({"dataset": {"source": df}})

        source = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)[
            "dataset"
        ]["source"]
        assert source[0]["x"] == 1.0
        assert source[1]["x"] is None
        assert source[2]["x"] is None

    def test_dataset_source_preserves_high_precision_floats(self):
        """Dataframe floats keep more than pandas' default 10 significant digits."""
        value = 1.23456789012345
        df = pd.DataFrame({"x": [value]})
        st.echarts_chart({"dataset": {"source": df}})

        record = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)[
            "dataset"
        ]["source"][0]
        assert record["x"] == pytest.approx(value, rel=1e-15)

    def test_dataset_source_non_serializable_raises(self):
        """A dataframe pandas cannot JSON-serialize raises a targeted error."""
        df = pd.DataFrame({"x": pd.period_range("2020", periods=2)})
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"dataset": {"source": df}})

        assert "dataset.source" in str(exc.value)
        assert exc.value.error_id == "echarts-dataset-not-json-serializable"

    def test_dataset_source_to_json_failure_is_targeted(self):
        """A ``to_json`` TypeError is re-raised with the dataset error_id."""
        df = pd.DataFrame({"x": [1]})
        with (
            patch.object(pd.DataFrame, "to_json", side_effect=TypeError("boom")),
            pytest.raises(StreamlitAPIException) as exc,
        ):
            st.echarts_chart({"dataset": {"source": df}})

        assert "dataset.source" in str(exc.value)
        assert exc.value.error_id == "echarts-dataset-not-json-serializable"

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

    def test_sentinel_text_in_json_string_label_is_allowed(self):
        """Literal ``--x_x--`` in a label is not treated as a pyecharts callback."""
        raw = json.dumps(
            {
                "title": {"text": "Warning --x_x-- do not click"},
                "series": [{"type": "bar", "data": [1]}],
            }
        )
        st.echarts_chart(raw)

        spec = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)
        assert spec["title"]["text"] == "Warning --x_x-- do not click"

    def test_sentinel_text_in_pyecharts_label_is_allowed(self):
        """A pyecharts dump whose only sentinel is chart text is accepted."""
        chart = _FakeEChart(
            {
                "title": {"text": "Warning --x_x-- do not click"},
                "series": [{"type": "bar", "data": [1]}],
            }
        )
        st.echarts_chart(chart)

        spec = json.loads(self.get_delta_from_queue().new_element.echarts_chart.spec)
        assert spec["title"]["text"] == "Warning --x_x-- do not click"

    def test_malformed_json_mentioning_function_is_parse_error(self):
        """The word ``function`` in a label is not treated as a JS callback."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart('{ "title": "my function"')

        assert exc.value.error_id == "echarts-spec-invalid-json"

    def test_malformed_json_with_arrow_in_string_is_parse_error(self):
        """``=>`` inside an already-parsed JSON string is not a JS callback."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart('{"title": {"text": "a => b"')

        assert exc.value.error_id == "echarts-spec-invalid-json"

    def test_arrow_function_callback_string_raises(self):
        """A JSON string with an arrow-function callback raises a helpful error."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart('{"tooltip": {"formatter": (p) => p}}')

        assert exc.value.error_id == "echarts-js-callbacks-not-supported"

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

    def test_non_list_media_raises(self):
        """A non-list ``media`` value raises a Streamlit API error, not TypeError."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({**_BASIC_SPEC, "media": 1})

        assert exc.value.error_id == "echarts-spec-invalid-structure"
        assert "`media`" in str(exc.value)

    def test_non_list_options_raises(self):
        """A non-list ``options`` value raises a Streamlit API error, not TypeError."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({**_BASIC_SPEC, "options": 1})

        assert exc.value.error_id == "echarts-spec-invalid-structure"
        assert "`options`" in str(exc.value)

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

    @parameterized.expand([("grid3D",), ("geo3D",), ("globe",)])
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

    def test_unsupported_series_detected_inside_media_option(self):
        """Media option overrides are scanned for unsupported series."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart(
                {
                    "series": [{"type": "bar"}],
                    "media": [{"option": {"series": [{"type": "bar3D"}]}}],
                }
            )

        assert exc.value.error_id == "echarts-gl-series-not-supported"

    def test_unsupported_series_in_tuple_raises(self):
        """A tuple of series is walked the same way as a list."""
        with pytest.raises(StreamlitAPIException) as exc:
            st.echarts_chart({"series": ({"type": "bar3D"},)})

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

    @parameterized.expand([("renderer", "svg"), ("theme", None)])
    def test_id_stable_with_key_across_render_params(self, parameter, other_value):
        """With a key, neither renderer nor theme participates in the identity."""
        st.echarts_chart(_BASIC_SPEC, key="keyed")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        self.script_run_ctx.shared.reset()
        self.clear_queue()

        st.echarts_chart(_BASIC_SPEC, key="keyed", **{parameter: other_value})
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


def test_normalize_spec_does_not_mutate_user_mapping() -> None:
    """Option/dataset dicts are copied so conversion does not mutate the input."""
    df = pd.DataFrame({"a": [1, 2]})
    original = {
        "dataset": {"source": df},
        "series": [{"data": [1, 2, 3]}],
    }
    option = _normalize_spec(original)

    assert original["dataset"]["source"] is df
    assert original["series"][0]["data"] == [1, 2, 3]
    option["series"][0]["type"] = "bar"
    assert "type" not in original["series"][0]


def test_normalize_spec_does_not_mutate_dataset_list_with_leading_non_dict() -> None:
    """A dataset list is copied even when the first entry is not a dict."""
    df = pd.DataFrame({"a": [1]})
    dataset_entry = {"source": df}
    original = {"dataset": [None, dataset_entry]}

    option = _normalize_spec(original)

    assert original["dataset"][1] is dataset_entry
    assert original["dataset"][1]["source"] is df
    assert option["dataset"][1]["source"] == [{"a": 1}]
    assert option["dataset"][1]["dimensions"] == ["a"]


def test_normalize_spec_converts_tuple_dataset() -> None:
    """A tuple of datasets converts each dataframe ``source``."""
    df = pd.DataFrame({"a": [1]})
    original = {"dataset": ({"source": df},)}

    option = _normalize_spec(original)

    assert original["dataset"][0]["source"] is df
    assert option["dataset"][0]["source"] == [{"a": 1}]
    assert option["dataset"][0]["dimensions"] == ["a"]


def test_normalize_spec_accepts_source_that_cannot_be_deepcopied() -> None:
    """Dataframe-like sources are not deep-copied before conversion."""

    class _OpaqueSource:
        def __deepcopy__(self, memo: dict[str, Any]) -> _OpaqueSource:
            raise TypeError("not deepcopyable")

    source = _OpaqueSource()
    df = pd.DataFrame({"a": [1]})
    original = {"dataset": {"source": source}}

    with (
        patch.object(
            echarts_chart_module.dataframe_util,
            "is_dataframe_like",
            lambda value: value is source,
        ),
        patch.object(
            echarts_chart_module.dataframe_util,
            "convert_anything_to_pandas_df",
            lambda _value: df,
        ),
    ):
        option = _normalize_spec(original)

    assert original["dataset"]["source"] is source
    assert option["dataset"]["source"] == [{"a": 1}]


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


def test_serialize_option_uses_compact_separators() -> None:
    """The wire payload omits insignificant JSON whitespace."""
    assert _serialize_option({"a": 1, "b": [2]}) == '{"a":1,"b":[2]}'


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
    assert mock_warning.call_args.kwargs["stack_info"] is True


def test_resolve_content_treats_blank_pyecharts_size_as_unset() -> None:
    """Blank InitOpts width/height are treated as unset, not unsupported."""
    chart = _FakeEChart(_BASIC_SPEC, width="", height="   ")

    with patch.object(echarts_chart_module._LOGGER, "warning") as mock_warning:
        assert _resolve_content_width("content", spec=chart) == 700
        assert _resolve_content_height("content", spec=chart) == 350

    mock_warning.assert_not_called()


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
