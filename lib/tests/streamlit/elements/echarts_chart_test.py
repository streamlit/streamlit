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

import datetime as dt
import decimal
import json
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pyarrow as pa
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit import dataframe_util
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
    StreamlitDataframeConversionError,
    StreamlitDuplicateElementKey,
    StreamlitInvalidHeightError,
    StreamlitInvalidParameterTypeError,
    StreamlitInvalidWidthError,
    StreamlitValueError,
)
from streamlit.proto.EChartsChart_pb2 import EChartsChart as EChartsChartProto
from streamlit.util import calc_hash
from tests.delta_generator_test_case import DeltaGeneratorTestCase

_ECHARTS_LOGGER = echarts_chart_module._LOGGER.name

_BASIC_SPEC: dict[str, Any] = {
    "xAxis": {"type": "category", "data": ["A", "B", "C"]},
    "yAxis": {"type": "value"},
    "series": [{"type": "bar", "data": [5, 20, 36]}],
}

# A ``dataset.source`` that is already JSON (an ECharts 2D array).
_INLINE_DATASET_SPEC: dict[str, Any] = {
    "dataset": {"source": [["x", "y"], ["a", 1]]},
    "series": [{"type": "bar"}],
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
        """A dataframe ``dataset.source`` ships as a named Arrow dataset."""
        df = pd.DataFrame({"product": ["a", "b"], "2015": [43.3, 85.8]})
        st.echarts_chart({"dataset": {"source": df}, "series": [{"type": "bar"}]})

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert len(el.datasets) == 1
        dataset = el.datasets[0]
        assert dataset.has_name
        assert dataset.name == calc_hash(dataset.data.data)
        assert not dataset.data.HasField("styler")
        assert json.loads(el.spec)["dataset"] == {
            "source": {"name": dataset.name},
            "dimensions": ["product", "2015"],
        }
        pd.testing.assert_frame_equal(
            dataframe_util.convert_arrow_bytes_to_pandas_df(dataset.data.data), df
        )
        # The rows travel only as Arrow, not as inline JSON records.
        assert "43.3" not in el.spec

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

    def test_dataset_sources_in_every_option_variant(self):
        """Frames in every option variant ship in the order they are walked."""
        frames = [pd.DataFrame({"v": [i]}) for i in range(6)]
        st.echarts_chart(
            {
                "dataset": {"source": frames[0]},
                "media": [
                    {
                        "query": {"maxWidth": 500},
                        "option": {"dataset": {"source": frames[1]}},
                    }
                ],
                "baseOption": {
                    "timeline": {"data": ["2015"]},
                    "dataset": [{"source": frames[2]}],
                    "media": [{"option": {"dataset": {"source": frames[3]}}}],
                },
                "options": [
                    {
                        "dataset": {"source": frames[4]},
                        "media": [{"option": {"dataset": {"source": frames[5]}}}],
                    }
                ],
            }
        )

        el = self.get_delta_from_queue().new_element.echarts_chart
        spec = json.loads(el.spec)
        placeholders = [
            spec["dataset"]["source"],
            spec["media"][0]["option"]["dataset"]["source"],
            spec["baseOption"]["dataset"][0]["source"],
            spec["baseOption"]["media"][0]["option"]["dataset"]["source"],
            spec["options"][0]["dataset"]["source"],
            spec["options"][0]["media"][0]["option"]["dataset"]["source"],
        ]
        assert placeholders == [{"name": dataset.name} for dataset in el.datasets]
        assert [
            dataframe_util.convert_arrow_bytes_to_pandas_df(dataset.data.data)[
                "v"
            ].tolist()
            for dataset in el.datasets
        ] == [[i] for i in range(6)]

    def test_identical_dataset_sources_share_one_entry(self):
        """Equal frames are content-addressed into a single proto dataset."""
        df = pd.DataFrame({"x": [1, 2]})
        other = pd.DataFrame({"x": [3, 4]})
        st.echarts_chart(
            {"dataset": [{"source": df}, {"source": df.copy()}, {"source": other}]}
        )

        el = self.get_delta_from_queue().new_element.echarts_chart
        sources = [entry["source"] for entry in json.loads(el.spec)["dataset"]]
        assert sources[0] == sources[1]
        assert sources[2] != sources[0]
        assert [{"name": dataset.name} for dataset in el.datasets] == [
            sources[0],
            sources[2],
        ]

    def test_dataset_source_styler_ships_data_only(self):
        """A Styler ``dataset.source`` ships its data without any styling."""
        df = pd.DataFrame({"x": [1, 2]})
        st.echarts_chart(
            {"dataset": [{"source": df.style.highlight_max()}, {"source": df}]}
        )

        el = self.get_delta_from_queue().new_element.echarts_chart
        # The Styler serializes to the same bytes as its plain dataframe.
        assert len(el.datasets) == 1
        assert not el.datasets[0].data.HasField("styler")

    @parameterized.expand(
        [
            ("records", {"dataset": {"source": [{"x": "a", "y": 1}]}}),
            ("array_2d", _INLINE_DATASET_SPEC),
            ("keyed_columns", {"dataset": {"source": {"x": ["a"], "y": [1]}}}),
        ]
    )
    def test_inline_dataset_sources_add_no_arrow_datasets(self, _name, spec):
        """Sources that are already JSON stay inline, with no Arrow datasets."""
        st.echarts_chart(spec)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == spec
        assert len(el.datasets) == 0

    @parameterized.expand(
        [
            ("json_string", json.dumps(_INLINE_DATASET_SPEC)),
            ("pyecharts", _FakeEChart(_INLINE_DATASET_SPEC)),
        ]
    )
    def test_json_inputs_add_no_arrow_datasets(self, _name, spec):
        """JSON string and pyecharts inputs cannot hold frames, so stay as is."""
        st.echarts_chart(spec)

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert json.loads(el.spec) == _INLINE_DATASET_SPEC
        assert len(el.datasets) == 0

    @parameterized.expand(
        [
            (
                "dataframe_conversion",
                "convert_pandas_df_to_arrow_table",
                StreamlitDataframeConversionError("boom"),
            ),
            (
                "arrow_serialization",
                "convert_arrow_table_to_arrow_bytes",
                pa.ArrowInvalid("boom"),
            ),
        ]
    )
    def test_dataset_source_conversion_failure_is_targeted(self, _name, target, error):
        """A failed conversion names ``dataset.source`` and has its own error_id."""
        df = pd.DataFrame({"x": [1]})
        with (
            patch.object(
                echarts_chart_module.dataframe_util, target, side_effect=error
            ),
            pytest.raises(StreamlitDataframeConversionError) as exc,
        ):
            st.echarts_chart({"dataset": {"source": df}})

        assert exc.value.error_id == "echarts-dataset-not-arrow-serializable"
        assert "dataset.source" in str(exc.value)
        assert "boom" in str(exc.value)

    def test_dataset_source_real_arrow_failure_is_targeted(self) -> None:
        """An integer too large for Arrow raises the dataset conversion error."""
        df = pd.DataFrame({"x": [2**70]})

        with pytest.raises(StreamlitDataframeConversionError) as exc:
            st.echarts_chart({"dataset": {"source": df}})

        assert exc.value.error_id == "echarts-dataset-not-arrow-serializable"
        assert "dataset.source" in str(exc.value)
        assert self.get_all_deltas_from_queue() == []

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

    def test_unhashable_on_select_raises_streamlit_value_error(self):
        """Array-like on_select values raise StreamlitValueError, not TypeError."""
        with pytest.raises(StreamlitValueError) as exc:
            st.echarts_chart(_BASIC_SPEC, on_select=["rerun"])

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

    def test_echarts_chart_alt(self):
        """A non-empty alt is stored on the proto; omitted/None/blank leave it unset."""
        st.echarts_chart(_BASIC_SPEC, alt="Bar chart of categories")
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.HasField("alt")
        assert el.alt == "Bar chart of categories"
        assert "aria" not in json.loads(el.spec)

        st.echarts_chart(_BASIC_SPEC)
        assert not self.get_delta_from_queue().new_element.echarts_chart.HasField("alt")

        st.echarts_chart(_BASIC_SPEC, alt=None)
        assert not self.get_delta_from_queue().new_element.echarts_chart.HasField("alt")

        st.echarts_chart(_BASIC_SPEC, alt="  ")
        assert not self.get_delta_from_queue().new_element.echarts_chart.HasField("alt")

    def test_echarts_chart_alt_strips_whitespace(self):
        """Leading and trailing whitespace is stripped from alt."""
        st.echarts_chart(_BASIC_SPEC, alt="  Bar chart of categories  ")
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.HasField("alt")
        assert el.alt == "Bar chart of categories"

    def test_echarts_chart_alt_overrides_author_description(self):
        """alt wins over an author aria.label.description and logs the override."""
        spec = {
            **_BASIC_SPEC,
            "aria": {"label": {"description": "Author description"}},
        }
        with patch("streamlit.elements.echarts_chart._LOGGER.warning") as mock_warning:
            st.echarts_chart(spec, alt="Streamlit alt")
            mock_warning.assert_called_once()
            assert mock_warning.call_args.kwargs.get("stack_info") is True

        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.alt == "Streamlit alt"
        # Author description stays in the wire JSON; override is frontend-only.
        assert (
            json.loads(el.spec)["aria"]["label"]["description"] == "Author description"
        )

    def test_echarts_chart_alt_preserves_adversarial_plain_text(self):
        """Quotes and angle brackets stay literal on the proto (no HTML path)."""
        adversarial = 'Chart of "A < B" & sales <script>alert(1)</script>'
        st.echarts_chart(_BASIC_SPEC, alt=adversarial)
        el = self.get_delta_from_queue().new_element.echarts_chart
        assert el.HasField("alt")
        assert el.alt == adversarial

    def test_display_only_key_id_stable_when_alt_changes(self):
        """A keyed chart keeps its ID when only alt changes."""
        st.echarts_chart(_BASIC_SPEC, key="stable_alt", alt="First name")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        self.script_run_ctx.shared.reset()
        self.clear_queue()

        st.echarts_chart(_BASIC_SPEC, key="stable_alt", alt="Second name")
        id_b = self.get_delta_from_queue().new_element.echarts_chart.id
        assert id_a == id_b

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
        """With a key, neither renderer nor theme participates in the identity."""
        st.echarts_chart(_BASIC_SPEC, key="keyed")
        id_a = self.get_delta_from_queue().new_element.echarts_chart.id

        self.script_run_ctx.shared.reset()
        self.clear_queue()

        st.echarts_chart(_BASIC_SPEC, key="keyed", **{parameter: other_value})
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

    def test_id_changes_when_keyed_chart_toggles_selection(self):
        """A keyed chart's ID changes when on_select switches widget vs display-only.

        Reusing the ID would leave stale widget and private selection state on the
        frontend after the chart became display-only.
        """
        st.echarts_chart(_BASIC_SPEC, key="toggle", on_select="rerun")
        id_widget = self.get_delta_from_queue().new_element.echarts_chart.id

        self.script_run_ctx.shared.reset()
        self.clear_queue()

        st.echarts_chart(_BASIC_SPEC, key="toggle")
        id_display = self.get_delta_from_queue().new_element.echarts_chart.id

        assert id_widget != id_display
        assert id_widget.endswith("toggle")
        assert id_display.endswith("toggle")

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
                "toolbox_tuple",
                {"toolbox": ({"feature": {"brush": {}}},), "series": []},
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
            (
                "media_variant",
                {
                    "media": [
                        {
                            "option": {
                                "series": [{"type": "bar", "selectedMode": "multiple"}]
                            }
                        }
                    ],
                    "series": [],
                },
            ),
        ]
    )
    def test_no_warning_when_spec_enables_selection(self, _name, spec):
        """Specs that do enable a selection don't log a warning."""
        with patch.object(echarts_chart_module._LOGGER, "warning") as mock_warning:
            st.echarts_chart(spec, on_select="rerun")

        mock_warning.assert_not_called()

    def test_selected_mode_false_does_not_enable_selection(self):
        """An explicitly-off series ``selectedMode`` is not treated as enabled."""
        with self.assertLogs(_ECHARTS_LOGGER, level="WARNING") as logs:
            st.echarts_chart(
                {"series": [{"type": "bar", "selectedMode": False}]},
                on_select="rerun",
            )

        assert "doesn't enable any" in logs.output[0]

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


def _convert_source(source: Any) -> tuple[dict[str, Any], pa.Table]:
    """Normalize a spec with one ``dataset.source`` and read back its Arrow table."""
    option, arrow_datasets = _normalize_spec({"dataset": {"source": source}})
    (data_bytes,) = arrow_datasets.values()
    return option["dataset"], pa.ipc.open_stream(data_bytes).read_all()


def test_dataset_source_dtypes_round_trip_through_arrow() -> None:
    """Typed columns travel as Arrow values instead of JSON-normalized strings."""
    precise = 1.23456789012345
    df = pd.DataFrame(
        {
            "naive": pd.to_datetime(["2020-01-01", None]),
            "aware": pd.to_datetime(["2020-01-01", None]).tz_localize("UTC"),
            "date": [dt.date(2020, 1, 1), None],
            "duration": pd.to_timedelta(["1.5ms", None]),
            "int": pd.Series([1, None], dtype="Int64"),
            "float": pd.Series([2.5, None], dtype="Float64"),
            "bool": [True, False],
            "category": pd.Categorical(["a", "b"]),
            "decimal": [decimal.Decimal("1.5"), None],
            "non_finite": [float("inf"), float("nan")],
            "precise": [precise, -precise],
        }
    )

    dataset, table = _convert_source(df)

    assert dataset["dimensions"] == list(df.columns)
    # No value is pre-formatted into the spec JSON.
    assert "2020" not in json.dumps(dataset)
    types = {field.name: field.type for field in table.schema}
    assert pa.types.is_timestamp(types["naive"])
    assert types["naive"].tz is None
    assert types["aware"].tz == "UTC"
    assert pa.types.is_date32(types["date"])
    assert pa.types.is_duration(types["duration"])
    assert pa.types.is_dictionary(types["category"])
    assert pa.types.is_decimal(types["decimal"])
    assert table.column("int").to_pylist() == [1, None]
    assert table.column("float").to_pylist() == [2.5, None]
    assert table.column("bool").to_pylist() == [True, False]
    # Infinity is kept for the browser; NaN becomes a null.
    assert table.column("non_finite").to_pylist() == [float("inf"), None]
    assert table.column("precise").to_pylist() == [precise, -precise]


_INDEXED_DF = pd.DataFrame({"v": [1, 2]}, index=pd.Index(["r1", "r2"], name="row"))
_MULTI_INDEXED_DF = pd.DataFrame(
    {"v": [1, 2]},
    index=pd.MultiIndex.from_tuples([("a", 1), ("a", 2)], names=["g", "n"]),
)


@pytest.mark.parametrize(
    "source",
    [
        _INDEXED_DF,
        pd.DataFrame({"v": [1, 2]}, index=[10, 20]),
        _MULTI_INDEXED_DF,
        pa.Table.from_pandas(_INDEXED_DF),
        pa.Table.from_pandas(_MULTI_INDEXED_DF),
        pa.Table.from_pandas(pd.DataFrame({"v": [1, 2]})),
        pa.Table.from_pandas(_INDEXED_DF, preserve_index=False),
        # ``select`` keeps the pandas metadata naming the dropped index field.
        pa.Table.from_pandas(_INDEXED_DF).select(["v"]),
    ],
    ids=[
        "named_index",
        "unnamed_int_index",
        "multi_index",
        "pyarrow_named_index",
        "pyarrow_multi_index",
        "pyarrow_range_index",
        "pyarrow_without_index",
        "pyarrow_stale_index",
    ],
)
def test_dataset_source_drops_pandas_index(source: Any) -> None:
    """The dataframe index is neither sent nor listed in ``dimensions``."""
    dataset, table = _convert_source(source)

    assert dataset["dimensions"] == ["v"]
    assert table.column_names == ["v"]
    # The browser fails to parse a table whose metadata names missing fields.
    pandas_metadata = table.schema.pandas_metadata
    assert pandas_metadata["index_columns"] == []
    assert [column["field_name"] for column in pandas_metadata["columns"]] == ["v"]


def test_pyarrow_table_source_keeps_pandas_type_tags() -> None:
    """Dropping the index keeps the pandas type tags of the data columns."""
    df = pd.DataFrame(
        {"month": pd.period_range("2020-01", periods=2, freq="M")},
        index=pd.Index([5, 6], name="row"),
    )

    _, table = _convert_source(pa.Table.from_pandas(df))

    (column,) = table.schema.pandas_metadata["columns"]
    assert column["numpy_type"] == "period[M]"


def test_pyarrow_table_source_without_pandas_metadata_is_sent_as_is() -> None:
    """A plain Arrow table is serialized without any rewriting."""
    table = pa.table({"a": [1, 2], "b": [3, 4]})

    option, arrow_datasets = _normalize_spec({"dataset": {"source": table}})

    assert list(arrow_datasets.values()) == [
        dataframe_util.convert_arrow_table_to_arrow_bytes(table)
    ]
    assert option["dataset"]["dimensions"] == ["a", "b"]


def test_pyarrow_table_source_drops_unparseable_pandas_metadata() -> None:
    """Malformed pandas metadata is dropped while other schema metadata is kept."""
    table = pa.table({"v": [1]}).replace_schema_metadata(
        {b"pandas": b"{not json", b"origin": b"test"}
    )

    _, sent = _convert_source(table)

    assert sent.schema.metadata == {b"origin": b"test"}


@pytest.mark.parametrize(
    "source",
    [
        pd.DataFrame([[1, 2]], columns=[1, "1"]),
        pd.DataFrame([[1, 2]], columns=["a", "a"]),
        pa.Table.from_arrays([pa.array([1]), pa.array([2])], names=["a", "a"]),
    ],
    ids=["stringified_collision", "exact_duplicate", "pyarrow_table"],
)
def test_dataset_source_duplicate_column_labels_raise(source: Any) -> None:
    """Column labels that collide as strings are rejected for every source type."""
    with pytest.raises(StreamlitAPIException) as exc:
        _normalize_spec({"dataset": {"source": source}})

    assert exc.value.error_id == "echarts-dataset-duplicate-columns"


def test_dataset_source_multiindex_columns_use_str_labels() -> None:
    """MultiIndex columns use ``str(column)`` as field names and ``dimensions``."""
    columns = pd.MultiIndex.from_tuples([(1, 2), (1, 3)])
    df = pd.DataFrame([[1, 2]], columns=columns)

    dataset, table = _convert_source(df)

    assert table.column_names == ["(1, 2)", "(1, 3)"]
    assert dataset["dimensions"] == table.column_names
    assert table.to_pylist() == [{"(1, 2)": 1, "(1, 3)": 2}]
    # PyArrow's own naming stringifies each level instead.
    assert "('1', '2')" not in dataset["dimensions"]
    # The caller's dataframe keeps its MultiIndex.
    assert df.columns.equals(columns)


def test_dataset_source_mixed_object_column_is_stringified() -> None:
    """A mixed-type object column is converted to strings, like ``st.dataframe``."""
    _, table = _convert_source(pd.DataFrame({"mixed": [1, "a"]}))

    assert table.column("mixed").to_pylist() == ["1", "a"]


def test_dataset_source_polars_arrow_failure_falls_back_to_pandas() -> None:
    """A Polars frame whose ``to_arrow`` fails is converted through pandas."""

    class _FailingPolarsFrame:
        def to_arrow(self) -> pa.Table:
            raise RuntimeError("arrow conversion failed")

        def to_pandas(self) -> pd.DataFrame:
            return pd.DataFrame({"a": [1, 2]})

    with patch.object(
        echarts_chart_module.dataframe_util, "is_polars_dataframe", return_value=True
    ):
        dataset, table = _convert_source(_FailingPolarsFrame())

    assert dataset["dimensions"] == ["a"]
    assert table.column("a").to_pylist() == [1, 2]


@pytest.mark.require_integration
def test_dataset_source_polars_dataframe() -> None:
    """A Polars dataframe ``dataset.source`` is sent through its own Arrow table."""
    import polars as pl

    df = pl.DataFrame({"a": [1, 2], "b": [3, 4]})

    dataset, table = _convert_source(df)

    assert dataset["dimensions"] == ["a", "b"]
    assert table.to_pydict() == {"a": [1, 2], "b": [3, 4]}


@pytest.mark.require_integration
def test_dataset_source_polars_series() -> None:
    """A Polars Series ``dataset.source`` becomes a single named column."""
    import polars as pl

    dataset, table = _convert_source(pl.Series("sales", [1, 2]))

    assert dataset["dimensions"] == ["sales"]
    assert table.to_pydict() == {"sales": [1, 2]}


@pytest.mark.require_integration
def test_dataset_source_polars_lazyframe_is_truncated() -> None:
    """A Polars LazyFrame is collected up to the row limit with a caption."""
    import polars as pl

    with patch.object(
        echarts_chart_module.dataframe_util, "_show_data_information"
    ) as mock_info:
        _, table = _convert_source(pl.LazyFrame({"x": range(10_001)}))

    assert table.num_rows == 10_000
    mock_info.assert_called_once()


def test_normalize_spec_does_not_mutate_user_mapping() -> None:
    """Option/dataset dicts are copied so conversion does not mutate the input."""
    df = pd.DataFrame({"a": [1, 2]})
    original = {
        "dataset": {"source": df},
        "series": [{"data": [1, 2, 3]}],
    }
    option, _ = _normalize_spec(original)

    assert original["dataset"]["source"] is df
    assert "dimensions" not in original["dataset"]
    assert original["series"][0]["data"] == [1, 2, 3]
    option["series"][0]["type"] = "bar"
    assert "type" not in original["series"][0]


def test_normalize_spec_does_not_mutate_dataset_list_with_leading_non_dict() -> None:
    """A dataset list is copied even when the first entry is not a dict."""
    df = pd.DataFrame({"a": [1]})
    dataset_entry = {"source": df}
    original = {"dataset": [None, dataset_entry]}

    option, arrow_datasets = _normalize_spec(original)

    assert original["dataset"][1] is dataset_entry
    assert original["dataset"][1]["source"] is df
    assert option["dataset"][1]["source"] == {"name": next(iter(arrow_datasets))}
    assert option["dataset"][1]["dimensions"] == ["a"]


def test_normalize_spec_converts_tuple_dataset() -> None:
    """A tuple of datasets converts each dataframe ``source``."""
    df = pd.DataFrame({"a": [1]})
    original = {"dataset": ({"source": df},)}

    option, arrow_datasets = _normalize_spec(original)

    assert original["dataset"][0]["source"] is df
    assert option["dataset"][0]["source"] == {"name": next(iter(arrow_datasets))}
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
        option, arrow_datasets = _normalize_spec(original)

    assert original["dataset"]["source"] is source
    assert option["dataset"]["source"] == {"name": next(iter(arrow_datasets))}
    assert len(arrow_datasets) == 1


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
