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

from __future__ import annotations

from parameterized import parameterized

import streamlit as st
from streamlit.commands.experimental_query_params import (
    _exclude_keys_in_dict,
    _extract_key_query_params,
)
from streamlit.errors import StreamlitAPIException
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class QueryParamsAPITest(DeltaGeneratorTestCase):
    """Test Query params commands APIs."""

    def test_set_query_params_sends_protobuf_message(self):
        """Test valid st.set_query_params sends protobuf message."""
        st.experimental_set_query_params(x="a")
        message = self.get_message_from_queue(0)
        self.assertEqual(message.page_info_changed.query_string, "x=a")

    def test_set_query_params_exceptions(self):
        """Test invalid st.set_query_params raises exceptions."""
        with self.assertRaises(StreamlitAPIException):
            st.experimental_set_query_params(embed="True")
        with self.assertRaises(StreamlitAPIException):
            st.experimental_set_query_params(embed_options="show_colored_line")

    def test_get_query_params_after_set_query_params(self):
        """Test valid st.set_query_params sends protobuf message."""
        p_set = dict(x=["a"])
        st.experimental_set_query_params(**p_set)
        p_get = st.experimental_get_query_params()
        self.assertEqual(p_get, p_set)

    def test_set_query_params_empty_str(self):
        empty_str_params = dict(x=[""])
        st.experimental_set_query_params(**empty_str_params)
        params_get = st.experimental_get_query_params()
        self.assertEqual(params_get, empty_str_params)

    @parameterized.expand(
        [
            ({"x": ["a"]}, ["x"], {}),
            ({"a": ["a1", "a2"], "b": ["b1", "b2"]}, ["a"], {"b": ["b1", "b2"]}),
            ({"c": ["c1", "c2"]}, "no_existing_key", {"c": ["c1", "c2"]}),
            (
                {
                    "embed": ["true"],
                    "embed_options": ["show_padding", "show_colored_line"],
                },
                ["embed", "embed_options"],
                {},
            ),
            (
                {"EMBED": ["TRUE"], "EMBED_OPTIONS": ["DISABLE_SCROLLING"]},
                ["embed", "embed_options"],
                {},
            ),
        ]
    )
    def test_exclude_keys_in_dict(
        self,
        d: dict[str, list[str]],
        keys_to_drop: list[str],
        result: dict[str, list[str]],
    ):
        assert _exclude_keys_in_dict(d, keys_to_drop) == result

    @parameterized.expand(
        [
            ({"x": ["a"]}, "x", {"a"}),
            ({"a": ["a1"], "b": ["b1", "b2"]}, "a", {"a1"}),
            ({"c": ["c1", "c2"]}, "no_existing_key", set()),
            (
                {
                    "embed": ["true"],
                    "embed_options": ["show_padding", "show_colored_line"],
                },
                "embed",
                {"true"},
            ),
            (
                {"EMBED": ["TRUE"], "EMBED_OPTIONS": ["DISABLE_SCROLLING"]},
                "embed_options",
                {"disable_scrolling"},
            ),
        ]
    )
    def test_extract_key_query_params(
        self, query_params: dict[str, list[str]], param_key: str, result: set[str]
    ):
        assert _extract_key_query_params(query_params, param_key) == result
