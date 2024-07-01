# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import dataclasses
import time
import unittest
from collections import namedtuple
from typing import Any
from unittest.mock import MagicMock, Mock, PropertyMock, call, mock_open, patch

import numpy as np
import pandas as pd
from parameterized import parameterized
from PIL import Image

import streamlit as st
from streamlit import type_util
from streamlit.elements import write
from streamlit.error_util import handle_uncaught_app_exception
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import QueryParamsProxy, SessionStateProxy
from tests.streamlit.modin_mocks import DataFrame as ModinDataFrame
from tests.streamlit.modin_mocks import Series as ModinSeries
from tests.streamlit.pyspark_mocks import DataFrame as PysparkDataFrame
from tests.streamlit.runtime.secrets_test import MOCK_TOML
from tests.streamlit.snowpandas_mocks import DataFrame as SnowpandasDataFrame
from tests.streamlit.snowpandas_mocks import Series as SnowpandasSeries
from tests.streamlit.snowpark_mocks import DataFrame as SnowparkDataFrame
from tests.streamlit.snowpark_mocks import Row as SnowparkRow
from tests.streamlit.snowpark_mocks import Table as SnowparkTable


class StreamlitWriteTest(unittest.TestCase):
    """Test st.write.

    Unit tests for https://docs.streamlit.io/develop/api-reference/write-magic/st.write

    Because we're going to test st.markdown, st.pyplot, st.altair_chart
    later on, we don't have to test it in st.write In st.write, all we're
    trying to check is that the right st.* method gets called
    """

    def test_repr_html(self):
        """Test st.write with an object that defines _repr_html_."""

        class FakeHTMLable(object):
            def _repr_html_(self):
                return "<strong>hello world</strong>"

        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            fake = FakeHTMLable()
            st.write(fake)

            p.assert_called_once_with(fake)

    def test_repr_html_allowing_html(self):
        """Test st.write with an object that defines _repr_html_ and allows
        unsafe HTML explicitly."""

        class FakeHTMLable(object):
            def _repr_html_(self):
                return "<strong>hello world</strong>"

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write(FakeHTMLable(), unsafe_allow_html=True)

            p.assert_called_once_with(
                "<strong>hello world</strong>", unsafe_allow_html=True
            )

    def test_repr_html_no_html_tags_in_string(self):
        """Test st.write with an object that defines _repr_html_ but does not have any
        html tags in the returned string.
        """

        class FakeHTMLable(object):
            def _repr_html_(self):
                return "hello **world**"

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write(FakeHTMLable())

            p.assert_called_once_with("hello **world**", unsafe_allow_html=False)

    def test_repr_html_not_callable(self):
        """Test st.write with an object that defines _repr_html_ but is not callable"""

        class FakeHTMLable(object):
            _repr_html_ = "hello **world**"

        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            fake = FakeHTMLable()
            st.write(fake)

            p.assert_called_once_with(fake)

    def test_string(self):
        """Test st.write with a string."""
        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write("some string")

            p.assert_called_once()

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write("more", "strings", "to", "pass")

            p.assert_called_once_with("more strings to pass", unsafe_allow_html=False)

    def test_exception_type(self):
        """Test st.write with exception."""
        with patch("streamlit.delta_generator.DeltaGenerator.exception") as p:
            st.write(Exception("some exception"))

            p.assert_called_once()

    def test_help(self):
        """Test st.write with help types."""
        # Test module
        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            st.write(np)

            p.assert_called_once()

        # Test function
        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            st.write(st.set_option)

            p.assert_called_once()

    @patch("streamlit.type_util.is_type")
    def test_altair_chart(self, is_type):
        """Test st.write with altair_chart."""
        is_type.side_effect = make_is_type_mock(type_util._ALTAIR_RE)

        class FakeChart(object):
            pass

        with patch("streamlit.delta_generator.DeltaGenerator.altair_chart") as p:
            st.write(FakeChart())

            p.assert_called_once()

    @patch("streamlit.type_util.is_type")
    def test_pyplot(self, is_type):
        """Test st.write with matplotlib."""
        is_type.side_effect = make_is_type_mock("matplotlib.figure.Figure")

        class FakePyplot(object):
            pass

        with patch("streamlit.delta_generator.DeltaGenerator.pyplot") as p:
            st.write(FakePyplot())

            p.assert_called_once()

    def test_plotly(self):
        import plotly.graph_objs as go

        """Test st.write with plotly object."""
        with patch("streamlit.delta_generator.DeltaGenerator.plotly_chart") as p:
            st.write([go.Scatter(x=[1, 2], y=[10, 20])])

            p.assert_called_once()

    def test_dict(self):
        """Test st.write with dict."""
        with patch("streamlit.delta_generator.DeltaGenerator.json") as p:
            st.write({"a": 1, "b": 2})

            p.assert_called_once()

    def test_pil_image(self):
        """Test st.write with PIL image objects."""
        with patch("streamlit.delta_generator.DeltaGenerator.image") as p:
            st.write(Image.new("L", (10, 10), "black"))

            p.assert_called_once()

    def test_generator(self):
        """Test st.write with generator function."""

        def gen_function():
            yield "hello"
            yield "world"

        # Should support it as a generator function
        with patch("streamlit.delta_generator.DeltaGenerator.write_stream") as p:
            st.write(gen_function)

            p.assert_called_once()

        # Should support it as a generator function call
        with patch("streamlit.delta_generator.DeltaGenerator.write_stream") as p:
            st.write(gen_function())

            p.assert_called_once()

    @patch("streamlit.type_util.is_type")
    def test_openai_stream(self, is_type):
        """Test st.write with openai.Stream."""
        is_type.side_effect = make_is_type_mock("openai.Stream")

        class FakeOpenaiStream(object):
            pass

        with patch("streamlit.delta_generator.DeltaGenerator.write_stream") as p:
            st.write(FakeOpenaiStream())

            p.assert_called_once()

    def test_list(self):
        """Test st.write with list."""
        with patch("streamlit.delta_generator.DeltaGenerator.json") as p:
            st.write([1, 2, 3])

            p.assert_called_once()

    def test_namedtuple(self):
        """Test st.write with list."""
        with patch("streamlit.delta_generator.DeltaGenerator.json") as p:
            Boy = namedtuple("Boy", ("name", "age"))
            John = Boy("John", 29)
            st.write(John)

            p.assert_called_once()

    def test_session_state(self):
        """Test st.write with st.session_state."""
        with patch("streamlit.delta_generator.DeltaGenerator.json") as p:
            st.write(SessionStateProxy())

            p.assert_called_once()

    def test_query_params(self):
        """Test st.write with st.query_params."""
        with patch("streamlit.delta_generator.DeltaGenerator.json") as p:
            st.write(QueryParamsProxy())

            p.assert_called_once()

    @patch("builtins.open", new_callable=mock_open, read_data=MOCK_TOML)
    def test_streamlit_secrets(self, *mocks):
        """Test st.write with st.secrets."""
        with patch("streamlit.delta_generator.DeltaGenerator.json") as p:
            st.write(st.secrets)

            p.assert_called_once()

    @parameterized.expand(
        [
            (pd.DataFrame([[20, 30, 50]], columns=["a", "b", "c"]),),
            (pd.Series(np.array(["a", "b", "c"])),),
            (pd.Index(list("abc")),),
            (pd.DataFrame({"a": [1], "b": [2]}).style.format("{:.2%}"),),
            (np.array(["a", "b", "c"]),),
            (SnowpandasSeries(pd.Series(np.random.randn(2))),),
            (SnowpandasDataFrame(pd.DataFrame(np.random.randn(2, 2))),),
            (SnowparkTable(pd.DataFrame(np.random.randn(2, 2))),),
            (SnowparkDataFrame(pd.DataFrame(np.random.randn(2, 2))),),
            (PysparkDataFrame(pd.DataFrame(np.random.randn(2, 2))),),
            (ModinSeries(pd.Series(np.random.randn(2))),),
            (ModinDataFrame(pd.DataFrame(np.random.randn(2, 2))),),
            ([SnowparkRow()],),
        ]
    )
    def test_write_compatible_dataframe(
        self,
        input_data: Any,
    ):
        with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p:
            st.write(input_data)
            p.assert_called_once()

    @patch("streamlit.delta_generator.DeltaGenerator.markdown")
    @patch("streamlit.delta_generator.DeltaGenerator.json")
    def test_dict_and_string(self, mock_json, mock_markdown):
        """Test st.write with dict."""
        manager = Mock()
        manager.attach_mock(mock_json, "json")
        manager.attach_mock(mock_markdown, "markdown")

        st.write("here is a dict", {"a": 1, "b": 2}, " and that is all")

        expected_calls = [
            call.markdown("here is a dict", unsafe_allow_html=False),
            call.json({"a": 1, "b": 2}),
            call.markdown(" and that is all", unsafe_allow_html=False),
        ]
        self.assertEqual(manager.mock_calls, expected_calls)

    def test_default_object(self):
        """Test st.write with default clause ie some object."""

        class SomeObject(object):
            def __str__(self):
                return "1 * 2 - 3 = 4 `ok` !"

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write(SomeObject())

            p.assert_called_once_with(
                "``1 * 2 - 3 = 4 `ok` !``", unsafe_allow_html=False
            )

    def test_default_object_multiline(self):
        """Test st.write with default clause ie some object with multiline string."""

        class SomeObject(object):
            def __str__(self):
                return "1 * 2\n - 3\n ``` = \n````\n4 `ok` !"

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write(SomeObject())

            p.assert_called_once_with(
                "`````\n1 * 2\n - 3\n ``` = \n````\n4 `ok` !\n`````",
                unsafe_allow_html=False,
            )

    def test_class(self):
        """Test st.write with a class."""

        class SomeClass:
            pass

        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            st.write(SomeClass)

            p.assert_called_once_with(SomeClass)

        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            empty_df = pd.DataFrame()
            st.write(type(empty_df))

            p.assert_called_once_with(type(empty_df))

    def test_obj_instance(self):
        """Test st.write with an object instance that doesn't know how to str()."""

        class SomeClass:
            pass

        my_instance = SomeClass()

        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            st.write(my_instance)

            p.assert_called_once_with(my_instance)

    def test_dataclass_instance(self):
        """Test st.write with a dataclass instance."""

        @dataclasses.dataclass
        class SomeClass:
            pass

        my_instance = SomeClass()

        with patch("streamlit.delta_generator.DeltaGenerator.help") as p:
            st.write(my_instance)

            p.assert_called_once_with(my_instance)

    # We use "looks like a memory address" as a test inside st.write, so here we're
    # checking that that logic isn't broken.
    def test_str_looking_like_mem_address(self):
        """Test calling st.write on a string that looks like a memory address."""

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write("<__main__.MyObj object at 0x13d2d0bb0>")

            p.assert_called_once()

    def test_exception(self):
        """Test st.write that raises an exception."""
        # We patch streamlit.exception to observe it, but we also make sure
        # it's still called (via side_effect). This ensures that it's called
        # with the proper arguments.
        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as m, patch(
            "streamlit.delta_generator.DeltaGenerator.exception",
            side_effect=handle_uncaught_app_exception,
        ):
            m.side_effect = Exception("some exception")

            with self.assertRaises(Exception):
                st.write("some text")

    def test_unknown_arguments(self):
        """Test st.write that raises an exception."""
        with self.assertLogs(write._LOGGER) as logs:
            st.write("some text", unknown_keyword_arg=123)

        self.assertIn(
            'Invalid arguments were passed to "st.write" function.', logs.records[0].msg
        )

    def test_spinner(self):
        """Test st.spinner."""
        # TODO(armando): Test that the message is actually passed to
        # message.warning
        with patch("streamlit.delta_generator.DeltaGenerator.empty") as e:
            with st.spinner("some message"):
                time.sleep(0.15)
            e.assert_called_once_with()

    def test_sidebar(self):
        """Test st.write in the sidebar."""
        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as m, patch(
            "streamlit.delta_generator.DeltaGenerator.help"
        ) as h:
            st.sidebar.write("markdown", st.help)

            m.assert_called_once()
            h.assert_called_once()

    def test_empty(self):
        """Test st.write from a specific element."""
        placeholder = st.empty()

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            placeholder.write("One argument is okay...")

            p.assert_called_once()

        with self.assertRaises(StreamlitAPIException):
            # Also override dg._is_top_level for this test.
            with patch.object(
                st.delta_generator.DeltaGenerator,
                "_is_top_level",
                new_callable=PropertyMock,
            ) as top_level:
                top_level.return_value = False

                placeholder.write("But", "multiple", "args", "should", "fail")


class StreamlitStreamTest(unittest.TestCase):
    """Test st.write_stream."""

    @patch("streamlit.type_util.is_type")
    def test_with_openai_chunk(self, is_type):
        """Test st.write_stream with openai Chunks."""

        is_type.side_effect = make_is_type_mock(type_util._OPENAI_CHUNK_RE)

        # Create a mock for ChatCompletionChunk
        mock_chunk = MagicMock()

        def openai_stream():
            mock_chunk.choices = []
            yield mock_chunk  # should also support empty chunks
            mock_chunk.choices = [MagicMock()]
            mock_chunk.choices[0].delta.content = "Hello "
            yield mock_chunk
            mock_chunk.choices[0].delta.content = "World"
            yield mock_chunk

        stream_return = st.write_stream(openai_stream)
        self.assertEqual(stream_return, "Hello World")

    def test_with_generator_text(self):
        """Test st.write_stream with generator text content."""

        def test_stream():
            yield "Hello "
            yield "World"

        stream_return = st.write_stream(test_stream)
        self.assertEqual(stream_return, "Hello World")

    def test_with_empty_chunks(self):
        """Test st.write_stream with generator that returns empty chunks."""

        def test_stream():
            yield ""
            yield ""

        stream_return = st.write_stream(test_stream)
        self.assertEqual(stream_return, "")

    def test_with_empty_stream(self):
        """Test st.write_stream with generator that returns empty chunks."""

        def test_stream():
            if False:
                yield "Hello"

        stream_return = st.write_stream(test_stream)
        self.assertEqual(stream_return, "")

    def test_with_wrong_input(self):
        """Test st.write_stream with string or dataframe input generates exception."""

        with self.assertRaises(StreamlitAPIException):
            st.write_stream("Hello World")

        with self.assertRaises(StreamlitAPIException):
            st.write_stream(pd.DataFrame([[1, 2], [3, 4]]))

    def test_with_generator_misc(self):
        """Test st.write_stream with generator with different content."""

        def test_stream():
            yield "This is "
            yield "a dataframe:"
            yield pd.DataFrame([[1, 2], [3, 4]])
            yield "Text under dataframe"

        with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p_dataframe:
            stream_return = st.write_stream(test_stream)
            p_dataframe.assert_called_once()
            self.assertEqual(
                str(stream_return),
                str(
                    [
                        "This is a dataframe:",
                        pd.DataFrame([[1, 2], [3, 4]]),
                        "Text under dataframe",
                    ]
                ),
            )

    def test_with_list_output(self):
        """Test st.write_stream with a list."""

        data = [
            "This is ",
            "a dataframe:",
            pd.DataFrame([[1, 2], [3, 4]]),
            "Text under dataframe",
        ]

        with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p_dataframe:
            stream_return = st.write_stream(data)
            p_dataframe.assert_called_once()
            self.assertEqual(
                str(stream_return),
                str(
                    [
                        "This is a dataframe:",
                        pd.DataFrame([[1, 2], [3, 4]]),
                        "Text under dataframe",
                    ]
                ),
            )


def make_is_type_mock(true_type_matchers):
    """Return a function that mocks is_type.

    When you do this:
    mock_is_type.side_effect = make_is_type_mock("foo.bar.Baz")

    ...then when you call mock_is_type(my_type, "foo.bar.Baz") it will return
    True (and False otherwise).

    You can also pass in a tuple.
    """
    if type(true_type_matchers) is not tuple:
        true_type_matchers = (true_type_matchers,)

    def new_is_type(obj, type_matchers):
        if type(type_matchers) is not tuple:
            type_matchers = (type_matchers,)

        for type_matcher in type_matchers:
            if type_matcher in true_type_matchers:
                return True
        return False

    return new_is_type
