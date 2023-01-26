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

import time
import unittest
from collections import namedtuple
from unittest.mock import Mock, PropertyMock, call, patch

import numpy as np
import pandas as pd
import pytest

import streamlit as st
from streamlit import type_util
from streamlit.elements import write
from streamlit.error_util import handle_uncaught_app_exception
from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state import SessionStateProxy
from tests.streamlit import pyspark_mocks
from tests.streamlit.snowpark_mocks import DataFrame, Row
from tests.testutil import should_skip_pyspark_tests


class StreamlitWriteTest(unittest.TestCase):
    """Test st.write.

    Unit tests for https://docs.streamlit.io/library/api-reference/write-magic/st.write

    Because we're going to test st.markdown, st.pyplot, st.altair_chart
    later on, we don't have to test it in st.write In st.write, all we're
    trying to check is that the right st.* method gets called
    """

    def test_repr_html(self):
        """Test st.write with an object that defines _repr_html_."""

        class FakeHTMLable(object):
            def _repr_html_(self):
                return "<strong>hello world</strong>"

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write(FakeHTMLable())

            p.assert_called_once_with(
                "<strong>hello world</strong>", unsafe_allow_html=True
            )

    def test_string(self):
        """Test st.write with a string."""
        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write("some string")

            p.assert_called_once()

        with patch("streamlit.delta_generator.DeltaGenerator.markdown") as p:
            st.write("more", "strings", "to", "pass")

            p.assert_called_once_with("more strings to pass", unsafe_allow_html=False)

    def test_dataframe(self):
        """Test st.write with dataframe."""
        data = {
            type_util._PANDAS_DF_TYPE_STR: pd.DataFrame(
                [[20, 30, 50]], columns=["a", "b", "c"]
            ),
            type_util._PANDAS_SERIES_TYPE_STR: pd.Series(np.array(["a", "b", "c"])),
            type_util._PANDAS_INDEX_TYPE_STR: pd.Index(list("abc")),
            type_util._PANDAS_STYLER_TYPE_STR: pd.DataFrame(
                {"a": [1], "b": [2]}
            ).style.format("{:.2%}"),
            type_util._NUMPY_ARRAY_TYPE_STR: np.array(["a", "b", "c"]),
        }

        # Make sure we have test cases for all _DATAFRAME_LIKE_TYPES
        self.assertEqual(sorted(data.keys()), sorted(type_util._DATAFRAME_LIKE_TYPES))

        for df in data.values():
            with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p:
                st.write(df)

                p.assert_called_once()

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

    def test_snowpark_dataframe_write(self):
        """Test st.write with snowflake.snowpark.dataframe.DataFrame."""
        from tests.streamlit.snowpark_mocks import DataFrame, Row

        # SnowparkDataFrame should call streamlit.delta_generator.DeltaGenerator.dataframe
        with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p:
            st.write(DataFrame())
            p.assert_called_once()

        # SnowparkRow inside list should call streamlit.delta_generator.DeltaGenerator.dataframe
        with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p:
            st.write(
                [
                    Row(),
                ]
            )
            p.assert_called_once()

    @pytest.mark.skipif(
        should_skip_pyspark_tests(), reason="pyspark is incompatible with Python3.11"
    )
    def test_pyspark_dataframe_write(self):
        """Test st.write with pyspark.sql.DataFrame."""
        from tests.streamlit import pyspark_mocks

        # PySpark DataFrame should call streamlit.delta_generator.DeltaGenerator.dataframe
        with patch("streamlit.delta_generator.DeltaGenerator.dataframe") as p:
            snowpark_dataframe = (
                pyspark_mocks.create_pyspark_dataframe_with_mocked_personal_data()
            )
            st.write(snowpark_dataframe)
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
                "`1 * 2 - 3 = 4 \\`ok\\` !`", unsafe_allow_html=False
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
