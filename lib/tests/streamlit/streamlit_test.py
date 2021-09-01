# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Streamlit Unit test."""
from io import BytesIO

from unittest.mock import patch
import json
import os
import io
import re
import textwrap
import unittest
import logging

from google.protobuf import json_format
import PIL.Image as Image
import numpy as np
import pandas as pd
from parameterized import parameterized
from scipy.io import wavfile

import streamlit as st
from streamlit import __version__
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from streamlit.proto.Alert_pb2 import Alert

from streamlit.in_memory_file_manager import _calculate_file_id
from streamlit.in_memory_file_manager import in_memory_file_manager
from streamlit.in_memory_file_manager import STATIC_MEDIA_ENDPOINT

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

    def test_set_option_scriptable(self):
        """Test that scriptable options can be set from API."""
        # This is set in lib/tests/conftest.py to off
        self.assertEqual(True, st.get_option("client.displayEnabled"))

        # client.displayEnabled and client.caching can be set after run starts.
        st.set_option("client.displayEnabled", False)
        self.assertEqual(False, st.get_option("client.displayEnabled"))

    def test_set_option_unscriptable(self):
        """Test that unscriptable options cannot be set with st.set_option."""
        # This is set in lib/tests/conftest.py to off
        self.assertEqual(True, st.get_option("server.enableCORS"))

        with self.assertRaises(StreamlitAPIException):
            st.set_option("server.enableCORS", False)

    def test_run_warning_presence(self):
        """Using Streamlit without `streamlit run` produces a warning."""
        with self.assertLogs(level=logging.WARNING) as logs:
            st._is_running_with_streamlit = False
            st._use_warning_has_been_displayed = False
            st.write("Using delta generator")
            output = "".join(logs.output)
            # Warning produced exactly once
            self.assertEqual(len(re.findall(r"streamlit run", output)), 1)

    def test_run_warning_absence(self):
        """Using Streamlit through the CLI produces no usage warning."""
        with self.assertLogs(level=logging.WARNING) as logs:
            st._is_running_with_streamlit = True
            st._use_warning_has_been_displayed = False
            st.write("Using delta generator")
            # assertLogs is being used as a context manager, but it also checks that some log output was captured, so we have to let it capture something
            get_logger("root").warning("irrelevant warning so assertLogs passes")
            self.assertNotRegex("".join(logs.output), r"streamlit run")


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

    def test_st_audio(self):
        """Test st.audio."""

        # Fake audio data: expect the resultant mimetype to be audio default.
        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")

        st.audio(fake_audio_data)

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(fake_audio_data, "audio/wav")
        self.assertTrue(file_id in in_memory_file_manager)

        afile = in_memory_file_manager.get(file_id)
        self.assertEqual(afile.mimetype, "audio/wav")
        self.assertEqual(afile.url, el.audio.url)

        # Test using generated data in a file-like object.

        sampleRate = 44100
        frequency = 440
        length = 5

        t = np.linspace(
            0, length, sampleRate * length
        )  #  Produces a 5 second Audio-File
        y = np.sin(frequency * 2 * np.pi * t)  #  Has frequency of 440Hz

        wavfile.write("test.wav", sampleRate, y)

        with io.open("test.wav", "rb") as f:
            st.audio(f)

        el = self.get_delta_from_queue().new_element
        self.assertTrue(".wav" in el.audio.url)

        os.remove("test.wav")

        # Test using a URL instead of data
        some_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
        st.audio(some_url)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.url, some_url)

        # Test that a non-URL string is assumed to be a filename
        bad_filename = "blah"
        with self.assertRaises(FileNotFoundError):
            st.audio(bad_filename)

        # Test that we can use an empty/None value without error.
        st.audio(None)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.url, "")

        # Test that our other data types don't result in an error.
        st.audio(b"bytes_data")
        st.audio("str_data".encode("utf-8"))
        st.audio(BytesIO(b"bytesio_data"))
        st.audio(np.array([0, 1, 2, 3]))

    def test_st_audio_options(self):
        """Test st.audio with options."""
        from streamlit.in_memory_file_manager import _calculate_file_id

        fake_audio_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        st.audio(fake_audio_data, format="audio/mp3", start_time=10)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.audio.start_time, 10)
        self.assertTrue(el.audio.url.startswith(STATIC_MEDIA_ENDPOINT))
        self.assertTrue(_calculate_file_id(fake_audio_data, "audio/mp3"), el.audio.url)

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
        self.assertEqual(el.markdown.body, "## some header")

    def test_st_header_with_anchor(self):
        """Test st.header with anchor."""
        st.header("some header", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(
            el.markdown.body, '<h2 data-anchor="some-anchor">some header</h2>'
        )

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
        self.assertEqual(el.doc_string.signature, "(body, anchor=None)")

    def test_st_image_PIL_image(self):
        """Test st.image with PIL image."""
        img = Image.new("RGB", (64, 64), color="red")

        st.image(img, caption="some caption", width=100, output_format="PNG")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 100)
        self.assertEqual(el.imgs.imgs[0].caption, "some caption")

        # locate resultant file in the file manager and check its metadata.
        from streamlit.elements.image import _PIL_to_bytes

        file_id = _calculate_file_id(_PIL_to_bytes(img, format="PNG"), "image/png")
        self.assertTrue(file_id in in_memory_file_manager)

        afile = in_memory_file_manager.get(file_id)
        self.assertEqual(afile.mimetype, "image/png")
        self.assertEqual(afile.url, el.imgs.imgs[0].url)

    def test_st_image_PIL_array(self):
        """Test st.image with a PIL array."""
        imgs = [
            Image.new("RGB", (64, 64), color="red"),
            Image.new("RGB", (64, 64), color="blue"),
            Image.new("RGB", (64, 64), color="green"),
        ]

        st.image(
            imgs,
            caption=["some caption"] * 3,
            width=200,
            use_column_width=True,
            clamp=True,
            output_format="PNG",
        )

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, -2)

        # locate resultant file in the file manager and check its metadata.
        from streamlit.elements.image import _PIL_to_bytes

        for idx in range(len(imgs)):
            file_id = _calculate_file_id(
                _PIL_to_bytes(imgs[idx], format="PNG"), "image/png"
            )
            self.assertEqual(el.imgs.imgs[idx].caption, "some caption")
            self.assertTrue(file_id in in_memory_file_manager)
            afile = in_memory_file_manager.get(file_id)
            self.assertEqual(afile.mimetype, "image/png")
            self.assertEqual(afile.url, el.imgs.imgs[idx].url)

    def test_st_image_with_single_url(self):
        """Test st.image with single url."""
        url = "http://server/fake0.jpg"

        st.image(url, caption="some caption", width=300)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 300)
        self.assertEqual(el.imgs.imgs[0].caption, "some caption")
        self.assertEqual(el.imgs.imgs[0].url, url)

    def test_st_image_with_list_of_urls(self):
        """Test st.image with list of urls."""
        urls = [
            "http://server/fake0.jpg",
            "http://server/fake1.jpg",
            "http://server/fake2.jpg",
        ]
        st.image(urls, caption=["some caption"] * 3, width=300)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, 300)
        for idx, url in enumerate(urls):
            self.assertEqual(el.imgs.imgs[idx].caption, "some caption")
            self.assertEqual(el.imgs.imgs[idx].url, url)

    def test_st_image_bad_width(self):
        """Test st.image with bad width."""
        with self.assertRaises(StreamlitAPIException) as ctx:
            st.image("does/not/exist", width=-1234)

        self.assertTrue("Image width must be positive." in str(ctx.exception))

    def test_st_info(self):
        """Test st.info."""
        st.info("some info")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some info")
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

    def test_st_pyplot(self):
        """Test st.pyplot.

        Need to test:
        * Failed import of matplotlib.
        * Passing in a figure.
        """
        import matplotlib
        import matplotlib.pyplot as plt

        if matplotlib.get_backend().lower() != "agg":
            plt.switch_backend("agg")

        # Make this deterministic
        np.random.seed(19680801)
        data = np.random.randn(2, 20)

        # Generate a 2 inch x 2 inch figure
        fig, ax = plt.subplots(figsize=(2, 2))
        # Add 20 random points to scatter plot.
        ax.scatter(data[0], data[1])

        st.pyplot(fig)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.imgs.width, -2)
        self.assertEqual(el.imgs.imgs[0].caption, "")
        self.assertTrue(el.imgs.imgs[0].url.startswith(STATIC_MEDIA_ENDPOINT))

    def test_st_pyplot_clear_figure(self):
        """st.pyplot should clear the passed-in figure."""
        import matplotlib
        import matplotlib.pyplot as plt

        if matplotlib.get_backend().lower() != "agg":
            plt.switch_backend("agg")

        # Assert that plt.clf() is called by st.pyplot() only if
        # clear_fig is True
        for clear_figure in [True, False, None]:
            plt.hist(np.random.normal(1, 1, size=100), bins=20)
            with patch.object(plt, "clf", wraps=plt.clf, autospec=True) as plt_clf:
                st.pyplot(clear_figure=clear_figure)

                if clear_figure is False:
                    plt_clf.assert_not_called()
                else:
                    plt_clf.assert_called_once()

            # Manually clear for the next loop iteration
            plt.clf()

        # Assert that fig.clf() is called by st.pyplot(fig) only if
        # clear_figure is True
        for clear_figure in [True, False, None]:
            fig = plt.figure()
            ax1 = fig.add_subplot(111)
            ax1.hist(np.random.normal(1, 1, size=100), bins=20)
            with patch.object(fig, "clf", wraps=fig.clf, autospec=True) as fig_clf:
                st.pyplot(fig, clear_figure=clear_figure)

                if clear_figure:
                    fig_clf.assert_called_once()
                else:
                    fig_clf.assert_not_called()

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
        self.assertEqual(el.markdown.body, "### some subheader")

    def test_st_subheader_with_anchor(self):
        """Test st.subheader with anchor."""
        st.subheader("some subheader", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(
            el.markdown.body, '<h3 data-anchor="some-anchor">some subheader</h3>'
        )

    def test_st_success(self):
        """Test st.success."""
        st.success("some success")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some success")
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
        self.assertEqual(el.markdown.body, "# some title")

    def test_st_title_with_anchor(self):
        """Test st.title with anchor."""
        st.title("some title", anchor="some-anchor")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(
            el.markdown.body, '<h1 data-anchor="some-anchor">some title</h1>'
        )

    def test_st_legacy_vega_lite_chart(self):
        """Test st._legacy_vega_lite_chart."""
        pass

    def test_st_video(self):
        """Test st.video."""

        # Make up some bytes to pretend we have a video.  The server should not vet
        # the video before sending it to the browser.
        fake_video_data = "\x12\x10\x35\x44\x55\x66".encode("utf-8")

        st.video(fake_video_data)

        el = self.get_delta_from_queue().new_element

        # locate resultant file in InMemoryFileManager and test its properties.
        file_id = _calculate_file_id(fake_video_data, "video/mp4")
        self.assertTrue(file_id in in_memory_file_manager)

        afile = in_memory_file_manager.get(file_id)
        self.assertEqual(afile.mimetype, "video/mp4")
        self.assertEqual(afile.url, el.video.url)

        # Test with an arbitrary URL in place of data
        some_url = "http://www.marmosetcare.com/video/in-the-wild/intro.webm"
        st.video(some_url)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.url, some_url)

        # Test with sufficiently varied youtube URLs
        yt_urls = (
            "https://youtu.be/_T8LGqJtuGc",
            "https://www.youtube.com/watch?v=kmfC-i9WgH0",
            "https://www.youtube.com/embed/sSn4e1lLVpA",
        )
        yt_embeds = (
            "https://www.youtube.com/embed/_T8LGqJtuGc",
            "https://www.youtube.com/embed/kmfC-i9WgH0",
            "https://www.youtube.com/embed/sSn4e1lLVpA",
        )
        # url should be transformed into an embed link (or left alone).
        for x in range(0, len(yt_urls)):
            st.video(yt_urls[x])
            el = self.get_delta_from_queue().new_element
            self.assertEqual(el.video.url, yt_embeds[x])

        # Test that a non-URL string is assumed to be a filename
        bad_filename = "blah"
        with self.assertRaises(FileNotFoundError):
            st.video(bad_filename)

        # Test that we can use an empty/None value without error.
        st.video(None)
        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.url, "")

        # Test that our other data types don't result in an error.
        st.video(b"bytes_data")
        st.video("str_data".encode("utf-8"))
        st.video(BytesIO(b"bytesio_data"))
        st.video(np.array([0, 1, 2, 3]))

    def test_st_video_options(self):
        """Test st.video with options."""

        from streamlit.in_memory_file_manager import _calculate_file_id

        fake_video_data = "\x11\x22\x33\x44\x55\x66".encode("utf-8")
        st.video(fake_video_data, format="video/mp4", start_time=10)

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.video.start_time, 10)
        self.assertTrue(el.video.url.startswith(STATIC_MEDIA_ENDPOINT))
        self.assertTrue(
            _calculate_file_id(fake_video_data, "video/mp4") in el.video.url
        )

    def test_st_warning(self):
        """Test st.warning."""
        st.warning("some warning")

        el = self.get_delta_from_queue().new_element
        self.assertEqual(el.alert.body, "some warning")
        self.assertEqual(el.alert.format, Alert.WARNING)
