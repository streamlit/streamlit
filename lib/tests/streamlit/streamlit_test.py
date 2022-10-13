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

"""Streamlit Unit test."""

import json
import os
import re
import sys
import textwrap
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd
from google.protobuf import json_format
from parameterized import parameterized

import streamlit as st
from streamlit import __version__
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Alert_pb2 import Alert
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from tests import testutil


def get_version():
    """Get version by parsing out setup.py."""
    dirname = os.path.dirname(__file__)
    base_dir = os.path.abspath(os.path.join(dirname, "../.."))
    pattern = re.compile(r"(?:.*VERSION = \")(?P<version>.*)(?:\"  # PEP-440$)")
    for line in open(os.path.join(base_dir, "setup.py")).readlines():
        m = pattern.match(line)
        if m:
            return m.group("version")


class StreamlitTest(unittest.TestCase):
    """Test Streamlit.__init__.py."""

    def test_streamlit_version(self):
        """Test streamlit.__version__."""
        self.assertEqual(__version__, get_version())

    def test_get_option(self):
        """Test streamlit.get_option."""
        # This is set in lib/tests/conftest.py to False
        self.assertEqual(False, st.get_option("browser.gatherUsageStats"))

    def test_public_api(self):
        """Test that we don't accidentally remove (or add) symbols
        to the public `st` API.
        """
        api = {
            k
            for k, v in st.__dict__.items()
            if not k.startswith("_") and not isinstance(v, type(st))
        }
        self.assertEqual(
            api,
            {
                # DeltaGenerator methods:
                "altair_chart",
                "area_chart",
                "audio",
                "balloons",
                "bar_chart",
                "bokeh_chart",
                "button",
                "caption",
                "camera_input",
                "checkbox",
                "code",
                "columns",
                "tabs",
                "container",
                "dataframe",
                "date_input",
                "download_button",
                "expander",
                "pydeck_chart",
                "empty",
                "error",
                "exception",
                "file_uploader",
                "form",
                "form_submit_button",
                "graphviz_chart",
                "header",
                "help",
                "image",
                "info",
                "json",
                "latex",
                "line_chart",
                "map",
                "markdown",
                "metric",
                "multiselect",
                "number_input",
                "plotly_chart",
                "progress",
                "pyplot",
                "radio",
                "selectbox",
                "select_slider",
                "slider",
                "snow",
                "subheader",
                "success",
                "table",
                "text",
                "text_area",
                "text_input",
                "time_input",
                "title",
                "vega_lite_chart",
                "video",
                "warning",
                "write",
                "color_picker",
                "sidebar",
                # Other modules the user should have access to:
                "echo",
                "spinner",
                "set_page_config",
                "stop",
                "cache",
                "secrets",
                "session_state",
                # Beta APIs:
                "beta_container",
                "beta_expander",
                "beta_columns",
                # Experimental APIs:
                "experimental_user",
                "experimental_singleton",
                "experimental_memo",
                "experimental_get_query_params",
                "experimental_set_query_params",
                "experimental_rerun",
                "experimental_show",
                "get_option",
                "set_option",
            },
        )


class StreamlitAPITest(testutil.DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_legacy_altair_chart(self):
        """Test st._legacy_altair_chart."""
        import altair as alt

        df = pd.DataFrame(np.random.randn(3, 3), columns=["a", "b", "c"])

        c = (
            alt.Chart(df)
            .mark_circle()
            .encode(x="a", y="b", size="c", color="c")
            .interactive()
        )
        st._legacy_altair_chart(c)

        el = self.get_delta_from_queue().new_element
        spec = json.loads(el.vega_lite_chart.spec)

        # Checking Vega-Lite is a lot of work so rather than doing that, we
        # just checked to see if the spec data name matches the dataset.
        self.assertEqual(
            spec.get("data").get("name"), el.vega_lite_chart.datasets[0].name
        )

    def test_st_arrow_altair_chart(self):
        """Test st._arrow_altair_chart."""
        import altair as alt

        df = pd.DataFrame(np.random.randn(3, 3), columns=["a", "b", "c"])

        c = (
            alt.Chart(df)
            .mark_circle()
            .encode(x="a", y="b", size="c", color="c")
            .interactive()
        )
        st._arrow_altair_chart(c)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        spec = json.loads(proto.spec)

        # Checking Vega-Lite is a lot of work so rather than doing that, we
        # just checked to see if the spec data name matches the dataset.
        self.assertEqual(spec.get("data").get("name"), proto.datasets[0].name)

    def test_st_legacy_area_chart(self):
        """Test st._legacy_area_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=["a", "b", "c"])
        st._legacy_area_chart(df, width=640, height=480)

        el = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(el.spec)
        self.assertEqual(chart_spec["mark"], "area")
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        self.assertEqual(
            el.datasets[0].data.columns.plain_index.data.strings.data,
            ["index", "variable", "value"],
        )

        data = json.loads(json_format.MessageToJson(el.datasets[0].data.data))
        result = [x["int64s"]["data"] for x in data["cols"] if "int64s" in x]
        self.assertEqual(result[1], ["10", "20", "30"])

    def test_st_arrow_area_chart(self):
        """Test st._arrow_area_chart."""
        from streamlit.type_util import bytes_to_data_frame

        df = pd.DataFrame([[10, 20, 30]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, "a", 10], [0, "b", 20], [0, "c", 30]],
            index=[0, 1, 2],
            columns=["index", "variable", "value"],
        )
        st._arrow_area_chart(df, width=640, height=480)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["mark"], "area")
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    def test_st_balloons(self):
        """Test st.balloons."""
        st.balloons()
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.balloons.show, True)

    def test_st_legacy_bar_chart(self):
        """Test st._legacy_bar_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=["a", "b", "c"])

        st._legacy_bar_chart(df, width=640, height=480)

        el = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(el.spec)
        self.assertEqual(chart_spec["mark"], "bar")
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        self.assertEqual(
            el.datasets[0].data.columns.plain_index.data.strings.data,
            ["index", "variable", "value"],
        )

        data = json.loads(json_format.MessageToJson(el.datasets[0].data.data))
        result = [x["int64s"]["data"] for x in data["cols"] if "int64s" in x]

        self.assertEqual(result[1], ["10", "20", "30"])

    def test_st_arrow_bar_chart(self):
        """Test st._arrow_bar_chart."""
        from streamlit.type_util import bytes_to_data_frame

        df = pd.DataFrame([[10, 20, 30]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, "a", 10], [0, "b", 20], [0, "c", 30]],
            index=[0, 1, 2],
            columns=["index", "variable", "value"],
        )

        st._arrow_bar_chart(df, width=640, height=480)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["mark"], "bar")
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    def test_st_code(self):
        """Test st.code."""
        st.code("print('My string = %d' % my_value)", language="python")
        expected = textwrap.dedent(
            """
            ```python
            print('My string = %d' % my_value)
            ```
        """
        )

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.body, expected.strip())

    def test_st_legacy_dataframe(self):
        """Test st._legacy_dataframe."""
        df = pd.DataFrame({"one": [1, 2], "two": [11, 22]})

        st._legacy_dataframe(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.data_frame.data.cols[0].int64s.data, [1, 2])
        self.assertEqual(
            el.data_frame.columns.plain_index.data.strings.data, ["one", "two"]
        )

    def test_st_arrow_dataframe(self):
        """Test st._arrow_dataframe."""
        from streamlit.type_util import bytes_to_data_frame

        df = pd.DataFrame({"one": [1, 2], "two": [11, 22]})

        st._arrow_dataframe(df)

        proto = self.get_delta_from_queue().new_element.arrow_data_frame
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), df)

    def test_st_empty(self):
        """Test st.empty."""
        st.empty()

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.empty, EmptyProto())

    def test_st_error(self):
        """Test st.error."""
        st.error("some error")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some error")
        self.assertEqual(el.alert.format, Alert.ERROR)

    def test_st_error_with_icon(self):
        """Test st.error with icon."""
        st.error("some error", icon="😱")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some error")
        self.assertEqual(el.alert.icon, "😱")
        self.assertEqual(el.alert.format, Alert.ERROR)

    @parameterized.expand([(True,), (False,)])
    def test_st_exception(self, show_error_details: bool):
        """Test st.exception."""
        # client.showErrorDetails has no effect on code that calls
        # st.exception directly. This test should have the same result
        # regardless fo the config option.
        with testutil.patch_config_options(
            {"client.showErrorDetails": show_error_details}
        ):
            e = RuntimeError("Test Exception")
            st.exception(e)

            el = self.get_delta_from_queue().new_element
            self.assertEqual(el.exception.type, "RuntimeError")
            self.assertEqual(el.exception.message, "Test Exception")
            # We will test stack_trace when testing
            # streamlit.elements.exception_element
            self.assertEqual(el.exception.stack_trace, [])

    def test_st_header(self):
        """Test st.header."""
        st.header("some header")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some header")
        self.assertEqual(el.heading.tag, "h2")

    def test_st_header_with_anchor(self):
        """Test st.header with anchor."""
        st.header("some header", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some header")
        self.assertEqual(el.heading.tag, "h2")
        self.assertEqual(el.heading.anchor, "some-anchor")

    def test_st_help(self):
        """Test st.help."""
        st.help(st.header)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.doc_string.name, "header")
        self.assertEqual(el.doc_string.module, "streamlit")
        self.assertTrue(
            el.doc_string.doc_string.startswith("Display text in header formatting.")
        )
        self.assertEqual(el.doc_string.type, "<class 'method'>")
        if sys.version_info < (3, 9):
            # Python < 3.9 represents the signature slightly differently
            self.assertEqual(
                el.doc_string.signature,
                "(body: object, anchor: Union[str, NoneType] = None) -> 'DeltaGenerator'",
            )
        else:
            self.assertEqual(
                el.doc_string.signature,
                "(body: object, anchor: Optional[str] = None) -> 'DeltaGenerator'",
            )

    def test_st_info(self):
        """Test st.info."""
        st.info("some info")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some info")
        self.assertEqual(el.alert.format, Alert.INFO)

    def test_st_info_with_icon(self):
        """Test st.info with icon."""
        st.info("some info", icon="👉🏻")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some info")
        self.assertEqual(el.alert.icon, "👉🏻")
        self.assertEqual(el.alert.format, Alert.INFO)

    def test_st_json(self):
        """Test st.json."""
        st.json('{"some": "json"}')

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.json.body, '{"some": "json"}')

        # Test that an object containing non-json-friendly keys can still
        # be displayed.  Resultant json body will be missing those keys.

        n = np.array([1, 2, 3, 4, 5])
        data = {n[0]: "this key will not render as JSON", "array": n}
        st.json(data)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.json.body, '{"array": "array([1, 2, 3, 4, 5])"}')

    def test_st_legacy_line_chart(self):
        """Test st._legacy_line_chart."""
        df = pd.DataFrame([[10, 20, 30]], columns=["a", "b", "c"])
        st._legacy_line_chart(df, width=640, height=480)

        el = self.get_delta_from_queue().new_element.vega_lite_chart
        chart_spec = json.loads(el.spec)
        self.assertEqual(chart_spec["mark"], "line")
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)

        self.assertEqual(
            el.datasets[0].data.columns.plain_index.data.strings.data,
            ["index", "variable", "value"],
        )

        data = json.loads(json_format.MessageToJson(el.datasets[0].data.data))
        result = [x["int64s"]["data"] for x in data["cols"] if "int64s" in x]

        self.assertEqual(result[1], ["10", "20", "30"])

    def test_st_arrow_line_chart(self):
        """Test st._arrow_line_chart."""
        from streamlit.type_util import bytes_to_data_frame

        df = pd.DataFrame([[10, 20, 30]], columns=["a", "b", "c"])
        EXPECTED_DATAFRAME = pd.DataFrame(
            [[0, "a", 10], [0, "b", 20], [0, "c", 30]],
            index=[0, 1, 2],
            columns=["index", "variable", "value"],
        )
        st._arrow_line_chart(df, width=640, height=480)

        proto = self.get_delta_from_queue().new_element.arrow_vega_lite_chart
        chart_spec = json.loads(proto.spec)

        self.assertEqual(chart_spec["mark"], "line")
        self.assertEqual(chart_spec["width"], 640)
        self.assertEqual(chart_spec["height"], 480)
        pd.testing.assert_frame_equal(
            bytes_to_data_frame(proto.datasets[0].data.data),
            EXPECTED_DATAFRAME,
        )

    def test_st_markdown(self):
        """Test st.markdown."""
        st.markdown("    some markdown  ")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.body, "some markdown")

        # test the unsafe_allow_html keyword
        st.markdown("    some markdown  ", unsafe_allow_html=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.markdown.body, "some markdown")
        self.assertTrue(el.markdown.allow_html)

    def test_st_progress(self):
        """Test st.progress."""
        st.progress(51)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.progress.value, 51)

    def test_st_plotly_chart_simple(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField("url"), False)
        self.assertNotEqual(el.plotly_chart.figure.spec, "")
        self.assertNotEqual(el.plotly_chart.figure.config, "")
        self.assertEqual(el.plotly_chart.use_container_width, False)

    def test_st_plotly_chart_use_container_width_true(self):
        """Test st.plotly_chart."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        st.plotly_chart(data, use_container_width=True)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField("url"), False)
        self.assertNotEqual(el.plotly_chart.figure.spec, "")
        self.assertNotEqual(el.plotly_chart.figure.config, "")
        self.assertEqual(el.plotly_chart.use_container_width, True)

    def test_st_plotly_chart_sharing(self):
        """Test st.plotly_chart when sending data to Plotly's service."""
        import plotly.graph_objs as go

        trace0 = go.Scatter(x=[1, 2, 3, 4], y=[10, 15, 13, 17])

        data = [trace0]

        with patch(
            "streamlit.elements.plotly_chart." "_plot_to_url_or_load_cached_url"
        ) as plot_patch:
            plot_patch.return_value = "the_url"
            st.plotly_chart(data, sharing="public")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.plotly_chart.HasField("figure"), False)
        self.assertNotEqual(el.plotly_chart.url, "the_url")
        self.assertEqual(el.plotly_chart.use_container_width, False)

    def test_st_subheader(self):
        """Test st.subheader."""
        st.subheader("some subheader")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some subheader")
        self.assertEqual(el.heading.tag, "h3")

    def test_st_subheader_with_anchor(self):
        """Test st.subheader with anchor."""
        st.subheader("some subheader", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some subheader")
        self.assertEqual(el.heading.tag, "h3")
        self.assertEqual(el.heading.anchor, "some-anchor")

    def test_st_success(self):
        """Test st.success."""
        st.success("some success")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some success")
        self.assertEqual(el.alert.format, Alert.SUCCESS)

    def test_st_success_with_icon(self):
        """Test st.success with icon."""
        st.success("some success", icon="✅")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some success")
        self.assertEqual(el.alert.icon, "✅")
        self.assertEqual(el.alert.format, Alert.SUCCESS)

    def test_st_legacy_table(self):
        """Test st._legacy_table."""
        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st._legacy_table(df)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.table.data.cols[0].int64s.data, [1, 3])
        self.assertEqual(el.table.data.cols[1].int64s.data, [2, 4])
        self.assertEqual(
            el.table.columns.plain_index.data.strings.data, ["col1", "col2"]
        )

    def test_st_arrow_table(self):
        """Test st._arrow_table."""
        from streamlit.type_util import bytes_to_data_frame

        df = pd.DataFrame([[1, 2], [3, 4]], columns=["col1", "col2"])

        st._arrow_table(df)

        proto = self.get_delta_from_queue().new_element.arrow_table
        pd.testing.assert_frame_equal(bytes_to_data_frame(proto.data), df)

    def test_st_text(self):
        """Test st.text."""
        st.text("some text")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.text.body, "some text")

    def test_st_title(self):
        """Test st.title."""
        st.title("some title")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some title")
        self.assertEqual(el.heading.tag, "h1")

    def test_st_title_with_anchor(self):
        """Test st.title with anchor."""
        st.title("some title", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.heading.body, "some title")
        self.assertEqual(el.heading.tag, "h1")
        self.assertEqual(el.heading.anchor, "some-anchor")

    def test_st_legacy_vega_lite_chart(self):
        """Test st._legacy_vega_lite_chart."""
        pass

    def test_st_warning(self):
        """Test st.warning."""
        st.warning("some warning")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some warning")
        self.assertEqual(el.alert.format, Alert.WARNING)

    def test_st_warning_with_icon(self):
        """Test st.warning with icon."""
        st.warning("some warning", icon="⚠️")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some warning")
        self.assertEqual(el.alert.icon, "⚠️")
        self.assertEqual(el.alert.format, Alert.WARNING)

    @parameterized.expand([(st.error,), (st.warning,), (st.info,), (st.success,)])
    def test_st_alert_exceptions(self, alert_func):
        """Test that alert functions throw an exception when a non-emoji is given as an icon."""
        with self.assertRaises(StreamlitAPIException):
            alert_func("some alert", icon="hello world")
