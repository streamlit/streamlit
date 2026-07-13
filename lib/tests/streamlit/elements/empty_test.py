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

import pytest

import streamlit as st
from streamlit import errors
from streamlit.proto.Empty_pb2 import Empty as EmptyProto
from tests.delta_generator_test_case import DeltaGeneratorTestCase


class StEmptyAPITest(DeltaGeneratorTestCase):
    """Test Public Streamlit Public APIs."""

    def test_st_empty(self):
        """Test st.empty."""
        st.empty()

        el = self.get_delta_from_queue().new_element
        assert el.empty == EmptyProto()

    def test_empty_allows_reusing_widget_ids_in_same_run(self):
        """Test that clearing a placeholder releases nested widget IDs."""
        placeholder = st.empty()

        with placeholder.container():
            st.number_input("One", value=1)
            st.number_input("Two", value=2)

        placeholder.empty()

        with placeholder.container():
            st.number_input("One", value=1)
            st.number_input("Two", value=2)
            st.number_input("Three", value=3)

    def test_empty_allows_reusing_widget_user_keys_in_same_run(self):
        """Test that clearing a placeholder releases nested widget user keys."""
        placeholder = st.empty()

        with placeholder.container():
            st.number_input("One", value=1, key="one")

        placeholder.empty()

        with placeholder.container():
            st.number_input("One", value=1, key="one")

    def test_empty_does_not_clear_sibling_widget_ids(self):
        """Test that clearing a placeholder preserves sibling duplicate checks."""
        st.number_input("One", value=1)
        placeholder = st.empty()

        with placeholder.container():
            st.number_input("Two", value=2)

        placeholder.empty()

        with pytest.raises(errors.DuplicateWidgetID):
            st.number_input("One", value=1)
