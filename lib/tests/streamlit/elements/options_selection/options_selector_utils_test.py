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

from parameterized import parameterized
import pytest

import streamlit as st
from streamlit.elements.widgets.options_selector.options_selector_utils import (
    _get_default_count,
    _get_over_max_options_message,
    _check_and_convert_to_indices,
    transform_options,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.ButtonGroup_pb2 import ButtonGroup as ButtonGroupProto
from streamlit.runtime.state.common import RegisterWidgetResult
from tests.delta_generator_test_case import DeltaGeneratorTestCase
import unittest
import enum

import numpy as np
from unittest.mock import patch


class TestDefaultCount:
    @parameterized.expand(
        [
            (["a", "b", "c"], 3),
            (["a"], 1),
            ([], 0),
            ("a", 1),
            (None, 0),
            (("a", "b", "c"), 3),
        ]
    )
    def test_get_default_count(self, default, expected_count):
        assert _get_default_count(default) == expected_count


class TestOverMaxSelections(unittest.TestCase):
    def test_over_max_selections_initialization(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.multiselect(
                "the label", ["a", "b", "c", "d"], ["a", "b", "c"], max_selections=2
            )
        self.assertEqual(
            str(e.exception),
            """
Multiselect has 3 options selected but `max_selections`
is set to 2. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 2 options.
""",
        )

    @parameterized.expand(
        [
            (
                1,
                1,
                f"""
Multiselect has 1 option selected but `max_selections`
is set to 1. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 1 option.
""",
            ),
            (
                1,
                0,
                f"""
Multiselect has 1 option selected but `max_selections`
is set to 0. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 0 options.
""",
            ),
            (
                2,
                1,
                f"""
Multiselect has 2 options selected but `max_selections`
is set to 1. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 1 option.
""",
            ),
            (
                3,
                2,
                f"""
Multiselect has 3 options selected but `max_selections`
is set to 2. This happened because you either gave too many options to `default`
or you manipulated the widget's state through `st.session_state`. Note that
the latter can happen before the line indicated in the traceback.
Please select at most 2 options.
""",
            ),
        ]
    )
    def test_get_over_max_options_message(
        self, current_selections, max_selections, expected_msg
    ):
        self.assertEqual(
            _get_over_max_options_message(current_selections, max_selections),
            expected_msg,
        )


class TestCheckAndConvertToIndices:
    def test_check_and_convert_to_indices_none_default(self):
        res = _check_and_convert_to_indices(["a"], None)
        assert res == None

    def test_check_and_convert_to_indices_single_default(self):
        res = _check_and_convert_to_indices(["a", "b"], "a")
        assert res == [0]

    def test_check_and_convert_to_indices_default_is_numpy_array(self):
        res = _check_and_convert_to_indices(["a", "b"], np.array(["b"]))
        assert res == [1]

    def test_check_and_convert_to_indices_default_is_tuple(self):
        res = _check_and_convert_to_indices(["a", "b"], ("b",))
        assert res == [1]

    def test_check_and_convert_to_indices_default_is_set(self):
        res = _check_and_convert_to_indices(
            ["a", "b"],
            set(
                "b",
            ),
        )
        assert res == [1]

    def test_check_and_convert_to_indices_default_not_in_opts(self):
        with pytest.raises(StreamlitAPIException):
            _check_and_convert_to_indices(["a", "b"], "c")


class TestTransformOptions:
    def test_transform_options(self):
        options = ["a", "b", "c"]
        indexable_options, formatted_options, default_indices = transform_options(
            options, "b", lambda x: f"transformed_{x}"
        )

        assert indexable_options == options
        for option in options:
            assert f"transformed_{option}" in formatted_options

        assert default_indices == [1]

    def test_transform_options_default_format_func(self):
        options = [5, 6, 7]
        indexable_options, formatted_options, default_indices = transform_options(
            options, 7, None
        )

        assert indexable_options == options
        for option in options:
            assert f"{option}" in formatted_options

        assert default_indices == [2]
