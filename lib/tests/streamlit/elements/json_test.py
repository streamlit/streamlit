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

import numpy as np

import streamlit as st
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StJsonAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_json(self):
        """Test st.json."""
        st.json('{"some": "json"}')

        el = self.get_delta_from_queue().new_element
        assert el.json.body == '{"some": "json"}'
        assert el.json.expanded is True
        assert el.json.HasField("max_expand_depth") is False

        # Test that an object containing non-json-friendly keys can still
        # be displayed.  Resultant json body will be missing those keys.

        n = np.array([1, 2, 3, 4, 5])
        data = {n[0]: "this key will not render as JSON", "array": n}
        st.json(data)

        el = self.get_delta_from_queue().new_element
        assert el.json.body == '{"array": "array([1, 2, 3, 4, 5])"}'

    def test_expanded_param(self):
        """Test expanded paramter for `st.json`"""
        st.json(
            {
                "level1": {"level2": {"level3": {"a": "b"}}, "c": "d"},
            },
            expanded=2,
        )

        el = self.get_delta_from_queue().new_element
        assert el.json.expanded is True
        assert el.json.max_expand_depth == 2
