# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import json
from datetime import date
from functools import reduce
from typing import Callable

import altair as alt
import pandas as pd
import pytest
from parameterized import parameterized

import streamlit as st
from streamlit.elements import arrow_altair as altair
from streamlit.elements.arrow_altair import ChartType
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import bytes_to_data_frame
from tests.delta_generator_test_case import DeltaGeneratorTestCase
from tests.streamlit import pyspark_mocks, snowpark_mocks
from tests.testutil import assert_frame_not_equal


def _deep_get(dictionary, *keys):
    return reduce(
        lambda d, key: d.get(key, None) if isinstance(d, dict) else None,
        keys,
        dictionary,
    )


ST_CHART_ARGS = [
    (st._arrow_area_chart, "area"),
    (st._arrow_bar_chart, "bar"),
    (st._arrow_line_chart, "line"),
    (st._arrow_scatter_chart, "circle"),
]


class ArrowAltairTest(DeltaGeneratorTestCase):
    """Test ability to marshall arrow_altair_chart proto."""

    def test_altair_chart(self):
        """Test that it can be called with args."""
        df = pd.DataFrame([["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]).T
        chart = alt.Chart(df).mark_bar().encode(x="a", y="b")
        EXPECTED_DATAFRAME = pd.DataFrame(
            {
                "a": ["A", "B", "C", "D"],
                "b": [28, 55, 43, 91],
            }
        )

        st._arrow_altair_chart(chart)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        self.assertEqual(proto.HasField("data"), False)
        self.assertEqual(len(proto.datasets), 1)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data), EXPECTED_DATAFRAME
        )

        spec_dict = json.loads(proto.spec)
        self.assertEqual(
            spec_dict["encoding"],
            {
                "y": {"field": "b", "type": "quantitative"},
                "x": {"field": "a", "type": "nominal"},
            },
        )
        self.assertEqual(spec_dict["data"], {"name": proto.datasets[0].name})
        self.assertIn(spec_dict["mark"], ["bar", {"type": "bar"}])
        self.assertTrue("encoding" in spec_dict)

    def test_date_column_utc_scale(self):
        """Test that columns with date values have UTC time scale"""
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart, _ = altair._generate_chart(ChartType.LINE, df)
        st._arrow_altair_chart(chart)
        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        spec_dict = json.loads(proto.spec)

        # The x axis should have scale="utc", because it uses date values.
        x_scale = _deep_get(spec_dict, "encoding", "x", "scale", "type")
        self.assertEqual(x_scale, "utc")

        # The y axis should _not_ have scale="utc", because it doesn't
        # use date values.
        y_scale = _deep_get(spec_dict, "encoding", "y", "scale", "type")
        self.assertNotEqual(y_scale, "utc")

    @parameterized.expand(
        [
            ("streamlit", "streamlit"),
            (None, ""),
        ]
    )
    def test_theme(self, theme_value, proto_value):
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart, _ = altair._generate_chart(ChartType.LINE, df)
        st._arrow_altair_chart(chart, theme=theme_value)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.arrow_vega_lite_chart.theme, proto_value)

    def test_bad_theme(self):
        df = pd.DataFrame(
            {"index": [date(2019, 8, 9), date(2019, 8, 10)], "numbers": [1, 10]}
        ).set_index("index")

        chart, _ = altair._generate_chart(ChartType.LINE, df)
        with self.assertRaises(StreamlitAPIException) as exc:
            st._arrow_altair_chart(chart, theme="bad_theme")

        self.assertEqual(
            f'You set theme="bad_theme" while Streamlit charts only support theme=”streamlit” or theme=None to fallback to the default library theme.',
            str(exc.exception),
        )


class ArrowChartsTest(DeltaGeneratorTestCase):
    """Test Arrow charts."""

    @parameterized.expand(ST_CHART_ARGS)
    def test_empty_arrow_chart(self, chart_command: Callable, altair_type: str):
        """Test arrow chart with no arguments."""
        EXPECTED_DATAFRAME = pd.DataFrame()

        # Make some mutations that arrow_altair.prep_data() does.
        column_names = list(
            EXPECTED_DATAFRAME.columns
        )  # list() converts RangeIndex, etc, to regular list.
        str_column_names = [str(c) for c in column_names]
        EXPECTED_DATAFRAME.columns = pd.Index(str_column_names)

        chart_command()

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_implicit_x_and_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st._arrow_line_chart with implicit x and y."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, 20, 30, 50]], columns=["index--p5bJXXpQgvPz6yvQMFiy", "a", "b", "c"]
        )

        chart_command(df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_wide_format_output(
            chart_spec, "index--p5bJXXpQgvPz6yvQMFiy", ["a", "b", "c"]
        )
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_pyspark_dataframe(
        self, chart_command: Callable, altair_type: str
    ):
        spark_df = pyspark_mocks.DataFrame(is_numpy_arr=True)
        EXPECTED_DATAFRAME = (
            spark_df.toPandas()
            .reset_index(names="index--p5bJXXpQgvPz6yvQMFiy")
            .loc[0:9999, :]
        )

        chart_command(spark_df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_wide_format_output(
            chart_spec, "index--p5bJXXpQgvPz6yvQMFiy", ["A", "B", "C", "D"]
        )

        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_snowpark_dataframe(
        self, chart_command: Callable, altair_type: str
    ):
        snow_df = snowpark_mocks.DataFrame()
        EXPECTED_DATAFRAME = (
            pd.DataFrame(snow_df.collect())
            .reset_index(names="index--p5bJXXpQgvPz6yvQMFiy")
            .loc[0:9999, :]
        )
        EXPECTED_DATAFRAME.columns = EXPECTED_DATAFRAME.columns.astype(str)

        chart_command(snow_df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_wide_format_output(
            chart_spec, "index--p5bJXXpQgvPz6yvQMFiy", ["0", "1", "2", "3"]
        )

        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_explicit_x_and_implicit_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st._arrow_line_chart with explicit x and implicit y."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        chart_command(df, x="a")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_wide_format_output(chart_spec, "a", ["b", "c"])
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_implicit_x_and_explicit_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st._arrow_line_chart with implicit x and explicit y."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, 30]], columns=["index--p5bJXXpQgvPz6yvQMFiy", "b"]
        )

        chart_command(df, y="b")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_long_format_output(chart_spec, "index--p5bJXXpQgvPz6yvQMFiy", "b")
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_implicit_x_and_explicit_y_sequence(
        self, chart_command: Callable, altair_type: str
    ):
        """Test st._arrow_line_chart with implicit x and explicit y sequence."""
        df = pd.DataFrame([[20, 30, 50, 60]], columns=["a", "b", "c", "d"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, 30, 50]], columns=["index--p5bJXXpQgvPz6yvQMFiy", "b", "c"]
        )

        chart_command(df, y=["b", "c"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_wide_format_output(
            chart_spec, "index--p5bJXXpQgvPz6yvQMFiy", ["b", "c"]
        )
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_explicit_x_and_y(
        self, chart_command: Callable, altair_type: str
    ):
        """Test x/y-support for built-in charts."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30]], columns=["a", "b"])

        chart_command(df, x="a", y="b", width=640, height=480)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(chart_spec["encoding"]["y"]["field"], "b")
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_explicit_x_and_y_sequence(
        self, chart_command: Callable, altair_type: str
    ):
        """Test support for explicit wide-format tables (i.e. y is a sequence)."""
        df = pd.DataFrame([[20, 30, 50, 60]], columns=["a", "b", "c", "d"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        chart_command(df, x="a", y=["b", "c"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])
        self.assert_wide_format_output(chart_spec, "a", ["b", "c"])

        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_color_value(
        self, chart_command: Callable, altair_type: str
    ):
        """Test color support for built-in charts."""
        df = pd.DataFrame([[20, 30]], columns=["a", "b"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30]], columns=["a", "b"])

        chart_command(df, x="a", y="b", color="#f00")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["encoding"]["color"]["value"], "#f00")

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_color_column(
        self, chart_command: Callable, altair_type: str
    ):
        """Test color support for built-in charts."""
        df = pd.DataFrame(
            {
                "x": [0, 1, 2],
                "y": [22, 21, 20],
                "tuple3_int_color": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
                "tuple4_int_int_color": [
                    [255, 0, 0, 51],
                    [0, 255, 0, 51],
                    [0, 0, 255, 51],
                ],
                "tuple4_int_float_color": [
                    [255, 0, 0, 0.2],
                    [0, 255, 0, 0.2],
                    [0, 0, 255, 0.2],
                ],
                "tuple3_float_color": [
                    [1.0, 0.0, 0.0],
                    [0.0, 1.0, 0.0],
                    [0.0, 0.0, 1.0],
                ],
                "tuple4_float_float_color": [
                    [1.0, 0.0, 0.0, 0.2],
                    [0.0, 1.0, 0.0, 0.2],
                    [0.0, 0.0, 1.0, 0.2],
                ],
                "hex3_color": ["#f00", "#0f0", "#00f"],
                "hex4_color": ["#f008", "#0f08", "#00f8"],
                "hex6_color": ["#ff0000", "#00ff00", "#0000ff"],
                "hex8_color": ["#ff000088", "#00ff0088", "#0000ff88"],
            }
        )

        color_columns = sorted(set(df.columns))
        color_columns.remove("x")
        color_columns.remove("y")

        expected_values = pd.DataFrame(
            {
                "tuple3": ["rgb(255, 0, 0)", "rgb(0, 255, 0)", "rgb(0, 0, 255)"],
                "tuple4": [
                    "rgba(255, 0, 0, 0.2)",
                    "rgba(0, 255, 0, 0.2)",
                    "rgba(0, 0, 255, 0.2)",
                ],
                "hex3": ["#f00", "#0f0", "#00f"],
                "hex6": ["#ff0000", "#00ff00", "#0000ff"],
                "hex4": ["#f008", "#0f08", "#00f8"],
                "hex8": ["#ff000088", "#00ff0088", "#0000ff88"],
            }
        )

        def get_expected_color_values(col_name):
            for prefix, expected_color_values in expected_values.items():
                if col_name.startswith(prefix):
                    return expected_color_values

        for color_column in color_columns:
            expected_color_values = get_expected_color_values(color_column)

            chart_command(df, x="x", y="y", color=color_column)

            proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
            chart_spec = json.loads(proto.spec)

            self.assertEqual(chart_spec["encoding"]["color"]["field"], color_column)

            # Manually-specified colors should not have a legend
            self.assertEqual(chart_spec["encoding"]["color"]["legend"], None)

            # Manually-specified colors are set via the color scale's range property.
            self.assertTrue(chart_spec["encoding"]["color"]["scale"]["range"])

            proto_df = bytes_to_data_frame(proto.datasets[0].data.data)

            pd.testing.assert_series_equal(
                proto_df[color_column],
                expected_color_values,
                check_names=False,
            )

    @parameterized.expand(ST_CHART_ARGS)
    def test_arrow_chart_with_explicit_wide_table_and_color_sequence(
        self, chart_command: Callable, altair_type: str
    ):
        """Test color support for built-in charts with wide-format table."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        chart_command(df, x="a", y=["b", "c"], color=["#f00", "#0ff"])

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], [altair_type, {"type": altair_type}])

        # Color should be set to the melted column name.
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

        # Automatically-specified colors should have no legend title.
        self.assertEqual(chart_spec["encoding"]["color"]["title"], " ")

        # Automatically-specified colors should have a legend
        self.assertNotEqual(chart_spec["encoding"]["color"]["legend"], None)

        bytes_to_data_frame(proto.datasets[0].data.data)

    @parameterized.expand(
        [
            (st._arrow_area_chart, "a", "foooo"),
            (st._arrow_bar_chart, "not-valid", "b"),
            (st._arrow_line_chart, "foo", "bar"),
            (st._arrow_line_chart, None, "bar"),
            (st._arrow_line_chart, "foo", None),
            (st._arrow_line_chart, "a", ["b", "foo"]),
            (st._arrow_line_chart, None, "variable"),
            (st._arrow_line_chart, "variable", ["a", "b"]),
        ]
    )
    def test_arrow_chart_with_x_y_invalid_input(
        self,
        chart_command: Callable,
        x: str,
        y: str,
    ):
        """Test x/y support for built-in charts with invalid input."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])

        with pytest.raises(StreamlitAPIException):
            chart_command(df, x=x, y=y)

    def test_arrow_chart_with_x_y_on_sliced_data(
        self,
    ):
        """Test x/y-support for built-in charts on sliced data."""
        df = pd.DataFrame([[20, 30, 50], [60, 70, 80]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame([[20, 30], [60, 70]], columns=["a", "b"])[1:]

        # Use all data after first item
        st.line_chart(df[1:], x="a", y="b")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["encoding"]["x"]["field"], "a")
        self.assertEqual(chart_spec["encoding"]["y"]["field"], "b")

        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    def test_arrow_line_chart_with_named_index(self):
        """Test st._arrow_line_chart with a named index."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        df.set_index("a", inplace=True)

        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, 30, 50]],
            columns=["a", "b", "c"],
            index=pd.RangeIndex(0, 1, 1),
        )

        st._arrow_line_chart(df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], ["line", {"type": "line"}])
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    def test_arrow_area_chart(self):
        """Test st._arrow_area_chart."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, 20, 30, 50]],
            columns=["index--p5bJXXpQgvPz6yvQMFiy", "a", "b", "c"],
        )

        st._arrow_area_chart(df)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)
        self.assertIn(chart_spec["mark"], ["area", {"type": "area"}])
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    def test_arrow_bar_chart(self):
        """Test st._arrow_bar_chart."""
        df = pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, 20, 30, 50]],
            columns=["index--p5bJXXpQgvPz6yvQMFiy", "a", "b", "c"],
        )

        st._arrow_bar_chart(df, width=640, height=480)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertIn(chart_spec["mark"], ["bar", {"type": "bar"}])
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_unused_columns_are_dropped(
        self, chart_command: Callable, altair_type: str
    ):
        """Test built-in charts drop columns that are not used."""

        df = pd.DataFrame(
            [[5, 10, 20, 30, 35, 40, 50, 60]],
            columns=["z", "a", "b", "c", "x", "d", "e", "f"],
        )

        if chart_command == st._arrow_scatter_chart:
            chart_command(df, x="a", y=["b", "c"], color="d", size="e")
            EXPECTED_DATAFRAME = pd.DataFrame(
                [[10, 40, 50, 20, 30]], columns=["a", "d", "e", "b", "c"]
            )
        else:
            chart_command(df, x="a", y=["b", "c"], color="d")
            EXPECTED_DATAFRAME = pd.DataFrame(
                [[10, 40, 20, 30]], columns=["a", "d", "b", "c"]
            )

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        json.loads(proto.spec)

        bytes_to_data_frame(proto.datasets[0].data.data)

        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    @parameterized.expand(ST_CHART_ARGS)
    def test_original_df_is_untouched(self, chart_command: Callable, altair_type: str):
        """Test that when we modify the outgoing DF we don't mutate the input DF."""
        df = pd.DataFrame([[20, 30, 50, 60, 70]], columns=["a", "b", "c", "d", "e"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[20, 60, 30, 50]], columns=["a", "d", "b", "c"]
        )

        chart_command(df, x="a", y=["b", "c"], color="d")

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart

        output_df = bytes_to_data_frame(proto.datasets[0].data.data)

        self.assertNotEqual(id(df), id(output_df))
        self.assertNotEqual(id(df), id(EXPECTED_DATAFRAME))
        self.assertNotEqual(id(output_df), id(EXPECTED_DATAFRAME))

        assert_frame_not_equal(df, output_df)
        assert_frame_not_equal(df, EXPECTED_DATAFRAME)
        pd.testing.assert_frame_equal(output_df, EXPECTED_DATAFRAME)

    def assert_wide_format_output(self, chart_spec, x_column, y_columns):
        self.assertEqual(chart_spec["encoding"]["x"]["field"], x_column)

        # When y is a sequence, we tell Vega Lite to melt the data from wide to long format in the
        # frontend by using transforms.
        self.assertEqual(chart_spec["transform"][0]["fold"], y_columns)
        self.assertEqual(
            chart_spec["transform"][0]["as"],
            ["color--p5bJXXpQgvPz6yvQMFiy", "values--p5bJXXpQgvPz6yvQMFiy"],
        )

        # The melted 'y' field should have a unique name we hardcoded.
        self.assertEqual(
            chart_spec["encoding"]["y"]["field"], "values--p5bJXXpQgvPz6yvQMFiy"
        )

        # The melted 'color' field should have a unique name we hardcoded.
        self.assertEqual(
            chart_spec["encoding"]["color"]["field"], "color--p5bJXXpQgvPz6yvQMFiy"
        )

    def assert_long_format_output(self, chart_spec, x_column, y_column):
        self.assertEqual(chart_spec["encoding"]["x"]["field"], x_column)
        self.assertEqual(chart_spec["encoding"]["y"]["field"], y_column)

        self.assertEqual(chart_spec.get("transform", None), None)

        if "color" in chart_spec["encoding"]:
            self.assertNotEqual(
                chart_spec["encoding"]["color"].get("field", None),
                "color--p5bJXXpQgvPz6yvQMFiy",
            )
